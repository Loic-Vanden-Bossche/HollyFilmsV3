import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { createApp } from '../src/app.ts'
const movie = '11111111111111111111111111111111',
  user = '22222222222222222222222222222222',
  other = '33333333333333333333333333333333'
test('media access, independent TMDB providers and persistent member reviews', async (t) => {
  const databaseUrl = process.env.HOLLYFILMS_TEST_DATABASE_URL
  assert.ok(
    databaseUrl,
    'Use an isolated PostgreSQL test database with migrations applied',
  )
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })
  t.after(() => db.$disconnect())
  assert.equal(
    await db.mediaReview.count(),
    0,
    'Use an empty review test database',
  )
  const jf = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const header = req.headers.authorization ?? ''
    if (!/Token="(?:member|other|disabled)"/.test(header)) {
      res.statusCode = 401
      res.end('{}')
      return
    }
    if (req.url === '/Users/Me')
      res.end(
        JSON.stringify({
          Id: header.includes('other') ? other : user,
          Name: header.includes('other') ? 'Autre membre' : 'Camille',
          Policy: { IsDisabled: header.includes('disabled') },
        }),
      )
    else if (req.url?.startsWith('/Items/' + movie))
      res.end(
        JSON.stringify({
          Id: movie,
          Name: 'Film',
          Type: 'Movie',
          ProviderIds: { Tmdb: '123' },
        }),
      )
    else {
      res.statusCode = 404
      res.end('{}')
    }
  })
  await new Promise<void>((resolve) => jf.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve) => jf.close(() => resolve())))
  let remoteCalls = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (url: string | URL, init?: RequestInit) => {
      assert.equal(new URL(String(url)).hostname, 'api.themoviedb.org')
      assert.equal(
        (init?.headers as Record<string, string> | undefined)?.Authorization,
        'Bearer server-only-key',
      )
      remoteCalls++
      if (String(url).endsWith('/watch/providers'))
        return Response.json({
          results: {
            FR: {
              link: 'https://www.themoviedb.org/movie/123/watch?locale=FR',
              flatrate: [
                {
                  provider_id: 8,
                  provider_name: 'Plateforme',
                  logo_path: '/logo.png',
                },
              ],
              buy: [{ provider_id: 8, provider_name: 'Plateforme' }],
            },
            CH: {
              link: 'https://www.themoviedb.org/movie/123/watch?locale=CH',
              rent: [{ provider_id: 9, provider_name: 'Location' }],
            },
          },
        })
      if (String(url).includes('page=2'))
        return new Response('{}', { status: 503 })
      return Response.json({
        results: [
          {
            id: 'external',
            author: 'Critique',
            content: 'Avis TMDB',
            created_at: '2026-11-01T12:00:00Z',
            author_details: { rating: 8 },
            url: 'https://www.themoviedb.org/review/external',
          },
        ],
        total_results: 1,
        total_pages: 1,
      })
    },
  )
  const config = {
    databaseUrl,
    jellyfinUrl: `http://127.0.0.1:${(jf.address() as { port: number }).port}`,
    jellyfinApiKey: 'unused-server-key',
    publicOrigin: 'http://localhost:5173',
    tmdbToken: 'server-only-key',
  }
  const app = await createApp(config)
  t.after(() => app.close())
  const headers = {
    authorization: 'Bearer member',
    'x-hollyfilms-device': 'test-device',
    origin: 'http://localhost:5173',
  }
  const path = '/api/media/' + movie
  assert.equal((await app.inject({ url: path + '/reviews' })).statusCode, 401)
  assert.equal(
    (
      await app.inject({
        url: path + '/reviews',
        headers: { authorization: 'Bearer disabled' },
      })
    ).statusCode,
    403,
  )
  assert.equal(
    (await app.inject({ url: '/api/media/' + other + '/reviews', headers }))
      .statusCode,
    404,
  )
  let result = await app.inject({ url: path + '/providers?region=FR', headers })
  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.json().providers[0].offers, ['Abonnement', 'Achat'])
  assert.equal(
    result.json().providers[0].logo,
    'https://image.tmdb.org/t/p/w92/logo.png',
  )
  assert.ok(!result.body.includes('server-only-key'))
  const calls = remoteCalls
  await app.inject({ url: path + '/providers?region=CH', headers })
  assert.equal(remoteCalls, calls, 'public provider data cached across regions')
  assert.equal(
    (await app.inject({ url: path + '/providers?region=INVALID', headers }))
      .statusCode,
    400,
  )
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: path + '/review',
        headers: { ...headers, origin: 'https://other.example' },
        payload: { content: 'a', rating: 8 },
      })
    ).statusCode,
    403,
  )
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: path + '/review',
        headers,
        payload: { content: '', rating: null },
      })
    ).statusCode,
    400,
  )
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: path + '/review',
        headers,
        payload: { content: 'a', rating: 11 },
      })
    ).statusCode,
    400,
  )
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: path + '/review',
        headers,
        payload: { content: 'é'.repeat(10000), rating: 8 },
      })
    ).statusCode,
    200,
    'the full Unicode character allowance fits the request body',
  )
  const saves = await Promise.all(
    [1, 2].map((n) =>
      app.inject({
        method: 'PUT',
        url: path + '/review',
        headers,
        payload: { content: 'Avis ' + n, rating: 8.5 },
      }),
    ),
  )
  saves.forEach((r) => assert.equal(r.statusCode, 200))
  assert.equal(await db.mediaReview.count(), 1)
  result = await app.inject({ url: path + '/reviews', headers })
  assert.equal(result.json().total, 2)
  assert.equal(result.json().own.author, 'Camille')
  assert.equal(result.json().own.rating, 8.5)
  const second = await createApp(config)
  assert.equal(
    (await second.inject({ url: path + '/reviews', headers })).json().own
      .rating,
    8.5,
    'review persists after API restart',
  )
  await second.close()
  result = await app.inject({ url: path + '/reviews?page=2', headers })
  assert.equal(result.statusCode, 200)
  assert.equal(result.json().external, 'unavailable')
  assert.equal(
    result.json().own.rating,
    8.5,
    'local reviews survive TMDB failure',
  )
  await app.inject({
    method: 'DELETE',
    url: path + '/review',
    headers: { authorization: 'Bearer other' },
  })
  assert.equal(
    await db.mediaReview.count(),
    1,
    'another user cannot delete this review',
  )
  await app.inject({ method: 'DELETE', url: path + '/review', headers })
  assert.equal(await db.mediaReview.count(), 0)
  const unconfigured = await createApp({ ...config, tmdbToken: undefined })
  assert.equal(
    (await unconfigured.inject({ url: path + '/providers', headers })).json()
      .status,
    'unconfigured',
  )
  await unconfigured.close()
})
