import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js'
import { getSubtitleApi } from '@jellyfin/sdk/lib/utils/api/subtitle-api.js'
import { getLocalizationApi } from '@jellyfin/sdk/lib/utils/api/localization-api.js'
import type { Api } from '@jellyfin/sdk'
import type {
  BaseItemDto,
  MediaStream,
  MediaSourceInfo,
  RemoteSubtitleInfo,
} from '@jellyfin/sdk/lib/generated-client/index.js'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import type {
  SubtitleCandidate,
  SubtitleLanguage,
  SubtitleLibrary,
  SubtitleRequest,
} from '@hollyfilms/shared/subtitles'
import type {
  PrismaClient,
  SubtitleRequest as StoredRequest,
} from './generated/prisma/client.ts'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'

const normalize = (id: string) => id.replaceAll('-', '').toLowerCase()
const id = { type: 'string', pattern: '^[a-fA-F0-9-]{32,36}$' }
const language = { type: 'string', pattern: '^[a-z]{3}$' }
const mediaParams = { type: 'object', required: ['id'], properties: { id } }
const sourceQuery = {
  type: 'object',
  required: ['sourceId', 'language'],
  properties: {
    sourceId: id,
    language,
    perfect: { type: 'string', enum: ['true', 'false'] },
  },
}
const aliases: Record<string, string> = {
  fre: 'fra',
  chi: 'zho',
  ger: 'deu',
  dut: 'nld',
  cze: 'ces',
  gre: 'ell',
  rum: 'ron',
  per: 'fas',
  slo: 'slk',
  alb: 'sqi',
  arm: 'hye',
  baq: 'eus',
  bur: 'mya',
  geo: 'kat',
  ice: 'isl',
  mac: 'mkd',
  may: 'msa',
  tib: 'bod',
  wel: 'cym',
}
const iso = (value = '') => aliases[value.toLowerCase()] ?? value.toLowerCase()
const options = { timeout: 7000, maxRedirects: 0 }
const code = (error: unknown) =>
  (error as { response?: { status?: number }; status?: number })?.response
    ?.status ?? (error as { status?: number })?.status
const subtitleStreams = (source: MediaSourceInfo) =>
  (source.MediaStreams ?? []).filter(
    (track) => track.Type === 'Subtitle' && track.Index != null,
  )
const fingerprint = (track: MediaStream) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        track.Path ?? track.Index,
        iso(track.Language ?? ''),
        track.Codec,
      ]),
    )
    .digest('hex')
function versions(item: BaseItemDto): MediaSourceInfo[] {
  return item.MediaSources?.length
    ? item.MediaSources
    : [{ Id: item.Id, Name: item.Name, MediaStreams: item.MediaStreams }]
}
const view = (row: StoredRequest, administrator: boolean): SubtitleRequest => ({
  id: row.id,
  itemId: row.itemId,
  sourceId: row.sourceId,
  itemName: row.itemName,
  sourceName: row.sourceName,
  language: row.language,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  decidedAt: row.decidedAt?.toISOString(),
  lastError: row.lastError ?? undefined,
  ...(administrator
    ? {
        requester: row.requesterName,
        decidedBy: row.decidedByName ?? undefined,
      }
    : {}),
})

