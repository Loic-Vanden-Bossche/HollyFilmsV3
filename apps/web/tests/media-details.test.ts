import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import {
  getMediaDetails,
  getMediaRelations,
  getRelatedPage,
  safeExternalUrl,
  toMediaDetails,
} from '@hollyfilms/shared/media-details'
import { getLibraryImage } from '@hollyfilms/shared/library'
test('details retain chapter indices, credits and safe links without invented metadata', () => {
  const result = toMediaDetails({
    Id: 'film',
    Name: 'Film',
    Tags: ['quête'],
    People: [
      {
        Id: 'person',
        Name: 'Acteur',
        Role: 'Rôle',
        Type: 'Actor',
        PrimaryImageTag: 'portrait',
      },
      { Name: 'Réalisateur', Type: 'Director' },
    ],
    ExternalUrls: [
      { Name: 'malicious', Url: 'javascript:alert(1)' },
      { Name: 'IMDb', Url: 'https://www.imdb.com/title/tt123/' },
    ],
    Chapters: [
      { Name: 'Départ', StartPositionTicks: 0, ImageTag: 'same' },
      { Name: 'Retour', StartPositionTicks: 600000000, ImageTag: 'same' },
    ],
  })
  assert.equal(result.chapters[1].position, 60)
  assert.equal((result.chapters[1].image as { index: number }).index, 1)
  assert.deepEqual(result.directors, ['Réalisateur'])
  assert.equal(result.links.length, 1)
  assert.equal(result.people[0].role, 'Rôle')
  assert.deepEqual(result.studios, [])
  assert.equal(safeExternalUrl('data:text/html,hello'), undefined)
})
test('detail, collection, person and chapter requests keep the authenticated user and abort support', async (t) => {
  const requests: URL[] = []
  const server = createServer((req, res) => {
    assert.match(req.headers.authorization ?? '', /Token="member"/)
    const url = new URL(req.url!, 'http://localhost')
    requests.push(url)
    res.setHeader('Content-Type', 'application/json')
    if (url.pathname === '/Items/film')
      res.end(JSON.stringify({ Id: 'film', Name: 'Film' }))
    else if (url.pathname.includes('/Images/')) {
      res.setHeader('Content-Type', 'image/jpeg')
      res.end('image')
    } else if (url.pathname.endsWith('/Similar')) {
      res.statusCode = 503
      res.end('{}')
    } else
      res.end(
        JSON.stringify({
          Items: [{ Id: 'collection', Name: 'Collection' }],
          TotalRecordCount: 1,
        }),
      )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    session = { accessToken: 'member', deviceId: 'device' }
  await getMediaDetails(base, session, 'user', 'film')
  const related = await getMediaRelations(base, session, 'user', 'film')
  assert.equal(related.collections.length, 1)
  assert.equal(related.errors.length, 1)
  await getRelatedPage(base, session, 'user', { personId: 'actor' }, 36)
  await getLibraryImage(
    base,
    session,
    { itemId: 'film', type: 'Chapter', tag: 'tag', index: 2 },
    480,
  )
  assert.ok(
    requests.some(
      (u) =>
        u.pathname.endsWith('/Images/Chapter') &&
        u.searchParams.get('imageIndex') === '2',
    ),
  )
  assert.ok(
    requests
      .filter((u) => !u.pathname.includes('/Images/'))
      .every((u) => u.searchParams.get('userId') === 'user'),
  )
  assert.ok(
    requests.some(
      (u) =>
        u.searchParams.get('personIds') === 'actor' &&
        u.searchParams.get('startIndex') === '36',
    ),
  )
})
