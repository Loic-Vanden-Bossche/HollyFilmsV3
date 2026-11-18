import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import Fastify, { LogController } from 'fastify'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { addSubtitleRoutes } from '../src/subtitles.ts'
import { engineAvailable, analyze } from '../src/subtitle-analysis.ts'
import type { ServerConfig } from '../src/config.ts'
import { setTimeout as wait } from 'node:timers/promises'

test(
  'authorized exact audio, global alignment, drift, edits, persistence and job races',
  { timeout: 120000 },
  async () => {
    const databaseUrl = process.env.HOLLYFILMS_TEST_DATABASE_URL
    assert.ok(databaseUrl)
    assert.ok(
      await engineAvailable(),
      'Configure SUBTITLE_SYNC_PYTHON and FFmpeg before running the integration test',
    )
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    })
    const dir = await mkdtemp(join(tmpdir(), 'hollyfilms-sync-fixture-'))
    const logs: string[] = []
    const app = Fastify({
      logger: {
        stream: {
          write: (line: string) => {
            logs.push(line)
          },
        },
      },
      logController: new LogController({ disableRequestLogging: true }),
    })
    const id = 'a'.repeat(32)
    const version = 'b'.repeat(32)
    let mediaStatus = 200
    let subs = '',
      media: Buffer = Buffer.alloc(0)
    let deny = false
    const jf = createServer((req, res) => {
      const url = new URL(req.url!, 'http://test')
      const token =
        req.headers['x-emby-token'] ||
        /Token="([^"]+)"/.exec(req.headers.authorization || '')?.[1]
      if (!['alice', 'bob'].includes(String(token))) {
        res.writeHead(401).end()
        return
      }
      if (url.pathname === '/Users/Me') {
        res.end(
          JSON.stringify({
            Id: token === 'alice' ? '1'.repeat(32) : '2'.repeat(32),
            Policy: { EnableMediaPlayback: true },
          }),
        )
        return
      }
      if (deny) {
        res.writeHead(403).end()
        return
      }
      if ([id, version].some((item) => url.pathname === '/Items/' + item)) {
        res.end(
          JSON.stringify({
            Id: url.pathname.split('/').at(-1),
            Type: 'Movie',
            MediaSources: [
              {
                Id: version,
                Size: media.length,
                ETag: 'fixture-v1',
                Container: 'mka',
                RunTimeTicks: 210e7,
                MediaStreams: [
                  { Type: 'Subtitle', Index: 0, IsExternal: true },
                  { Type: 'Audio', Index: 1 },
                  { Type: 'Audio', Index: 2 },
                  {
                    Type: 'Subtitle',
                    Index: 3,
                    IsTextSubtitleStream: true,
                    Codec: 'subrip',
                    IsExternal: true,
                  },
                ],
              },
            ],
          }),
        )
        return
      }
      if (url.pathname.endsWith('/3/0/Stream.srt')) {
        res.end(subs)
        return
      }
      if (url.pathname === '/Videos/' + id + '/stream') {
        if (mediaStatus !== 200) {
          res.writeHead(mediaStatus).end()
          return
        }
        const start = Number(
          /^bytes=(\d+)/.exec(req.headers.range || '')?.[1] || 0,
        )
        if (start >= media.length) {
          res.writeHead(416).end()
          return
        }
        res
          .writeHead(req.headers.range ? 206 : 200, {
            'Content-Type': 'audio/x-matroska',
            'Accept-Ranges': 'bytes',
            'Content-Length': media.length - start,
            ...(req.headers.range
              ? {
                  'Content-Range':
                    'bytes ' +
                    start +
                    '-' +
                    (media.length - 1) +
                    '/' +
                    media.length,
                }
              : {}),
          })
          .end(media.subarray(start))
        return
      }
      res.writeHead(404).end()
    })
    await new Promise<void>((resolve) => jf.listen(0, '127.0.0.1', resolve))
    const addr = jf.address()
    assert.ok(addr && typeof addr !== 'string')
    const jellyfinUrl = 'http://127.0.0.1:' + addr.port
    const endpoint = '/api/subtitle-sync/' + id + '/' + version + '/2/3'
    function request(
      method: 'GET' | 'PUT' | 'POST' | 'DELETE',
      suffix = '',
      payload?: object,
      user = 'alice',
    ) {
      return app.inject({
        method,
        url: endpoint + suffix,
        headers: { authorization: 'Bearer ' + user },
        payload,
      })
    }
    try {
      const ff = process.env.SUBTITLE_SYNC_FFMPEG || 'ffmpeg'
      const phrase = execFileSync(ff, [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'flite=text=Listen carefully and tell me when you hear the signal',
        '-f',
        's16le',
        '-ac',
        '1',
        '-ar',
        '16000',
        'pipe:1',
      ])
      const pieces: Buffer[] = [Buffer.alloc(32000 * 8)]
      const cues: { a: number; b: number }[] = []
      let time = 8
      for (let i = 0; i < 62; i++) {
        const duration = Math.min(
          phrase.length / 32000,
          0.7 + ((i * 17) % 23) / 12,
        )
        const part = phrase.subarray(0, 2 * Math.floor(duration * 16000))
        const gap = 0.3 + ((i * i * 13 + i * 9) % 29) / 10
        pieces.push(part, Buffer.alloc(2 * Math.round(gap * 16000)))
        cues.push({ a: time, b: time + part.length / 32000 })
        time += part.length / 32000 + Math.round(gap * 16000) / 16000
      }
      const stamp = (sec: number) =>
        new Date(Math.round(sec * 1000))
          .toISOString()
          .slice(11, 23)
          .replace('.', ',')
      const fixture = (scale: number, shift: number, cut = false) =>
        cues
          .map(({ a, b }, i) => {
            const offset = shift + (cut && i > 30 ? 6 : 0)
            return (
              i +
              1 +
              '\n' +
              stamp((a - offset) / scale) +
              ' --> ' +
              stamp((b - offset) / scale) +
              '\n对白 · مرحبا ' +
              i +
              '\n\n'
            )
          })
          .join('')
      await writeFile(join(dir, 'voice.raw'), Buffer.concat(pieces))
      execFileSync(ff, [
        '-v',
        'error',
        '-f',
        's16le',
        '-ar',
        '16000',
        '-ac',
        '1',
        '-i',
        join(dir, 'voice.raw'),
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=16000:cl=mono',
        '-map',
        '1:a',
        '-map',
        '0:a',
        '-c:a',
        'flac',
        '-shortest',
        join(dir, 'movie.mka'),
      ])
      media = await readFile(join(dir, 'movie.mka'))
      subs = fixture(1, 2)
      addSubtitleRoutes(app, db, {
        jellyfinUrl,
        jellyfinApiKey: 'unused',
      } as ServerConfig)
      const response = await request('GET')
      assert.equal(response.statusCode, 200, response.body)
      const snapshot = response.json()
      assert.equal(snapshot.canAnalyze, true)
      const ticket = {
        requestId: crypto.randomUUID(),
        draftRevision: 0,
        fingerprint: snapshot.fingerprint,
      }
      const save = {
        fingerprint: snapshot.fingerprint,
        revision: 0,
        correction: { automatic: null, manualMs: 200 },
      }
      const writes = await Promise.all([
        request('PUT', '', save),
        request('PUT', '', {
          ...save,
          correction: { automatic: null, manualMs: -200 },
        }),
      ])
      assert.deepEqual(writes.map((r) => r.statusCode).sort(), [200, 409])
      assert.equal((await request('GET')).json().revision, 1)
      assert.equal(
        (await request('GET', '', undefined, 'bob')).json().revision,
        0,
      )
      const jobs = await Promise.all([
        request('POST', '/jobs', ticket),
        request('POST', '/jobs', ticket),
      ])
      for (const res of jobs) assert.equal(res.statusCode, 200, res.body)
      assert.equal(jobs[0].json().id, jobs[1].json().id)
      const job = '/jobs/' + jobs[0].json().id
      assert.equal(
        (await request('GET', job, undefined, 'bob')).statusCode,
        404,
      )
      assert.equal((await request('DELETE', job)).json().stage, 'cancelled')
      const next = await request('POST', '/jobs', ticket)
      assert.notEqual(next.json().id, jobs[0].json().id)
      let result
      for (let i = 0; i < 400; i++) {
        const status = await request('GET', '/jobs/' + next.json().id)
        result = status.json()
        if (['ready', 'uncertain', 'failed'].includes(result.stage)) break
        await wait(100)
      }
      assert.equal(result.stage, 'ready', JSON.stringify(result))
      assert.ok(
        Math.abs(result.alignment.shiftMs - 2000) < 300,
        JSON.stringify(result),
      )
      assert.ok(Math.abs(result.alignment.scale - 1) < 0.002)
      assert.equal(
        (await request('POST', '/jobs', ticket)).json().id,
        next.json().id,
      )
      const approved = { manualMs: -500, automatic: result.alignment }
      assert.equal(
        (
          await request('PUT', '', {
            ...save,
            revision: 1,
            correction: approved,
          })
        ).statusCode,
        200,
      )
      assert.deepEqual((await request('GET')).json().correction, approved)
      const direct = (audioOrdinal: number, subtitle: string) =>
        analyze(
          {
            audioOrdinal,
            subtitle: Buffer.from(subtitle),
            url: jellyfinUrl + '/Videos/' + id + '/stream',
            token: 'alice',
          },
          AbortSignal.timeout(30000),
          async () => {},
        )
      const drift = await direct(1, fixture(25 / 24, 2))
      assert.ok(
        drift &&
          drift !== 'possible-cut' &&
          Math.abs(drift.scale - 25 / 24) < 0.002,
        JSON.stringify(drift),
      )
      assert.equal(
        await direct(1, fixture(1, 2, true)),
        'possible-cut',
        'different cut must be inconclusive',
      )
      assert.equal(
        await direct(0, subs),
        null,
        'silent first stream cannot yield this alignment',
      )
      assert.equal(
        await direct(1, '1\n00:00:05,000 --> 00:00:06,000\nOne line\n'),
        null,
        'sparse forced captions',
      )
      await db.subtitleAnalysis.update({
        where: { id: next.json().id },
        data: { stage: 'analyzing', updatedAt: new Date(0) },
      })
      assert.equal(
        (await request('GET')).json().job.stage,
        'failed',
        'abandoned jobs expire',
      )
      assert.equal((await request('GET')).json().job.failure, 'interrupted')
      mediaStatus = 403
      const denied = (await request('POST', '/jobs', ticket)).json()
      for (let i = 0; i < 100; i++) {
        if (
          (await request('GET', '/jobs/' + denied.id)).json().stage === 'failed'
        )
          break
        await wait(100)
      }
      assert.equal((await request('GET')).json().job.failure, 'source')
      const event = logs
        .map((line) => JSON.parse(line))
        .find(
          (event) => event.jobId === denied.id && event.failure === 'source',
        )
      assert.equal(event?.status, 403)
      assert.equal(event?.component, 'relay')
      assert.ok(!JSON.stringify(event).includes('alice'))
      mediaStatus = 200
      await assert.rejects(direct(9, subs), { code: 'audio' })
      await assert.rejects(direct(1, 'not an srt file'), { code: 'subtitle' })
      subs = fixture(1, 3)
      assert.equal(
        (await request('GET')).json().revision,
        0,
        'replacement at same path invalidates preference',
      )
      assert.equal(
        (await request('PUT', '', { ...save, revision: 1 })).statusCode,
        409,
      )
      deny = true
      assert.equal((await request('GET')).statusCode, 404)
    } finally {
      await app.close()
      jf.closeAllConnections()
      await new Promise<void>((resolve) => jf.close(() => resolve()))
      await db.$disconnect()
      await rm(dir, { recursive: true, force: true })
    }
  },
)
