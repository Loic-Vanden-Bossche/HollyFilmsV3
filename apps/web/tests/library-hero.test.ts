import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import {
  getHeroPreview,
  getLibraryImage,
  setMediaFavorite,
  toMediaItem,
  youtubeId,
} from '@hollyfilms/shared/library'

test('les logos gardent leur source et les métadonnées manquantes restent absentes', () => {
  const item = toMediaItem({
    Id: 'film',
    Name: 'Film',
    ImageTags: { Logo: 'hd-logo' },
    CriticRating: 0,
    UserData: { IsFavorite: true },
    RemoteTrailers: [{ Url: 'https://youtu.be/abcdefghijk', Name: 'VF' }],
  })!
  assert.deepEqual(item.logo, { itemId: 'film', type: 'Logo', tag: 'hd-logo' })
  assert.equal(item.criticRating, 0)
  assert.equal(item.favorite, true)
  const episode = toMediaItem({
    Id: 'episode',
    Name: 'Episode',
    ParentLogoItemId: 'series',
    ParentLogoImageTag: 'series-logo',
  })!
  assert.equal(
    typeof episode.logo === 'object' && episode.logo.itemId,
    'series',
  )
  assert.equal(episode.rating, undefined)
  assert.equal(episode.logo?.type, 'Logo')
})

test('les URL de bandes-annonces sont limitées aux domaines YouTube exacts', () => {
  for (const url of [
    'https://youtu.be/abcdefghijk',
    'https://www.youtube.com/watch?v=abcdefghijk',
    'https://youtube-nocookie.com/embed/abcdefghijk',
  ])
    assert.equal(youtubeId(url), 'abcdefghijk')
  for (const url of [
    'https://youtube.com.evil.test/watch?v=abcdefghijk',
    'javascript:alert(1)',
    'https://youtu.be/short',
    'http://youtu.be/abcdefghijk',
  ])
    assert.equal(youtubeId(url), undefined)
})

test('le SDK authentifie logos, aperçus et favoris sans rapporter de lecture', async (t) => {
  const calls: { path: string; method: string; auth: string }[] = []
  let local = true
  const server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://localhost')
    calls.push({
      path: req.url!,
      method: req.method!,
      auth: String(req.headers.authorization),
    })
    res.setHeader('Content-Type', 'application/json')
    if (url.pathname.endsWith('/ThemeVideos'))
      res.end(
        JSON.stringify({
          Items: local
            ? [{ Id: 'preview', MediaSources: [{ Id: 'source' }] }]
            : [],
        }),
      )
    else if (url.pathname.endsWith('/LocalTrailers')) res.end('[]')
    else if (url.pathname.includes('/Images/')) {
      res.setHeader('Content-Type', 'image/png')
      res.end('image')
    } else if (url.pathname.includes('/UserFavoriteItems/'))
      res.end(JSON.stringify({ IsFavorite: req.method === 'POST' }))
    else {
      res.statusCode = 404
      res.end('{}')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())))
  const address = server.address() as { port: number }
  const base = `http://127.0.0.1:${address.port}`
  const session = { accessToken: 'test-user-token', deviceId: 'test-device' }
  const item = toMediaItem({
    Id: 'film',
    Name: 'Film',
    RemoteTrailers: [
      { Url: 'https://youtu.be/aaaaaaaaaaa', Name: 'VOST' },
      { Url: 'https://youtu.be/bbbbbbbbbbb', Name: 'VF' },
    ],
  })!
  const preview = await getHeroPreview(base, session, 'user', item)
  assert.equal(preview?.kind, 'video')
  if (preview?.kind === 'video') {
    const url = new URL(preview.url)
    assert.equal(url.pathname, '/Videos/preview/stream.mp4')
    assert.equal(url.searchParams.get('api_key'), session.accessToken)
    assert.equal(url.searchParams.get('mediaSourceId'), 'source')
  }
  local = false
  assert.deepEqual(await getHeroPreview(base, session, 'user', item), {
    kind: 'youtube',
    id: 'bbbbbbbbbbb',
  })
  assert.equal(
    await getHeroPreview(base, session, 'user', { ...item, trailers: [] }),
    null,
  )
  await getLibraryImage(
    base,
    session,
    { itemId: 'film', type: 'Logo', tag: 'logo' },
    1600,
  )
  const image = new URL(
    calls.find((call) => call.path.includes('/Images/'))!.path,
    base,
  )
  assert.equal(image.searchParams.get('format'), 'Png')
  assert.equal(image.searchParams.get('quality'), '100')
  assert.equal(image.searchParams.get('maxWidth'), '1600')
  assert.equal(
    await setMediaFavorite(base, session, 'user', item.id, true),
    true,
  )
  assert.equal(
    await setMediaFavorite(base, session, 'user', item.id, false),
    false,
  )
  assert.ok(calls.every((call) => call.auth.includes('test-user-token')))
  assert.ok(calls.every((call) => !call.path.includes('/Sessions/Playing')))
})
