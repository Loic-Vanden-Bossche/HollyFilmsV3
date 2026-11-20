import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.ts'

test('La vitrine publie seulement la sélection et ses affiches', async (context) => {
  const id = '123456781234123412341234567890ab'
  let imageRequests = 0
  let requestedWidth: string | null = null
  const upstream = createServer((request, response) => {
    if (request.url?.includes('/Images/')) {
      imageRequests++
      requestedWidth = new URL(
        request.url,
        'http://localhost',
      ).searchParams.get('maxWidth')
      response.setHeader('Content-Type', 'image/jpeg')
      response.end(Buffer.from([255, 216, 255, 217]))
      return
    }
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        Items: [
          {
            Id: id,
            Name: 'Film de test',
            Type: 'Movie',
            ProductionYear: 2026,
            ImageTags: { Primary: 'poster' },
            Path: '/private/media/movie.mkv',
            UserData: { Played: true },
            MediaSources: [{ Path: '/private/file' }],
          },
        ],
      }),
    )
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  context.after(
    () => new Promise<void>((resolve) => upstream.close(() => resolve())),
  )
  const address = upstream.address()
  assert.ok(address && typeof address !== 'string')
  const app = await createApp({
    databaseUrl: 'postgresql://unused:unused@127.0.0.1:1/unused',
    jellyfinUrl: 'http://127.0.0.1:' + address.port,
    jellyfinApiKey: 'private-test-key',
    publicOrigin: 'http://localhost:5173',
  })
  context.after(() => app.close())
  const catalog = await app.inject('/api/showcase')
  assert.equal(catalog.statusCode, 200)
  assert.deepEqual(catalog.json(), {
    items: [
      {
        id,
        title: 'Film de test',
        year: 2026,
        kind: 'Film',
        poster: '/api/showcase/' + id + '/poster',
      },
    ],
  })
  assert.doesNotMatch(catalog.body, /private|UserData|MediaSources/)
  assert.equal(
    (await app.inject('/api/showcase/' + id + '/poster')).statusCode,
    200,
  )
  assert.equal(imageRequests, 1)
  assert.equal(requestedWidth, '400')
  assert.equal(
    (await app.inject('/api/showcase/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/poster'))
      .statusCode,
    404,
  )
  assert.equal(imageRequests, 1)
  assert.equal(
    (await app.inject('/api/showcase/' + id + '/poster?width=240')).statusCode,
    200,
  )
  assert.equal(requestedWidth, '240')
  assert.equal(
    (await app.inject('/api/showcase/' + id + '/poster?width=9000')).statusCode,
    400,
  )
  assert.equal(imageRequests, 2)
  assert.equal(
    (await app.inject('/api/showcase/invalid/poster')).statusCode,
    400,
  )
})
