import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { toMediaItem, setMediaWatched } from '@hollyfilms/shared/library'

test('cards use cropped video dimensions, audio-only languages, edition and played metadata', () => {
  const item = toMediaItem({
    Id: 'film',
    Name: 'Film',
    CriticRating: 0,
    UserData: { Played: true },
    MediaSources: [
      {
        Name: 'Film.EXTENDED.2160p',
        MediaStreams: [
          { Type: 'Video', Width: 3840, Height: 1600 },
          { Type: 'Audio', Language: 'fra' },
          { Type: 'Audio', Language: 'fre' },
          { Type: 'Audio', Language: 'eng' },
          { Type: 'Audio', Language: 'pt-BR' },
          { Type: 'Subtitle', Language: 'jpn' },
          { Type: 'Audio', Language: 'und' },
        ],
      },
    ],
  })!
  assert.equal(item.quality, '4K UHD')
  assert.deepEqual(item.audioLanguages, ['fr', 'en', 'pt-br'])
  assert.deepEqual(item.editions, ['Version longue'])
  assert.equal(item.criticRating, 0)
  assert.equal(item.watched, true)
  assert.equal(
    toMediaItem({ Id: 'missing', Name: 'Missing' })!.quality,
    undefined,
  )
  assert.deepEqual(
    toMediaItem({
      Id: 'film',
      Name: 'Film',
      MediaSources: [{ Name: 'Film.1080p.WEB.h264' }],
    })!.editions,
    [],
  )
  assert.equal(
    toMediaItem({
      Id: 'film',
      Name: 'Film',
      MediaStreams: [{ Type: 'Video', Width: 1920, Height: 800 }],
    })!.quality,
    '1080p',
  )
})

test('watched and unwatched actions use authenticated SDK user endpoints', async (t) => {
  const calls: { method?: string; url: URL; auth?: string }[] = []
  const server = createServer((request, response) => {
    calls.push({
      method: request.method,
      url: new URL(request.url!, 'http://localhost'),
      auth: request.headers.authorization,
    })
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ Played: request.method === 'POST' }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const session = { accessToken: 'test-token', deviceId: 'test-device' }
  assert.equal(await setMediaWatched(base, session, 'user', 'film', true), true)
  assert.equal(
    await setMediaWatched(base, session, 'user', 'film', false),
    false,
  )
  assert.deepEqual(
    calls.map((call) => call.method),
    ['POST', 'DELETE'],
  )
  for (const call of calls) {
    assert.equal(call.url.pathname, '/UserPlayedItems/film')
    assert.equal(call.url.searchParams.get('userId'), 'user')
    assert.match(call.auth ?? '', /Token="test-token"/)
    assert.ok(!call.url.href.includes('test-token'))
  }
})
