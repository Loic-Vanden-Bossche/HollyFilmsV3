import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { createApp } from '../src/app.ts'
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/index.js'

const movie = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  edition = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  hidden = 'cccccccccccccccccccccccccccccccc'
const member = '11111111111111111111111111111111',
  other = '22222222222222222222222222222222',
  admin = '33333333333333333333333333333333'
test('subtitle requests, verified provider downloads, approval and crash recovery', async (t) => {
  const databaseUrl = process.env.HOLLYFILMS_TEST_DATABASE_URL
  assert.ok(
    databaseUrl,
    'Run yarn test:subtitles with its isolated PostgreSQL container',
  )
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })
  assert.equal(await db.subtitleRequest.count(), 0)
  const streams = new Map<string, MediaStream[]>(
    [movie, edition].map((id) => [
      id,
      [
        {
          Type: 'Subtitle',
          Index: 2,
          Language: 'eng',
          Codec: 'subrip',
          IsExternal: true,
          Path: `/private/${id}/english.srt`,
          DisplayTitle: 'English',
        },
      ],
    ]),
  )
  let downloads = 0,
    searches = 0,
    noFile = false,
    providerUnavailable = false,
    refreshAfter = 0,
    pendingLanguage = ''
  let pendingSource = '',
    currentRole = 'member'
  const jf = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const url = new URL(req.url!, 'http://test')
    const token = /Token="([^"]+)"/.exec(req.headers.authorization ?? '')?.[1]
    if (
      !['member', 'other', 'admin', 'disabled', 'server-key'].includes(
        token ?? '',
      )
    ) {
      res.writeHead(401).end('{}')
      return
    }
    if (url.pathname === '/Users/Me') {
      res.end(
        JSON.stringify({
          Id: token === 'admin' ? admin : token === 'other' ? other : member,
          Name: token,
          Policy: {
            IsAdministrator: token === 'admin' && currentRole === 'admin',
            IsDisabled: token === 'disabled',
          },
        }),
      )
      return
    }
    if (url.pathname === '/Localization/Cultures') {
      res.end(
        JSON.stringify([
          {
            Name: 'fr',
            DisplayName: 'French',
            TwoLetterISOLanguageName: 'fr',
            ThreeLetterISOLanguageName: 'fra',
          },
          {
            Name: 'zh',
            DisplayName: 'Chinese',
            TwoLetterISOLanguageName: 'zh',
            ThreeLetterISOLanguageName: 'zho',
          },
          {
            Name: 'en',
            DisplayName: 'English',
            TwoLetterISOLanguageName: 'en',
            ThreeLetterISOLanguageName: 'eng',
          },
        ]),
      )
      return
    }
    const search = /^\/Items\/([a-f0-9]+)\/RemoteSearch\/Subtitles\/(.+)$/.exec(
      url.pathname,
    )
    if (search) {
      assert.equal(
        token,
        'server-key',
        'Provider credentials/management token stay server-side',
      )
      if (req.method === 'POST') {
        downloads++
        const lang = search[2].split('_')[1]
        pendingLanguage = lang
        pendingSource = search[1]
        refreshAfter = 2
        res.writeHead(204).end()
        return
      }
      searches++
      if (providerUnavailable) {
        res.writeHead(503).end('{}')
        return
      }
      res.end(
        JSON.stringify([
          {
            Id: 'provider_' + search[2],
            Name: 'Matching release',
            ThreeLetterISOLanguageName: search[2],
            ProviderName: 'Open Subtitles',
            Format: 'srt',
            IsHashMatch: true,
            DownloadCount: 17,
            ApiKey: 'must-never-leak',
          },
        ]),
      )
      return
    }
    const match = /^\/Items\/([a-f0-9]+)$/.exec(url.pathname)
    if (match) {
      assert.ok(
        url.searchParams.get('userId'),
        'Jellyfin 12 requires user context for getItem, including API-key reads',
      )
      if (![movie, edition].includes(match[1])) {
        res.writeHead(404).end('{}')
        return
      }
      if (
        pendingSource === match[1] &&
        refreshAfter > 0 &&
        --refreshAfter === 0 &&
        !noFile
      ) {
        streams.get(pendingSource)!.push({
          Type: 'Subtitle',
          Index: streams.get(pendingSource)!.length + 2,
          Language: pendingLanguage,
          Codec: 'subrip',
          IsExternal: true,
          Path: `/private/${pendingSource}/${pendingLanguage}-${downloads}.srt`,
          DisplayTitle: pendingLanguage,
        })
      }
      res.end(
        JSON.stringify({
          Id: match[1],
          Name: 'Test movie',
          Type: 'Movie',
          MediaSources: (match[1] === movie ? [movie, edition] : [edition]).map(
            (id) => ({
              Id: id,
              Name: id === edition ? 'Extended cut' : 'Cinema',
              MediaStreams: streams.get(id),
            }),
          ),
        }),
      )
      return
    }
    res.writeHead(404).end('{}')
  })
  await new Promise<void>((resolve) => jf.listen(0, '127.0.0.1', resolve))
  const address = jf.address()
  assert.ok(address && typeof address !== 'string')
  const config = {
    databaseUrl,
    jellyfinUrl: `http://127.0.0.1:${address.port}`,
    jellyfinApiKey: 'server-key',
    publicOrigin: 'http://localhost:5173',
  }
  let app = await createApp(config)
  t.after(async () => {
    await app.close()
    await db.$disconnect()
    await new Promise<void>((resolve) => jf.close(() => resolve()))
  })
  const headers = (token = 'member') => ({
    authorization: `Bearer ${token}`,
    'x-hollyfilms-device': 'subtitles-test-device',
  })
  const library = (token = 'member', id = movie) =>
    app.inject({ url: `/api/media/${id}/subtitles`, headers: headers(token) })
  const ask = (token = 'member', sourceId = movie, language = 'fra') =>
    app.inject({
      method: 'POST',
      url: `/api/media/${movie}/subtitle-requests`,
      headers: headers(token),
      payload: { sourceId, language, requesterId: admin, status: 'DOWNLOADED' },
    })
  const install = (
    requestId?: string,
    language = 'fra',
    sourceId = movie,
    remoteId = 'provider_' + language,
    token = 'admin',
  ) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/media/${movie}/subtitles/download`,
      headers: headers(token),
      payload: { sourceId, language, remoteId, requestId },
    })
  let requestId = ''
  await t.test(
    'authentication, media access and administrative privileges precede all provider calls',
    async () => {
      assert.equal(
        (await app.inject({ url: `/api/media/${movie}/subtitles` })).statusCode,
        401,
      )
      assert.equal((await library('disabled')).statusCode, 403)
      assert.equal((await library('member', hidden)).statusCode, 404)
      assert.equal(
        (
          await app.inject({
            url: `/api/admin/media/${movie}/subtitles/search?sourceId=${movie}&language=fra`,
            headers: headers(),
          })
        ).statusCode,
        403,
      )
      assert.equal(
        (await install(undefined, 'fra', movie, 'provider_fra', 'member'))
          .statusCode,
        403,
      )
      assert.equal(searches, 0)
      assert.equal(downloads, 0)
      const data = await library()
      assert.equal(data.json().administrator, false)
      assert.equal(data.json().versions.length, 2)
      assert.ok(
        !data.body.includes('/private/') && !data.body.includes('server-key'),
      )
    },
  )
  await t.test(
    'normal requests remain pending, ignore spoofed fields and deduplicate concurrently',
    async () => {
      const responses = await Promise.all([ask(), ask()])
      for (const response of responses) {
        assert.equal(response.statusCode, 200, response.body)
        assert.equal(response.json().status, 'PENDING')
        assert.equal(response.json().requester, undefined)
      }
      requestId = responses[0].json().id
      assert.equal(responses[1].json().id, requestId)
      assert.equal(await db.subtitleRequest.count(), 1)
      assert.equal(
        (
          await db.subtitleRequest.findUniqueOrThrow({
            where: { id: requestId },
          })
        ).requesterId,
        member,
      )
      assert.equal(downloads, 0)
      assert.equal((await ask('member', hidden)).statusCode, 404)
      assert.equal((await ask('member', movie, 'xxx')).statusCode, 400)
    },
  )
  await t.test(
    'request history survives API restart and stays scoped to its owner',
    async () => {
      await app.close()
      app = await createApp(config)
      const own = await app.inject({
        url: '/api/subtitle-requests?requesterId=' + admin,
        headers: headers(),
      })
      assert.equal(own.json().total, 1)
      assert.equal(own.json().items[0].id, requestId)
      assert.equal(
        (
          await app.inject({
            url: '/api/subtitle-requests',
            headers: headers('other'),
          })
        ).json().items.length,
        0,
      )
      assert.equal((await library('other')).json().requests.length, 0)
      assert.equal(
        (
          await app.inject({
            url: '/api/admin/subtitle-requests',
            headers: headers(),
          })
        ).statusCode,
        403,
      )
    },
  )
  await t.test(
    'administrators search installed Jellyfin providers, validate selection and exact version/language',
    async () => {
      currentRole = 'admin'
      const response = await app.inject({
        url: `/api/admin/media/${movie}/subtitles/search?sourceId=${movie}&language=fra&perfect=true`,
        headers: headers('admin'),
      })
      assert.equal(response.statusCode, 200, response.body)
      assert.equal(response.json().items[0].provider, 'Open Subtitles')
      assert.ok(!response.body.includes('must-never-leak'))
      assert.equal(
        (await install(requestId, 'fra', movie, 'arbitrary-url')).json().code,
        'SUBTITLE_SELECTION_EXPIRED',
      )
      assert.equal((await install(requestId, 'zho')).statusCode, 409)
      assert.equal((await install(requestId, 'fra', edition)).statusCode, 409)
      assert.equal(downloads, 0)
    },
  )
  await t.test(
    'approval only succeeds once the new external track is present and records the decision',
    async () => {
      const response = await install(requestId)
      assert.equal(response.statusCode, 200, response.body)
      assert.equal(response.json().status, 'DOWNLOADED')
      assert.equal(downloads, 1)
      const record = await db.subtitleRequest.findUniqueOrThrow({
        where: { id: requestId },
      })
      assert.equal(record.decidedBy, admin)
      assert.ok(record.decidedAt)
      const data = (await library()).json()
      assert.ok(
        data.versions[0].tracks.some(
          (track: { language: string }) => track.language === 'fra',
        ),
      )
      assert.ok(
        !JSON.stringify(data).includes('provider_fra') &&
          !JSON.stringify(data).includes('baseline'),
      )
      assert.equal((await install(requestId)).statusCode, 409)
      assert.equal(downloads, 1)
      await Promise.all([library(), library()])
      const notices = await db.notification.findMany({
        where: { userId: member },
      })
      assert.deepEqual(
        notices.map(({ title, body, url }) => [title, body, url]),
        [
          [
            'Sous-titres disponibles',
            'Test movie',
            '/requests?section=subtitles',
          ],
        ],
      )
    },
  )
  await t.test(
    '204 without a file never becomes success; stale operations recover after restart',
    async () => {
      noFile = true
      const pending = await ask('member', movie, 'zho')
      const response = await install(pending.json().id, 'zho')
      assert.equal(response.statusCode, 202, response.body)
      assert.equal(response.json().status, 'DOWNLOADING')
      await app.close()
      app = await createApp(config)
      assert.equal(
        (await library())
          .json()
          .requests.find((row: { id: string }) => row.id === pending.json().id)
          .status,
        'DOWNLOADING',
      )
      await db.subtitleRequest.update({
        where: { id: pending.json().id },
        data: { startedAt: new Date(Date.now() - 121000) },
      })
      const reconciled = (await library())
        .json()
        .requests.find((row: { id: string }) => row.id === pending.json().id)
      assert.equal(reconciled.status, 'FAILED')
      assert.equal(reconciled.lastError, 'SUBTITLE_UNCONFIRMED')
      noFile = false
      const retry = await install(pending.json().id, 'zho')
      assert.equal(retry.json().status, 'DOWNLOADED')
    },
  )
  await t.test(
    'refusal, renewed requests and role revocation are enforced server-side',
    async () => {
      const pending = (await ask('other', edition)).json()
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: `/api/admin/subtitle-requests/${pending.id}/reject`,
            headers: headers(),
          })
        ).statusCode,
        403,
      )
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: `/api/admin/subtitle-requests/${pending.id}/reject`,
            headers: headers('admin'),
          })
        ).statusCode,
        200,
      )
      assert.equal(
        (
          await db.subtitleRequest.findUniqueOrThrow({
            where: { id: pending.id },
          })
        ).status,
        'REJECTED',
      )
      assert.notEqual((await ask('other', edition)).json().id, pending.id)
      assert.equal(
        await db.notification.count({
          where: { userId: other, title: 'Demande de sous-titres refusée' },
        }),
        1,
      )
      currentRole = 'member'
      assert.equal((await install(undefined, 'fra', edition)).statusCode, 403)
      currentRole = 'admin'
    },
  )
  await t.test(
    'provider outages and concurrent decisions cannot create duplicate installations',
    async () => {
      providerUnavailable = true
      assert.equal((await install(undefined, 'eng', edition)).statusCode, 503)
      providerUnavailable = false
      const pending = (await ask('member', edition, 'zho')).json()
      const previous = downloads
      const responses = await Promise.all([
        install(pending.id, 'zho', edition),
        app.inject({
          method: 'POST',
          url: `/api/admin/subtitle-requests/${pending.id}/reject`,
          headers: headers('admin'),
        }),
      ])
      assert.deepEqual(
        responses.map((response) => response.statusCode).sort(),
        [200, 409],
      )
      assert.ok(downloads - previous <= 1)
      const listing = await app.inject({
        url: '/api/admin/subtitle-requests?status=DOWNLOADED',
        headers: headers('admin'),
      })
      assert.equal(listing.statusCode, 200)
      assert.ok(
        listing
          .json()
          .items.every(
            (row: { status: string }) => row.status === 'DOWNLOADED',
          ),
      )
    },
  )
  await t.test(
    'a pending installation reaches the inbox after restart with every browser closed',
    async () => {
      const pending = (await ask('member', movie, 'eng')).json()
      noFile = true
      const response = await install(undefined, 'eng')
      assert.equal(response.statusCode, 202)
      const acquisitions = downloads
      noFile = false
      refreshAfter = 1
      await app.close()
      app = await createApp(config)
      await app.ready()
      for (let i = 0; i < 60; i++) {
        const background = await db.subtitleRequest.findUniqueOrThrow({
          where: { id: pending.id },
        })
        if (background.status === 'DOWNLOADED') break
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      assert.equal(
        (
          await db.subtitleRequest.findUniqueOrThrow({
            where: { id: pending.id },
          })
        ).status,
        'DOWNLOADED',
      )
      const own = await app.inject({
        url: '/api/subtitle-requests',
        headers: headers(),
      })
      assert.equal(
        own.json().items.find((row: { id: string }) => row.id === pending.id)
          .status,
        'DOWNLOADED',
      )
      assert.equal(
        downloads,
        acquisitions,
        'Reading status never repeats the provider download',
      )
      assert.ok(
        !own.body.includes('requesterName') && !own.body.includes('baseline'),
      )
    },
  )
})
