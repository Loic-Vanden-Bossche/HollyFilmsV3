import assert from 'node:assert/strict'
import test from 'node:test'
import { appRouteUrl, readAppRoute } from '../src/app-route.ts'

test('route round-trips the catalogue, modal and player without session data', () => {
  const route = {
    filter: 'movies' as const,
    search: 'Le château & la mer',
    sort: 'rating' as const,
    collection: undefined,
    media: 'movie-123',
    play: 'episode-456',
    time: 3723,
    source: 'version-2',
    audio: 2,
    subtitle: -1,
    secondarySubtitle: 4,
    paused: true,
  }
  const url = appRouteUrl('https://hollyfilms.chbrx.com/app', route)
  assert.deepEqual(
    readAppRoute(
      new URL(url, 'https://example.com').search,
      new URL(url, 'https://example.com').pathname,
    ),
    route,
  )
  assert(!url.includes('token'))
})

test('closing the player keeps its originating modal and clears playback options', () => {
  const url = appRouteUrl(
    'https://example.com/app?view=series&media=show&play=episode&t=80&source=v2&audio=1&sub=-1&sub2=4&paused=1',
    { play: undefined },
  )
  assert.equal(url, '/app/series?media=show')
})

test('all five destinations restore from their URL and legacy links still work', () => {
  for (const filter of [
    'all',
    'favorites',
    'movies',
    'series',
    'collections',
  ] as const) {
    const path = filter === 'all' ? '/app' : `/app/${filter}`
    assert.equal(appRouteUrl('https://example.com/app', { filter }), path)
    assert.equal(readAppRoute('', path).filter, filter)
    assert.equal(readAppRoute(`?view=${filter}`).filter, filter)
  }
  assert.equal(readAppRoute('?view=movies', '/app/series').filter, 'series')
})

test('collection contents, sort, modal and playback remain restorable together', () => {
  const url = appRouteUrl('https://example.com/app/collections', {
    collection: 'saga-12',
    sort: 'title',
    media: 'movie-4',
    play: 'movie-4',
    time: 74,
  })
  const parsed = new URL(url, 'https://example.com')
  const route = readAppRoute(parsed.search, parsed.pathname)
  assert.equal(route.collection, 'saga-12')
  assert.equal(route.sort, 'title')
  assert.equal(route.time, 74)
  assert.equal(
    appRouteUrl(parsed.href, {
      filter: 'movies',
      play: undefined,
      media: undefined,
      sort: undefined,
    }),
    '/app/movies',
  )
  assert.equal(
    readAppRoute('?collection=../../admin&sort=invalid', '/app/collections')
      .collection,
    undefined,
  )
  assert.equal(readAppRoute('?sort=invalid').sort, undefined)
})

test('invalid URL values cannot become media paths or invalid seek positions', () => {
  const route = readAppRoute(
    '?view=invalid&media=../../admin&play=movie&t=Infinity&audio=-5&sub=-2&sub2=-2',
  )
  assert.equal(route.filter, 'all')
  assert.equal(route.media, undefined)
  assert.equal(route.time, undefined)
  assert.equal(route.audio, undefined)
  assert.equal(route.subtitle, undefined)
  assert.equal(route.secondarySubtitle, undefined)
  assert.equal(readAppRoute('?t=22&source=v1&paused=1').time, undefined)
  assert.equal(readAppRoute('?play=movie&t=0').time, 0)
})

test('route updates preserve unrelated query parameters and anchors', () => {
  assert.equal(
    appRouteUrl('https://example.com/app?other=value#home-main', {
      search: 'Signal',
    }),
    '/app?other=value&q=Signal#home-main',
  )
  assert.equal(
    appRouteUrl('https://example.com/app?q=Signal', { search: '' }),
    '/app',
  )
})

test('a shelf link survives opening its film and clears when leaving the homepage', () => {
  const shelf = 'https://example.com/app#home-shelf-adventure'
  assert.equal(
    appRouteUrl(shelf, { media: 'film' }),
    '/app?media=film#home-shelf-adventure',
  )
  assert.equal(appRouteUrl(shelf, { filter: 'movies' }), '/app/movies')
  assert.equal(appRouteUrl(shelf, { search: 'Signal' }), '/app?q=Signal')
})
