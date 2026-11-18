import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { readConfig } from '../src/config.ts'

const member = '11111111111111111111111111111111'
const admin = '22222222222222222222222222222222'
const missing = '33333333333333333333333333333333'
async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  return `http://127.0.0.1:${address.port}`
}
test('Seerr configuration is paired and kept server-side', () => {
  const base = { DATABASE_URL: 'postgres://unused', JELLYFIN_API_KEY: 'fake' }
  assert.equal(readConfig(base).seerr, undefined)
  assert.throws(() => readConfig({ ...base, SEERR_URL: 'https://example.com' }))
  assert.throws(() =>
    readConfig({
      ...base,
      SEERR_URL: 'https://user:password@example.com',
      SEERR_API_KEY: 'fake',
    }),
  )
  assert.deepEqual(
    readConfig({
      ...base,
      SEERR_URL: 'https://seerr.example.com/',
      SEERR_API_KEY: ' fake ',
    }).seerr,
    { url: 'https://seerr.example.com', apiKey: 'fake' },
  )
})

test('requests use Jellyfin identities, Seerr approval and measured downloads', async (t) => {
  const databaseUrl = process.env.HOLLYFILMS_TEST_DATABASE_URL
  assert.ok(
    databaseUrl,
    'Run yarn test:requests to start an isolated PostgreSQL instance',
  )
  let permissions = 32,
    imported = false,
    unavailable = false,
    available = false
  const users = {
    1: { id: 1, jellyfinUserId: admin, permissions: 2, username: 'Admin' },
    3: { id: 3, jellyfinUserId: member, permissions: 32, username: 'Member' },
    4: {
      id: 4,
      jellyfinUserId: missing,
      permissions: 32,
      username: 'Imported',
    },
  }
  type Row = {
    id: number
    type: string
    status: number
    is4k: boolean
    createdAt: string
    updatedAt: string
    requestedBy: (typeof users)[1]
    media: {
      id: number
      tmdbId: number
      status: number
      serviceUrl: string
      externalServiceId: number
      downloadStatus: {
        size: number
        sizeLeft: number
        status: string
        title: string
        timeLeft: string
      }[]
    }
    rootFolder: string
  }
  const rows: Row[] = []
  const calls: {
    method: string
    path: string
    actor?: string
    body?: Record<string, unknown>
  }[] = []
  const jf = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const token = /Token="([^"]+)"/.exec(req.headers.authorization ?? '')?.[1]
    if (!['member', 'admin', 'disabled', 'missing'].includes(token ?? '')) {
      res.writeHead(401).end('{}')
      return
    }
    res.end(
      JSON.stringify({
        Id: token === 'admin' ? admin : token === 'missing' ? missing : member,
        Policy: {
          IsAdministrator: token === 'admin',
          IsDisabled: token === 'disabled',
        },
      }),
    )
  })
  const upstream = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    assert.equal(req.headers['x-api-key'], 'server-secret')
    const url = new URL(req.url!, 'http://test')
    const path = url.pathname.replace('/api/v1/', '')
    const actor = req.headers['x-api-user'] as string | undefined
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = raw ? JSON.parse(raw) : undefined
    calls.push({
      method: req.method!,
      path: url.pathname + url.search,
      actor,
      body,
    })
    if (unavailable) {
      res
        .writeHead(503)
        .end(JSON.stringify({ message: 'INTERNAL SECRET server-secret' }))
      return
    }
    const json = (value: unknown) => res.end(JSON.stringify(value))
    if (path.startsWith('user/jellyfin/')) {
      const id = path.split('/').at(-1)
      const value = Object.values(users).find(
        (user) => user.jellyfinUserId === id && (user.id !== 4 || imported),
      )
      if (!value) {
        res.writeHead(404).end('{}')
        return
      }
      json({
        ...value,
        permissions: value.id === 3 ? permissions : value.permissions,
      })
      return
    }
    if (path === 'user/import-from-jellyfin') {
      assert.deepEqual(body, { jellyfinUserIds: [missing] })
      imported = true
      json([users[4]])
      return
    }
    if (path === 'service/radarr') {
      json([
        {
          id: 0,
          name: 'Radarr films',
          isDefault: true,
          is4k: false,
          apiKey: 'never-return-this',
        },
      ])
      return
    }
    if (path === 'service/sonarr') {
      json([])
      return
    }
    if (path === 'request/count') {
      json({
        total: rows.length,
        pending: rows.filter((row) => row.status === 1).length,
        password: 'never-return-this',
      })
      return
    }
    if (path === 'search') {
      json({
        page: Number(url.searchParams.get('page')),
        totalPages: 2,
        results: [
          {
            id: 10,
            mediaType: 'movie',
            title: 'A new movie',
            posterPath: '/poster.jpg',
          },
          {
            id: 11,
            mediaType: 'movie',
            title: 'Available',
            mediaInfo: { status: 5 },
          },
          { id: 12, mediaType: 'person', name: 'Person' },
          { id: 13, mediaType: 'movie', title: 'Adult', adult: true },
          { id: 14, mediaType: 'tv', name: 'Series' },
        ],
      })
      return
    }
    if (/^(movie|tv)\//.test(path)) {
      const id = Number(path.split('/')[1])
      json({
        id,
        title: 'Movie ' + id,
        overview: 'Description',
        releaseDate: '2026-01-01',
        posterPath: '/poster.jpg',
        mediaInfo: {
          status: available ? 5 : 1,
          requests: rows.filter((row) => row.media.tmdbId === id),
        },
      })
      return
    }
    if (path === 'request' && req.method === 'POST') {
      assert.ok(actor, 'Creation must impersonate the linked user')
      assert.equal(body.mediaType, 'movie')
      const requester = users[Number(actor) as keyof typeof users]
      const row: Row = {
        id: rows.length + 1,
        type: body.mediaType,
        status: requester.permissions === 2 ? 2 : 1,
        is4k: false,
        createdAt: '2026-11-17T10:00:00Z',
        updatedAt: '2026-11-17T10:00:00Z',
        requestedBy: requester,
        rootFolder: '/private/media',
        media: {
          id: 100 + Number(body.mediaId),
          tmdbId: Number(body.mediaId),
          status: 2,
          externalServiceId: 27,
          serviceUrl: 'https://radarr.example.com/movie/27?apikey=SECRET',
          downloadStatus: [],
        },
      }
      rows.push(row)
      json(row)
      return
    }
    if (path === 'request') {
      const own = url.searchParams.get('requestedBy')
      json({
        pageInfo: {
          pages: 1,
          results: rows.filter(
            (row) => !own || row.requestedBy.id === Number(own),
          ).length,
        },
        results:
          rows /* Intentionally include another user's row: API must still filter it. */,
        serviceErrors: { sonarr: [{ name: 'Offline Sonarr' }] },
      })
      return
    }
    const match = /^request\/(\d+)(?:\/(approve|decline|retry))?$/.exec(path)
    if (match) {
      const row = rows.find((row) => row.id === Number(match[1]))
      if (!row) {
        res.writeHead(404).end('{}')
        return
      }
      if (match[2]) {
        assert.equal(actor, undefined)
        row.status = match[2] === 'decline' ? 3 : 2
        row.media.status = 3
      }
      json(row)
      return
    }
    res.writeHead(404).end('{}')
  })
  const jellyfinUrl = await listen(jf),
    seerrUrl = await listen(upstream)
  const app = await createApp({
    databaseUrl,
    jellyfinUrl,
    jellyfinApiKey: 'fake',
    publicOrigin: 'http://localhost:5173',
    seerr: { url: seerrUrl, apiKey: 'server-secret' },
  })
  t.after(async () => {
    await app.close()
    await Promise.all(
      [jf, upstream].map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    )
  })
  const headers = (user = 'member') => ({
    authorization: `Bearer ${user}`,
    'x-hollyfilms-device': 'test-device',
  })
  const create = (user: string, id: number, extra = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: headers(user),
      payload: { type: 'movie', id, ...extra },
    })

  await t.test(
    'auth and admin privileges are checked against Jellyfin on every request',
    async () => {
      assert.equal((await app.inject({ url: '/api/requests' })).statusCode, 401)
      assert.equal(
        (
          await app.inject({
            url: '/api/admin/media-requests',
            headers: headers(),
          })
        ).statusCode,
        403,
      )
      assert.equal(
        (
          await app.inject({
            url: '/api/requests',
            headers: headers('disabled'),
          })
        ).statusCode,
        403,
      )
      assert.equal(calls.length, 0)
      const spoofed = await create('member', 10, { requestedBy: 1, status: 2 })
      assert.equal(spoofed.statusCode, 200)
      assert.equal(
        spoofed.json().status,
        1,
        'Unknown body fields are removed by Fastify; they cannot select an administrator or approval state',
      )
      assert.equal(rows[0].requestedBy.id, 3)
      assert.equal(
        (
          await app.inject({
            url: '/api/requests?requestedBy=1',
            headers: headers(),
          })
        ).json().items[0].id,
        1,
      )
    },
  )
  await t.test(
    'search excludes available/adult titles and people, filters types, preserves pages',
    async () => {
      const response = await app.inject({
        url: '/api/requests/search?q=movie&page=2&type=movie&language=zh-CN',
        headers: headers(),
      })
      assert.equal(response.statusCode, 200)
      assert.deepEqual(
        response.json().items.map((item: { id: number }) => item.id),
        [10],
      )
      assert.equal(response.json().page, 2)
      assert.ok(calls.at(-1)?.path.includes('language=zh-CN'))
      assert.equal(calls.at(-1)?.actor, '3')
      assert.equal(
        (
          await app.inject({
            url: '/api/requests/search?q=x',
            headers: headers(),
          })
        ).statusCode,
        400,
      )
    },
  )
  await t.test(
    'normal creation stays pending; duplicate concurrent submissions create only once',
    async () => {
      const responses = await Promise.all([
        create('member', 10),
        create('member', 10),
      ])
      for (const response of responses) {
        assert.equal(response.statusCode, 200, response.body)
        assert.equal(response.json().status, 1)
        assert.equal(response.json().admin, undefined)
      }
      assert.equal(rows.length, 1)
      assert.equal(
        calls.filter(
          (call) => call.path === '/api/v1/request' && call.method === 'POST',
        )[0].actor,
        '3',
      )
      assert.equal((await create('member', 10)).json().id, 1)
      assert.equal(rows.length, 1)
    },
  )
  await t.test(
    'admin creation is approved and remains attributed to its actual linked user',
    async () => {
      const response = await create('admin', 20)
      assert.equal(response.statusCode, 200, response.body)
      assert.equal(response.json().status, 2)
      assert.equal(rows[1].requestedBy.id, 1)
    },
  )
  await t.test(
    'Jellyfin administrators auto-approve even with ordinary Seerr permissions',
    async () => {
      users[1].permissions = 32
      const response = await create('admin', 21)
      users[1].permissions = 2
      assert.equal(response.statusCode, 200, response.body)
      assert.equal(response.json().status, 2)
      assert.equal(rows.at(-1)?.requestedBy.id, 1)
      assert.ok(
        calls.some(
          (call) =>
            call.path === '/api/v1/request/3/approve' && call.method === 'POST',
        ),
      )
      rows.pop()
    },
  )
  await t.test(
    'my requests cannot expose another user or administrative fields',
    async () => {
      rows[0].media.downloadStatus = [
        {
          size: 1000,
          sizeLeft: 250,
          status: 'downloading',
          timeLeft: '00:01:30',
          title: 'Private technical release',
        },
      ]
      const response = await app.inject({
        url: '/api/requests',
        headers: headers(),
      })
      assert.equal(response.statusCode, 200, response.body)
      assert.equal(response.json().items.length, 1)
      assert.deepEqual(response.json().items[0].downloads, [
        { progress: 75, status: 'downloading', remaining: '00:01:30' },
      ])
      assert.equal(response.json().serviceErrors.length, 0)
      assert.ok(
        !response.body.includes('/private/media') &&
          !response.body.includes('Admin') &&
          !response.body.includes('server-secret'),
      )
      assert.ok(
        calls
          .findLast((call) => call.path.startsWith('/api/v1/request?'))
          ?.path.includes('requestedBy=3'),
      )
      const options = await app.inject({
        url: '/api/requests/options',
        headers: headers(),
      })
      assert.deepEqual(options.json(), {
        enabled: true,
        movies: true,
        series: false,
      })
    },
  )
  await t.test(
    'admin list exposes download and service data but strips secrets',
    async () => {
      const response = await app.inject({
        url: '/api/admin/media-requests',
        headers: headers('admin'),
      })
      assert.equal(response.json().items.length, 2)
      assert.equal(response.json().items[0].admin.requestedBy, 'Member')
      assert.equal(
        response.json().items[0].admin.serviceUrl,
        'https://radarr.example.com/movie/27',
      )
      assert.deepEqual(response.json().serviceErrors, ['Offline Sonarr'])
      const options = await app.inject({
        url: '/api/requests/options',
        headers: headers('admin'),
      })
      assert.equal(options.json().services[0].name, 'Radarr films')
      assert.ok(
        !options.body.includes('never-return-this') &&
          !response.body.includes('SECRET'),
      )
    },
  )
  await t.test(
    'concurrent approval and refusal serialize on PostgreSQL and re-read state',
    async () => {
      const before = calls.length
      const responses = await Promise.all(
        ['approve', 'decline'].map((action) =>
          app.inject({
            method: 'POST',
            url: `/api/admin/media-requests/1/${action}`,
            headers: headers('admin'),
          }),
        ),
      )
      assert.deepEqual(
        responses.map((response) => response.statusCode).sort(),
        [200, 409],
      )
      assert.equal(
        calls.slice(before).filter((call) => call.method === 'POST').length,
        1,
      )
      const inbox = (
        await app.inject({ url: '/api/notifications', headers: headers() })
      ).json()
      assert.equal(inbox.unread, 1)
      assert.equal(inbox.items[0].url, '/requests')
      assert.match(inbox.items[0].title, /Demande de média (approuvée|refusée)/)
      assert.equal(
        (
          await app.inject({
            url: '/api/notifications',
            headers: headers('admin'),
          })
        ).json().unread,
        0,
      )
      rows[0].status = 4
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/admin/media-requests/1/retry',
            headers: headers('admin'),
          })
        ).statusCode,
        200,
      )
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/admin/media-requests/1/retry',
            headers: headers(),
          })
        ).statusCode,
        403,
      )
    },
  )
  await t.test(
    'selected-user import happens only on explicit creation',
    async () => {
      assert.equal(
        (
          await app.inject({
            url: '/api/requests',
            headers: headers('missing'),
          })
        ).json().items.length,
        0,
      )
      assert.equal(imported, false)
      assert.equal((await create('missing', 30)).statusCode, 200)
      assert.equal(imported, true)
      assert.equal(rows.at(-1)?.requestedBy.id, 4)
    },
  )
  await t.test(
    'auto-approval permission mismatch and missing Sonarr fail closed',
    async () => {
      permissions = 32 | 256
      assert.equal(
        (await create('member', 40)).json().code,
        'REQUEST_APPROVAL_POLICY',
      )
      permissions = 32
      const response = await app.inject({
        method: 'POST',
        url: '/api/requests',
        headers: headers(),
        payload: { type: 'tv', id: 14 },
      })
      assert.equal(response.json().code, 'REQUEST_SERVICE_MISSING')
      available = true
      assert.equal((await create('member', 40)).json().code, 'REQUEST_EXISTS')
      available = false
    },
  )
  await t.test(
    'upstream failures are recoverable and never expose service secrets',
    async () => {
      unavailable = true
      const response = await create('member', 50)
      assert.equal(response.statusCode, 503)
      assert.ok(
        !response.body.includes('server-secret') &&
          !response.body.includes('INTERNAL'),
      )
      unavailable = false
      assert.equal((await create('member', 50)).statusCode, 200)
    },
  )
})