export function addSubtitleRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  config: ServerConfig,
) {
  const server = createJellyfinApi(
    config.jellyfinUrl,
    'hollyfilms-subtitles',
    config.jellyfinApiKey,
  )
  let cultures: { expires: number; items: SubtitleLanguage[] } | undefined
  async function languages() {
    if (cultures && cultures.expires > Date.now()) return cultures.items
    try {
      const { data } = await getLocalizationApi(server).getCultures(options)
      const items = [
        ...new Map(
          data.flatMap((entry) => {
            const key = iso(
              entry.ThreeLetterISOLanguageName ??
                entry.ThreeLetterISOLanguageNames?.[0],
            )
            return /^[a-z]{3}$/.test(key)
              ? [
                  [
                    key,
                    {
                      code: key,
                      name: entry.DisplayName || entry.Name || key,
                      iso2: entry.TwoLetterISOLanguageName,
                    },
                  ] as const,
                ]
              : []
          }),
        ).values(),
      ]
      cultures = { items, expires: Date.now() + 300000 }
      return items
    } catch {
      throw new ApiError(
        503,
        'SUBTITLE_UNAVAILABLE',
        'Le service de sous-titres est indisponible.',
      )
    }
  }
  async function validateLanguage(value: string) {
    const normalized = iso(value)
    if (!(await languages()).some((entry) => entry.code === normalized))
      throw new ApiError(400, 'INVALID_INPUT', 'Langue invalide.')
    return normalized
  }
  async function authorize(request: FastifyRequest, administrator = false) {
    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    )?.[1]
    if (!token)
      throw new ApiError(401, 'AUTH_REQUIRED', 'Reconnecte-toi pour continuer.')
    const device = request.headers['x-hollyfilms-device']
    const api = createJellyfinApi(
      config.jellyfinUrl,
      typeof device === 'string' && /^[a-z\d-]{1,128}$/i.test(device)
        ? device
        : undefined,
      token,
    )
    try {
      const { data } = await getUserApi(api).getCurrentUser(options)
      if (!data.Id || data.Policy?.IsDisabled)
        throw new ApiError(
          403,
          'ACCESS_DENIED',
          'Tu n’as pas accès à cette ressource.',
        )
      if (administrator && !data.Policy?.IsAdministrator)
        throw new ApiError(
          403,
          'ADMIN_REQUIRED',
          'Un compte administrateur est requis.',
        )
      return {
        api,
        id: normalize(data.Id),
        name: data.Name || data.Id,
        administrator: data.Policy?.IsAdministrator === true,
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        [401, 403].includes(code(error) ?? 0) ? 401 : 503,
        [401, 403].includes(code(error) ?? 0)
          ? 'AUTH_REQUIRED'
          : 'JELLYFIN_UNAVAILABLE',
        'Impossible de vérifier la session.',
      )
    }
  }
  async function item(api: Api, itemId: string, userId?: string) {
    if (!/^[a-f0-9]{32}$/.test(normalize(itemId)))
      throw new ApiError(400, 'INVALID_INPUT', 'Identifiant de média invalide.')
    try {
      const { data } = await getLibraryApi(api).getItem(
        { itemId: normalize(itemId), userId },
        options,
      )
      if (
        !data.Id ||
        normalize(data.Id) !== normalize(itemId) ||
        !['Movie', 'Episode'].includes(data.Type ?? '')
      )
        throw new ApiError(
          404,
          'MEDIA_NOT_FOUND',
          'Ce média est indisponible ou tu n’y as pas accès.',
        )
      return data
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        [401, 403, 404].includes(code(error) ?? 0) ? 404 : 503,
        [401, 403, 404].includes(code(error) ?? 0)
          ? 'MEDIA_NOT_FOUND'
          : 'JELLYFIN_UNAVAILABLE',
        'Impossible de charger le média.',
      )
    }
  }
  async function accessibleSource(
    identity: Awaited<ReturnType<typeof authorize>>,
    itemId: string,
    sourceId: string,
  ) {
    const data = await item(identity.api, itemId, identity.id)
    const source = versions(data).find(
      (source) => source.Id && normalize(source.Id) === normalize(sourceId),
    )
    if (!source?.Id)
      throw new ApiError(
        404,
        'MEDIA_NOT_FOUND',
        'Cette version du média est indisponible.',
      )
    // A merged movie can expose another Video item for an alternate edition.
    await item(identity.api, source.Id, identity.id)
    return { data, source }
  }
  async function search(sourceId: string, lang: string, perfect = false) {
    try {
      return (
        await getSubtitleApi(server).searchRemoteSubtitles(
          { itemId: sourceId, language: lang, isPerfectMatch: perfect },
          { ...options, timeout: 25000 },
        )
      ).data
    } catch {
      throw new ApiError(
        503,
        'SUBTITLE_UNAVAILABLE',
        'Le service de sous-titres est indisponible.',
      )
    }
  }
  function candidate(row: RemoteSubtitleInfo): SubtitleCandidate {
    return {
      id: row.Id!,
      name: row.Name || row.ProviderName || row.Id!,
      provider: row.ProviderName || '',
      language: row.ThreeLetterISOLanguageName ?? undefined,
      format: row.Format ?? undefined,
      author: row.Author ?? undefined,
      rating: row.CommunityRating ?? undefined,
      downloads: row.DownloadCount ?? undefined,
      hashMatch: row.IsHashMatch === true,
      forced: row.Forced === true,
      hearingImpaired: row.HearingImpaired === true,
      machineTranslated:
        row.MachineTranslated === true || row.AiTranslated === true,
    }
  }
  async function reconcile(row: StoredRequest) {
    if (row.status === 'PENDING') {
      const operation = await db.subtitleRequest.findFirst({
        where: {
          sourceId: row.sourceId,
          language: row.language,
          status: 'DOWNLOADING',
        },
      })
      if (operation) await reconcile(operation)
      return (
        (await db.subtitleRequest.findUnique({ where: { id: row.id } })) ?? row
      )
    }
    if (row.status !== 'DOWNLOADING' || !row.startedAt) return row
    try {
      const data = await item(
        server,
        row.sourceId,
        row.decidedBy ?? row.requesterId,
      )
      const source = versions(data).find(
        (entry) => normalize(entry.Id ?? '') === row.sourceId,
      )
      const baseline = new Set<string>(JSON.parse(row.baseline || '[]'))
      const found =
        source &&
        subtitleStreams(source).some(
          (track) =>
            track.IsExternal &&
            iso(track.Language ?? '') === row.language &&
            !baseline.has(fingerprint(track)),
        )
      if (found) {
        await db.subtitleRequest.updateMany({
          where: {
            id: row.id,
            status: 'DOWNLOADING',
            startedAt: row.startedAt,
          },
          data: { status: 'DOWNLOADED', activeKey: null, lastError: null },
        })
        // The same installed track also fulfils other pending requests for this version/language.
        await db.subtitleRequest.updateMany({
          where: {
            sourceId: row.sourceId,
            language: row.language,
            status: 'PENDING',
          },
          data: {
            status: 'DOWNLOADED',
            activeKey: null,
            decidedAt: row.decidedAt,
            decidedBy: row.decidedBy,
            decidedByName: row.decidedByName,
            lastError: null,
          },
        })
      } else if (Date.now() - row.startedAt.getTime() > 120000) {
        await db.subtitleRequest.updateMany({
          where: {
            id: row.id,
            status: 'DOWNLOADING',
            startedAt: row.startedAt,
          },
          data: { status: 'FAILED', lastError: 'SUBTITLE_UNCONFIRMED' },
        })
      }
    } catch {
      if (Date.now() - row.startedAt.getTime() > 120000)
        await db.subtitleRequest.updateMany({
          where: {
            id: row.id,
            status: 'DOWNLOADING',
            startedAt: row.startedAt,
          },
          data: { status: 'FAILED', lastError: 'SUBTITLE_UNCONFIRMED' },
        })
    }
    return (
      (await db.subtitleRequest.findUnique({ where: { id: row.id } })) ?? row
    )
  }
  const limited = { rateLimit: { max: 90, timeWindow: '1 minute' } }
  app.get<{ Params: { id: string } }>(
    '/api/media/:id/subtitles',
    { config: limited, schema: { params: mediaParams } },
    async (request): Promise<SubtitleLibrary> => {
      const identity = await authorize(request)
      const data = await item(identity.api, request.params.id, identity.id)
      const rows = await db.subtitleRequest.findMany({
        where: {
          sourceId: {
            in: versions(data).flatMap((source) =>
              source.Id ? [normalize(source.Id)] : [],
            ),
          },
          ...(!identity.administrator ? { requesterId: identity.id } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      const checked: StoredRequest[] = []
      for (const row of rows) checked.push(await reconcile(row))
      const fresh = checked.some(
        (row, index) => row.status !== rows[index].status,
      )
        ? await item(identity.api, request.params.id, identity.id)
        : data
      return {
        administrator: identity.administrator,
        languages: await languages(),
        versions: versions(fresh).flatMap((source) =>
          source.Id
            ? [
                {
                  id: normalize(source.Id),
                  name: source.Name || data.Name || source.Id,
                  tracks: subtitleStreams(source).map((track) => ({
                    index: track.Index!,
                    title:
                      track.DisplayTitle ||
                      track.Title ||
                      track.Language ||
                      track.Codec ||
                      String(track.Index),
                    language: track.Language ?? undefined,
                    codec: track.Codec ?? undefined,
                    external: track.IsExternal === true,
                  })),
                },
              ]
            : [],
        ),
        requests: checked.map((row) => view(row, identity.administrator)),
      }
    },
  )
  app.get<{
    Params: { id: string }
    Querystring: { sourceId: string; language: string; perfect?: string }
  }>(
    '/api/admin/media/:id/subtitles/search',
    {
      config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
      schema: { params: mediaParams, querystring: sourceQuery },
    },
    async (request) => {
      const identity = await authorize(request, true)
      const { source } = await accessibleSource(
        identity,
        request.params.id,
        request.query.sourceId,
      )
      const lang = await validateLanguage(request.query.language)
      return {
        items: (
          await search(source.Id!, lang, request.query.perfect === 'true')
        )
          .filter((row) => !!row.Id)
          .slice(0, 100)
          .map(candidate),
      }
    },
  )
  app.post<{
    Params: { id: string }
    Body: { sourceId: string; language: string }
  }>(
    '/api/media/:id/subtitle-requests',
    {
      config: { rateLimit: { max: 12, timeWindow: '1 minute' } },
      schema: {
        params: mediaParams,
        body: {
          type: 'object',
          required: ['sourceId', 'language'],
          properties: { sourceId: id, language },
        },
      },
    },
    async (request) => {
      const identity = await authorize(request)
      const { data, source } = await accessibleSource(
        identity,
        request.params.id,
        request.body.sourceId,
      )
      const lang = await validateLanguage(request.body.language)
      const activeKey = `${identity.id}:${normalize(source.Id!)}:${lang}`
      const row = await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`subtitle:${normalize(source.Id!)}`}, 0))`
          return tx.subtitleRequest.upsert({
            where: { activeKey },
            update: {},
            create: {
              activeKey,
              requesterId: identity.id,
              requesterName: identity.name,
              itemId: normalize(data.Id!),
              sourceId: normalize(source.Id!),
              itemName: data.Name || data.Id!,
              sourceName: source.Name || data.Name || source.Id!,
              language: lang,
            },
          })
        },
        { maxWait: 5000, timeout: 20000 },
      )
      return view(row, identity.administrator)
    },
  )
  for (const administrator of [false, true])
    app.get<{
      Querystring: {
        page?: string
        status?:
          'PENDING' | 'DOWNLOADING' | 'DOWNLOADED' | 'REJECTED' | 'FAILED'
      }
    }>(
      administrator ? '/api/admin/subtitle-requests' : '/api/subtitle-requests',
      {
        config: limited,
        schema: {
          querystring: {
            type: 'object',
            properties: {
              page: { type: 'string', pattern: '^[1-9][0-9]{0,5}$' },
              status: {
                type: 'string',
                enum: [
                  'PENDING',
                  'DOWNLOADING',
                  'DOWNLOADED',
                  'REJECTED',
                  'FAILED',
                ],
              },
            },
          },
        },
      },
      async (request) => {
        const identity = await authorize(request, administrator)
        const page = Number(request.query.page ?? 1)
        const where = {
          ...(!administrator ? { requesterId: identity.id } : {}),
          ...(request.query.status ? { status: request.query.status } : {}),
        }
        const rows = await db.subtitleRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 20,
          skip: (page - 1) * 20,
        })
        const checked: StoredRequest[] = []
        for (const row of rows) checked.push(await reconcile(row))
        // Re-read after reconciliation so filters and totals reflect confirmed downloads.
        const [items, total] = await Promise.all([
          db.subtitleRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 20,
            skip: (page - 1) * 20,
          }),
          db.subtitleRequest.count({ where }),
        ])
        return {
          items: items.map((row) => view(row, administrator)),
          page,
          pages: Math.ceil(total / 20),
          total,
        }
      },
    )
  app.post<{ Params: { id: string } }>(
    '/api/admin/subtitle-requests/:id/reject',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request) => {
      const identity = await authorize(request, true)
      const row = await db.subtitleRequest.findUnique({
        where: { id: request.params.id },
      })
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable.')
      const updated = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`subtitle:${row.sourceId}`}, 0))`
        return tx.subtitleRequest.updateMany({
          where: { id: row.id, status: { in: ['PENDING', 'FAILED'] } },
          data: {
            status: 'REJECTED',
            activeKey: null,
            decidedAt: new Date(),
            decidedBy: identity.id,
            decidedByName: identity.name,
            lastError: null,
          },
        })
      })
      if (!updated.count)
        throw new ApiError(
          409,
          'REQUEST_CHANGED',
          'Cette demande a déjà été traitée. Actualise la page.',
        )
      return { ok: true }
    },
  )
  app.post<{
    Params: { id: string }
    Body: {
      sourceId: string
      language: string
      remoteId: string
      requestId?: string
    }
  }>(
    '/api/admin/media/:id/subtitles/download',
    {
      config: { rateLimit: { max: 12, timeWindow: '1 minute' } },
      schema: {
        params: mediaParams,
        body: {
          type: 'object',
          required: ['sourceId', 'language', 'remoteId'],
          properties: {
            sourceId: id,
            language,
            remoteId: { type: 'string', minLength: 1, maxLength: 4096 },
            requestId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const identity = await authorize(request, true)
      const { data, source } = await accessibleSource(
        identity,
        request.params.id,
        request.body.sourceId,
      )
      const sourceId = normalize(source.Id!)
      const lang = await validateLanguage(request.body.language)
      const valid = (await search(sourceId, lang)).find(
        (row) =>
          row.Id === request.body.remoteId &&
          (!row.ThreeLetterISOLanguageName ||
            iso(row.ThreeLetterISOLanguageName) === lang),
      )
      if (!valid)
        throw new ApiError(
          409,
          'SUBTITLE_SELECTION_EXPIRED',
          'Ce sous-titre n’est plus disponible. Relance la recherche.',
        )
      const record = await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`subtitle:${sourceId}`}, 0))`
          if (
            await tx.subtitleRequest.findFirst({
              where: { sourceId, status: 'DOWNLOADING' },
            })
          )
            throw new ApiError(
              409,
              'SUBTITLE_BUSY',
              'Un téléchargement est déjà en cours pour cette version.',
            )
          const activeKey = `${identity.id}:${sourceId}:${lang}`
          const previous = await tx.subtitleRequest.findUnique({
            where: request.body.requestId
              ? { id: request.body.requestId }
              : { activeKey },
          })
          if (
            request.body.requestId &&
            (!previous ||
              previous.itemId !== normalize(data.Id!) ||
              previous.sourceId !== sourceId ||
              previous.language !== lang ||
              !['PENDING', 'FAILED'].includes(previous.status))
          )
            throw new ApiError(
              409,
              'REQUEST_CHANGED',
              'Cette demande a déjà été traitée. Actualise la page.',
            )
          const current = await item(server, sourceId, identity.id)
          const baseline = JSON.stringify(
            versions(current).flatMap((entry) =>
              subtitleStreams(entry)
                .filter((track) => track.IsExternal)
                .map(fingerprint),
            ),
          )
          const values = {
            status: 'DOWNLOADING' as const,
            startedAt: new Date(),
            decidedAt: new Date(),
            decidedBy: identity.id,
            decidedByName: identity.name,
            remoteId: valid.Id!,
            baseline,
            lastError: null,
          }
          return previous
            ? tx.subtitleRequest.update({
                where: { id: previous.id },
                data: values,
              })
            : tx.subtitleRequest.create({
                data: {
                  ...values,
                  activeKey,
                  itemId: normalize(data.Id!),
                  sourceId,
                  itemName: data.Name || data.Id!,
                  sourceName: source.Name || data.Name || source.Id!,
                  language: lang,
                  requesterId: identity.id,
                  requesterName: identity.name,
                },
              })
        },
        { maxWait: 5000, timeout: 20000 },
      )
      try {
        await getSubtitleApi(server).downloadRemoteSubtitles(
          { itemId: sourceId, subtitleId: valid.Id! },
          { ...options, timeout: 30000 },
        )
      } catch (error) {
        // A timeout may happen after the file was saved. Keep the durable operation
        // reconcilable instead of issuing another download or claiming success.
        if ([401, 403, 404].includes(code(error) ?? 0))
          await db.subtitleRequest.updateMany({
            where: { id: record.id, startedAt: record.startedAt },
            data: { status: 'FAILED', lastError: 'SUBTITLE_UNAVAILABLE' },
          })
      }
      let result = await reconcile(record)
      for (
        let attempt = 0;
        result.status === 'DOWNLOADING' && attempt < 3;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 350))
        result = await reconcile(result)
      }
      return reply
        .code(result.status === 'DOWNLOADING' ? 202 : 200)
        .send(view(result, true))
    },
  )
}
