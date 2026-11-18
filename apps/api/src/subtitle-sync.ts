import { createHash, randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Api } from '@jellyfin/sdk'
import type {
  BaseItemDto,
  MediaSourceInfo,
} from '@jellyfin/sdk/lib/generated-client/index.js'
import {
  maxResidualMs,
  originalTiming,
  syncFailures,
  type SyncFailure,
} from '@hollyfilms/shared/subtitle-sync'
import type {
  Correction,
  SyncJob,
  SyncSnapshot,
  SyncStage,
} from '@hollyfilms/shared/subtitle-sync'
import type {
  PrismaClient,
  SubtitleAnalysis,
} from './generated/prisma/client.ts'
import { ApiError } from './errors.ts'
import {
  analyze,
  AnalysisFailure,
  engineAvailable,
  engineId,
  limit,
  maxSeconds,
  timeoutMs,
} from './subtitle-analysis.ts'

const active = ['queued', 'preparing', 'analyzing', 'aligning', 'validating']
const conflict = () =>
  new ApiError(409, 'SYNC_CONFLICT', 'Le réglage ou la piste a changé.')
const unavailable = () =>
  new ApiError(
    503,
    'SYNC_UNAVAILABLE',
    'Source de synchronisation indisponible.',
  )
const view = (row: SubtitleAnalysis): SyncJob => ({
  id: row.id,
  stage: row.stage as SyncStage,
  processedSeconds: row.processedSeconds,
  failure:
    row.stage === 'failed'
      ? syncFailures.find((code) => code === row.failureCode)
      : undefined,
  ...(row.stage === 'ready' && row.scale !== null && row.shiftMs !== null
    ? { alignment: { scale: row.scale, shiftMs: row.shiftMs } }
    : {}),
})
type Access = (
  req: FastifyRequest,
  item: string,
  source: string,
) => Promise<{
  api: Api
  userId: string
  data: BaseItemDto
  source: MediaSourceInfo
}>
type Params = { item: string; source: string; audio: string; subtitle: string }
export function addSubtitleSyncRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  access: Access,
) {
  const path = '/api/subtitle-sync/:item/:source/:audio/:subtitle'
  const running = new Map<string, AbortController>()
  app.addHook('onClose', async () => {
    for (const task of running.values()) task.abort()
  })
  async function resolve(request: FastifyRequest) {
    const p = request.params as Params
    if (
      ![p.item, p.source].every((v) => /^[a-f0-9-]{32,36}$/i.test(v)) ||
      ![p.audio, p.subtitle].every((v) => /^\d{1,5}$/.test(v))
    )
      throw new ApiError(400, 'INVALID_INPUT', 'Piste invalide.')
    const { api, userId, data, source } = await access(
      request,
      p.item,
      p.source,
    )
    const audio = source.MediaStreams?.find(
      (t) => t.Type === 'Audio' && t.Index === Number(p.audio),
    )
    const sub = source.MediaStreams?.find(
      (t) => t.Type === 'Subtitle' && t.Index === Number(p.subtitle),
    )
    if (!audio || !sub)
      throw new ApiError(404, 'MEDIA_NOT_FOUND', 'Piste indisponible.')
    const bitmap = /pgs|dvd|vobsub/i.test(sub.Codec || '')
    const styled = /^(ass|ssa)$/i.test(sub.Codec || '')
    const text = !bitmap && !styled && sub.IsTextSubtitleStream !== false
    const digest = createHash('sha256')
    digest.update(
      JSON.stringify([
        api.basePath,
        data.ServerId,
        data.Id,
        source.Id,
        source.ETag ?? data.Etag,
        source.Size,
        source.Path,
        source.RunTimeTicks,
        audio.Index,
        audio.Codec,
        audio.Language,
        audio.Title,
        sub.Index,
        sub.Path,
        sub.Language,
        sub.Codec,
      ]),
    )
    let subtitle: Buffer = Buffer.alloc(0)
    const extension = bitmap
      ? /pgs/i.test(sub.Codec || '')
        ? 'sup'
        : 'mks'
      : styled
        ? 'ass'
        : 'srt'
    try {
      const url = api.getUri(
        '/Videos/' +
          p.item +
          '/' +
          p.source +
          '/Subtitles/' +
          p.subtitle +
          '/0/Stream.' +
          extension,
      )
      const response = await fetch(url, {
        headers: { 'X-Emby-Token': api.accessToken },
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      })
      if (!response.ok || !response.body) {
        await response.body?.cancel()
        throw unavailable()
      }
      const chunks: Buffer[] = []
      let size = 0
      for await (const bytes of response.body) {
        size += bytes.byteLength
        if (size > (bitmap ? 64 : 4) * 1024 * 1024) throw unavailable()
        digest.update(bytes)
        if (text) chunks.push(Buffer.from(bytes))
      }
      subtitle = Buffer.concat(chunks)
    } catch {
      throw unavailable()
    }
    const fingerprint = digest.digest('hex')
    const where = { userId, fingerprint, engine: engineId }
    return {
      where,
      fingerprint,
      userId,
      subtitle,
      // The subtitle library can insert external tracks before embedded streams.
      // FFmpeg's a:N selector counts only audio streams physically in this file.
      audioOrdinal: (source.MediaStreams ?? []).filter(
        (track) =>
          track.Type === 'Audio' &&
          !track.IsExternal &&
          track.Index != null &&
          track.Index < Number(p.audio),
      ).length,
      token: api.accessToken,
      url: api.getUri('/Videos/' + p.item + '/stream', {
        static: true,
        mediaSourceId: p.source,
      }),
      eligible:
        text &&
        /^(mkv|mka|matroska|webm|mov|mp4|m4v|m4a|3gp|3g2|avi|mpeg|mpg|vob|ts|m2ts|mts|mpegts|asf|wmv|flv|ogg|ogv)(,|$)/i.test(
          source.Container ?? '',
        ) &&
        !audio.IsExternal &&
        Number(source.RunTimeTicks) > 0 &&
        Number(source.RunTimeTicks) / 10_000_000 <= maxSeconds(),
    }
  }
  async function recover() {
    const recovered = await db.subtitleAnalysis.updateManyAndReturn({
      select: { id: true, processedSeconds: true },
      where: {
        stage: { in: active },
        updatedAt: { lt: new Date(Date.now() - timeoutMs() - 60_000) },
      },
      data: { stage: 'failed', failureCode: 'interrupted' },
    })
    for (const job of recovered)
      app.log.warn(
        {
          jobId: job.id,
          processedSeconds: job.processedSeconds,
          failure: 'interrupted',
        },
        'Subtitle analysis interrupted before completion',
      )
  }
  app.get(path, async (request) => {
    const ctx = await resolve(request)
    await recover()
    const [pref, job, canAnalyze] = await Promise.all([
      db.subtitleTiming.findUnique({
        where: {
          userId_fingerprint: {
            userId: ctx.userId,
            fingerprint: ctx.fingerprint,
          },
        },
      }),
      db.subtitleAnalysis.findUnique({
        where: { userId_fingerprint_engine: ctx.where },
      }),
      ctx.eligible && engineAvailable(),
    ])
    return {
      fingerprint: ctx.fingerprint,
      revision: pref?.revision ?? 0,
      correction: pref
        ? {
            manualMs: pref.manualMs,
            automatic:
              pref.scale !== null && pref.shiftMs !== null
                ? { scale: pref.scale, shiftMs: pref.shiftMs }
                : null,
          }
        : originalTiming,
      canAnalyze,
      job: job ? view(job) : null,
    } satisfies SyncSnapshot
  })
  const schema = {
    type: 'object',
    required: ['fingerprint', 'revision', 'correction'],
    additionalProperties: false,
    properties: {
      fingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      revision: { type: 'integer', minimum: 0, maximum: 2147483646 },
      correction: {
        type: 'object',
        required: ['manualMs', 'automatic'],
        additionalProperties: false,
        properties: {
          manualMs: {
            type: 'integer',
            minimum: -maxResidualMs,
            maximum: maxResidualMs,
          },
          automatic: {
            anyOf: [
              { type: 'null' },
              {
                type: 'object',
                required: ['scale', 'shiftMs'],
                additionalProperties: false,
                properties: {
                  scale: { type: 'number', minimum: 0.93, maximum: 1.07 },
                  shiftMs: {
                    type: 'integer',
                    minimum: -180000,
                    maximum: 180000,
                  },
                },
              },
            ],
          },
        },
      },
    },
  }
  app.put(path, { schema: { body: schema } }, async (request) => {
    const ctx = await resolve(request)
    const { fingerprint, revision, correction } = request.body as {
      fingerprint: string
      revision: number
      correction: Correction
    }
    if (fingerprint !== ctx.fingerprint) throw conflict()
    const key = { userId: ctx.userId, fingerprint }
    const values = {
      manualMs: correction.manualMs,
      scale: correction.automatic?.scale ?? null,
      shiftMs: correction.automatic?.shiftMs ?? null,
      revision: revision + 1,
    }
    if (correction.automatic) {
      const alignment = {
        scale: correction.automatic.scale,
        shiftMs: correction.automatic.shiftMs,
      }
      const [saved, proposal] = await Promise.all([
        db.subtitleTiming.findFirst({ where: { ...key, ...alignment } }),
        db.subtitleAnalysis.findFirst({
          where: { ...ctx.where, ...alignment, stage: 'ready' },
        }),
      ])
      if (!saved && !proposal) throw conflict()
    }
    const change = revision
      ? await db.subtitleTiming.updateMany({
          where: { ...key, revision },
          data: values,
        })
      : await db.subtitleTiming.createMany({
          data: { ...key, ...values },
          skipDuplicates: true,
        })
    if (!change.count) throw conflict()
    return { revision: values.revision }
  })
  app.post(
    path + '/jobs',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const ctx = await resolve(request)
      const ticket = request.body as {
        fingerprint?: string
        requestId?: string
        draftRevision?: number
      } | null
      if (ticket?.fingerprint !== ctx.fingerprint) throw conflict()
      if (
        typeof ticket.requestId !== 'string' ||
        !/^[a-f0-9-]{36}$/i.test(ticket.requestId) ||
        !Number.isSafeInteger(ticket.draftRevision) ||
        (ticket.draftRevision ?? -1) < 0
      )
        throw new ApiError(400, 'INVALID_INPUT', 'Demande invalide.')
      if (!ctx.eligible || !(await engineAvailable())) throw unavailable()
      await recover()
      const { row, start } = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(87301461)`
        const prior = await tx.subtitleAnalysis.findUnique({
          where: { userId_fingerprint_engine: ctx.where },
        })
        if (
          prior &&
          (active.includes(prior.stage) ||
            (prior.stage === 'ready' &&
              (request.body as { reanalyze?: boolean }).reanalyze !== true))
        )
          return { row: prior, start: false }
        const count = await tx.subtitleAnalysis.count({
          where: { stage: { in: active } },
        })
        if (count >= limit('SUBTITLE_SYNC_CONCURRENCY', 1, 4))
          throw new ApiError(429, 'SYNC_BUSY', 'Analyse occupée.')
        const data = {
          id: randomUUID(),
          ...ctx.where,
          stage: 'queued',
          failureCode: null,
          processedSeconds: 0,
          scale: null,
          shiftMs: null,
        }
        const row = await tx.subtitleAnalysis.upsert({
          where: { userId_fingerprint_engine: ctx.where },
          create: data,
          update: data,
        })
        return { row, start: true }
      })
      if (start) {
        const controller = new AbortController()
        running.set(row.id, controller)
        const signal = AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(timeoutMs()),
        ])
        let lastStage: SyncStage = 'queued'
        let secondsRead = 0
        const update = async (
          stage: SyncStage,
          alignment?: { scale: number; shiftMs: number },
          processedSeconds?: number,
          failureCode?: SyncFailure,
        ) => {
          const changed = await db.subtitleAnalysis.updateMany({
            where: { id: row.id, stage: { in: active } },
            data: { stage, ...alignment, processedSeconds, failureCode },
          })
          if (!changed.count) controller.abort()
          lastStage = stage
          if (processedSeconds !== undefined) secondsRead = processedSeconds
          return changed.count
        }
        const check = setInterval(() => {
          void db.subtitleAnalysis
            .findUnique({ where: { id: row.id }, select: { stage: true } })
            .then(
              (value) => {
                if (!value || !active.includes(value.stage)) controller.abort()
              },
              () => controller.abort(),
            )
        }, 2000)
        void (async () => {
          try {
            await update('preparing')
            const result = await analyze(
              ctx,
              signal,
              async (stage, seconds) => {
                await update(stage, undefined, seconds)
              },
            )
            if (result === 'possible-cut') await update('possible-cut')
            else
              await update(result ? 'ready' : 'uncertain', result ?? undefined)
          } catch (error) {
            const failure = signal.aborted
              ? signal.reason?.name === 'TimeoutError'
                ? 'timeout'
                : 'interrupted'
              : error instanceof AnalysisFailure
                ? error.code
                : 'internal'
            const diagnostic = {
              jobId: row.id,
              stage: lastStage,
              processedSeconds: secondsRead,
              failure,
              ...(error instanceof AnalysisFailure ? error.diagnostic : {}),
            }
            // A user's cancellation already has a terminal state and is not an error.
            if (await update('failed', undefined, undefined, failure))
              request.log.error(diagnostic, 'Subtitle analysis failed')
          } finally {
            clearInterval(check)
            running.delete(row.id)
          }
        })().catch(() =>
          request.log.error(
            { jobId: row.id, stage: lastStage },
            'Could not persist subtitle analysis status',
          ),
        )
      }
      return {
        ...view(row),
        requestId: ticket.requestId,
        draftRevision: ticket.draftRevision,
      }
    },
  )
  for (const method of ['GET', 'DELETE'] as const) {
    app.route({
      method,
      url: path + '/jobs/:job',
      handler: async (request) => {
        const ctx = await resolve(request)
        const id = (request.params as { job: string }).job
        await recover()
        const row = await db.subtitleAnalysis.findFirst({
          where: { id, ...ctx.where },
        })
        if (!row) throw new ApiError(404, 'NOT_FOUND', 'Analyse indisponible.')
        if (method === 'DELETE' && active.includes(row.stage)) {
          const changed = await db.subtitleAnalysis.updateMany({
            where: { id, stage: { in: active } },
            data: { stage: 'cancelled' },
          })
          if (changed.count) {
            running.get(id)?.abort()
            return { id, stage: 'cancelled' }
          }
          return view(
            await db.subtitleAnalysis.findUniqueOrThrow({ where: { id } }),
          )
        }
        return view(row)
      },
    })
  }
}
