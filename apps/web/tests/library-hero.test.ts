import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import {
  getHeroPreview,
  getItemPreviewClip,
  getLibraryImage,
  setMediaFavorite,
  toMediaItem,
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
  assert.deepEqual(item.trailers, [
    { url: 'https://youtu.be/abcdefghijk', name: 'VF' },
  ])
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

test('les vignettes paysage utilisent le tag et le propriétaire de la même image', () => {
  const parent = {
    ParentThumbItemId: 'season',
    ParentThumbImageTag: 'season-thumb',
  }
  const series = { SeriesId: 'series', SeriesThumbImageTag: 'series-thumb' }
  const episode = {
    Id: 'episode',
    Name: 'Episode',
    Type: 'Episode' as const,
    ...parent,
    ...series,
  }
  assert.deepEqual(
    toMediaItem({ ...episode, ImageTags: { Thumb: 'episode-thumb' } })?.thumb,
    { itemId: 'episode', type: 'Thumb', tag: 'episode-thumb' },
  )
  assert.deepEqual(toMediaItem(episode)?.thumb, {
    itemId: 'series',
    type: 'Thumb',
    tag: 'series-thumb',
  })
  assert.deepEqual(
    toMediaItem({ ...episode, SeriesThumbImageTag: null })?.thumb,
    { itemId: 'season', type: 'Thumb', tag: 'season-thumb' },
  )
  assert.equal(
    toMediaItem({ Id: 'film', Name: 'Film', ParentThumbImageTag: 'other' })
      ?.thumb,
    undefined,
  )
})

test('les extraits directs sont bornés et respectent le point de reprise et les droits de lecture', () => {
  const base = 'https://hollyfilms.test/jellyfin/'
  const session = { accessToken: 'fixture-token', deviceId: 'fixture-device' }
  const dto = {
    Id: 'film-id',
    Name: 'Film',
    Type: 'Movie' as const,
    RunTimeTicks: 2400 * 10_000_000,
    MediaSources: [{ Id: 'edition-id' }],
  }
  const item = toMediaItem(dto)!
  const resumed = { ...item, progress: 10, playbackPosition: 240.5 }
  const clip = getItemPreviewClip(base, session, resumed)
  assert.ok(clip)
  const url = new URL(clip.url)
  assert.equal(url.pathname, '/jellyfin/Videos/film-id/stream')
  assert.equal(url.searchParams.get('api_key'), session.accessToken)
  assert.equal(url.searchParams.get('static'), 'true')
  assert.equal(url.searchParams.get('mediaSourceId'), 'edition-id')
  assert.equal(url.hash, '#t=240.5,255.5')
  for (const playbackPosition of [undefined, -1, NaN, 2395, Infinity])
    assert.equal(
      new URL(
        getItemPreviewClip(base, session, { ...resumed, playbackPosition })!
          .url,
      ).hash,
      '#t=30,45',
    )
  assert.equal(
    new URL(getItemPreviewClip(base, session, resumed, 2395)!.url).hash,
    '#t=2395,2400',
  )
  const episode = toMediaItem({
    ...dto,
    Type: 'Episode',
    RunTimeTicks: 8 * 10_000_000,
  })!
  assert.equal(
    new URL(getItemPreviewClip(base, session, episode, 0)!.url).hash,
    '#t=0,8',
  )
  for (const other of [
    { ...dto, Type: 'Series' as const },
    { ...dto, Type: 'BoxSet' as const },
    { ...dto, PlayAccess: 'None' as const },
    { ...dto, LocationType: 'Virtual' as const },
  ])
    assert.equal(getItemPreviewClip(base, session, toMediaItem(other)!), null)
})

test('le SDK authentifie logos, aperçus et favoris sans rapporter de lecture', async (t) => {
  const calls: { path: string; method: string; auth: string }[] = []
  let themeAvailable = true
  let trailerAvailable = true
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
          Items: themeAvailable
            ? [{ Id: 'preview', MediaSources: [{ Id: 'source' }] }]
            : [{ Id: 'blocked', PlayAccess: 'None' }],
        }),
      )
    else if (url.pathname.endsWith('/LocalTrailers'))
      res.end(JSON.stringify(trailerAvailable ? [{ Id: 'local-trailer' }] : []))
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
  themeAvailable = false
  const trailer = await getHeroPreview(base, session, 'user', item)
  assert.ok(trailer)
  assert.equal(
    new URL(trailer.url).pathname,
    '/Videos/local-trailer/stream.mp4',
  )
  trailerAvailable = false
  assert.equal(await getHeroPreview(base, session, 'user', item), null)
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
