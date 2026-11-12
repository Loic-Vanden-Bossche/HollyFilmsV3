import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import {
  getLibraryPage,
  getResumeItems,
  getLibraryImage,
  toMediaItem,
} from '@hollyfilms/shared/library'

test('episode progress uses the series artwork and handles incomplete metadata', () => {
  const item = toMediaItem({
    Id: 'episode',
    Name: 'The signal',
    Type: 'Episode',
    SeriesName: 'Orbital',
    SeriesId: 'series',
    SeriesPrimaryImageTag: 'poster-tag',
    ParentBackdropItemId: 'series',
    ParentBackdropImageTags: ['backdrop-tag'],
    ParentIndexNumber: 2,
    IndexNumber: 3,
    RunTimeTicks: 60 * 600_000_000,
    UserData: { PlaybackPositionTicks: 15 * 600_000_000 },
  })
  assert.equal(item?.title, 'Orbital')
  assert.equal(item?.episode, 'S2 · E3 · The signal')
  assert.equal(item?.progress, 0.25)
  assert.equal(item?.remainingMinutes, 45)
  assert.deepEqual(item?.poster, {
    itemId: 'series',
    type: 'Primary',
    tag: 'poster-tag',
  })
  assert.deepEqual(item?.backdrop, {
    itemId: 'series',
    type: 'Backdrop',
    tag: 'backdrop-tag',
  })
  assert.equal(toMediaItem({ Name: 'Missing id' }), null)
  assert.equal(
    toMediaItem({ Id: 'movie', Name: 'Untitled', RunTimeTicks: 0 })?.minutes,
    undefined,
  )
})

test('SDK requests use the signed-in user, search, pagination and header authentication', async (t) => {
  const requests: { url: URL; authorization?: string }[] = []
  const server = createServer((request, response) => {
    const url = new URL(request.url!, 'http://localhost')
    requests.push({ url, authorization: request.headers.authorization })
    response.setHeader(
      'Content-Type',
      url.pathname.includes('/Images/') ? 'image/jpeg' : 'application/json',
    )
    response.end(
      url.pathname.includes('/Images/')
        ? 'image-bytes'
        : JSON.stringify({
            Items: [{ Id: 'movie', Name: 'Signal', Type: 'Movie' }],
            TotalRecordCount: 80,
          }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const address = server.address()
  assert(address && typeof address !== 'string')
  const url = 'http://127.0.0.1:' + address.port
  const session = { deviceId: 'test-device', accessToken: 'test-user-token' }
  const page = await getLibraryPage(
    url,
    session,
    'user-123',
    'movies',
    'Signal',
    36,
  )
  await getResumeItems(url, session, 'user-123')
  await getLibraryImage(
    url,
    session,
    { itemId: 'movie', type: 'Primary', tag: 'v1' },
    400,
  )
  assert.equal(page.total, 80)
  assert.equal(page.items[0].title, 'Signal')
  assert.equal(requests[0].url.searchParams.get('userId'), 'user-123')
  assert.equal(requests[0].url.searchParams.get('includeItemTypes'), 'Movie')
  assert.equal(requests[0].url.searchParams.get('searchTerm'), 'Signal')
  assert.equal(requests[0].url.searchParams.get('startIndex'), '36')
  assert.equal(requests[1].url.pathname, '/UserItems/Resume')
  assert.equal(requests[1].url.searchParams.get('userId'), 'user-123')
  for (const request of requests.slice(0, 2)) {
    assert.ok(
      request.url.searchParams
        .getAll('fields')
        .join(',')
        .includes('MediaStreams'),
    )
    assert.ok(
      request.url.searchParams
        .getAll('fields')
        .join(',')
        .includes('MediaSources'),
    )
  }
  assert.equal(requests[2].url.pathname, '/Items/movie/Images/Primary')
  for (const request of requests) {
    assert.match(request.authorization ?? '', /Token="test-user-token"/)
    assert(!request.url.href.includes('test-user-token'))
    assert(!request.url.searchParams.has('api_key'))
  }
})
