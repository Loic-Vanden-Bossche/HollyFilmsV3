import assert from 'node:assert/strict'
import test from 'node:test'
import type { MediaItem } from '@hollyfilms/shared/library'
import { buildHomeShelves } from '../src/home-shelves.ts'

function movie(id: string, metadata: Partial<MediaItem> = {}): MediaItem {
  return {
    id,
    title: id,
    kind: 'Film',
    overview: '',
    genres: [],
    progress: 0,
    ...metadata,
  }
}

test('small or unclassified libraries keep their real arrivals in server order', () => {
  const recent = [
    movie('new addition', { year: 1924 }),
    movie('older addition', { year: 2026 }),
  ]
  assert.deepEqual(buildHomeShelves([]), [])
  const [only] = buildHomeShelves([...recent, recent[0]])
  assert.equal(only.id, 'recent')
  assert.deepEqual(only.items, recent)
})

test('editorial rows use real genres and runtimes without repeating titles', () => {
  const recent = [
    ...Array.from({ length: 4 }, (_, i) => movie('new-' + i)),
    movie('mystery', { genres: ['Mystère'] }),
    movie('crime', { genres: ['Crime', 'Action'] }),
    movie('adventure', { genres: ['Action & Adventure'] }),
    movie('aventure', { genres: ['Aventure'] }),
    movie('ninety', { minutes: 90 }),
    movie('under', { minutes: 87 }),
    movie('long', { minutes: 91 }),
    movie('unknown', { minutes: 0 }),
  ]
  const rated = [
    movie('high', { rating: 8 }),
    movie('highest', { rating: 9 }),
    movie('low', { rating: 6 }),
  ]
  const shows = [
    movie('show-1', { kind: 'Série', minutes: 45 }),
    movie('show-2', { kind: 'Série' }),
  ]
  const shelves = buildHomeShelves(recent, [...rated, recent[4]], shows)
  const ids = (id: string) =>
    shelves.find((shelf) => shelf.id === id)?.items.map((item) => item.id)
  assert.deepEqual(
    ids('recent'),
    recent.slice(0, 4).map((item) => item.id),
  )
  assert.deepEqual(ids('suspense'), ['mystery', 'crime'])
  assert.deepEqual(ids('adventure'), ['adventure', 'aventure'])
  assert.deepEqual(ids('short'), ['ninety', 'under'])
  assert.deepEqual(ids('acclaimed'), ['highest', 'high', 'low'])
  assert.deepEqual(ids('series'), ['show-1', 'show-2'])
  const all = shelves
    .filter((shelf) => shelf.id !== 'acclaimed')
    .flatMap((shelf) => shelf.items.map((item) => item.id))
  assert.equal(new Set(all).size, all.length)
})

test('ranks accessible films independently of editorial picks and never extrapolates from a partial recent page', () => {
  const recent = [
    movie('recent favorite', { rating: 9.7 }),
    movie('the other arrival', { rating: 7 }),
  ]
  const more = Array.from({ length: 15 }, (_, index) =>
    movie('archive-' + index, { rating: 5 + index / 4 }),
  )
  const rated = [
    ...more,
    recent[0],
    more[0],
    movie('unrated'),
    movie('show', { kind: 'Série', rating: 10 }),
    movie('invalid', { rating: 11 }),
  ]
  const shelves = buildHomeShelves(recent, rated)
  const ranking = shelves.find((s) => s.id === 'acclaimed')!
  assert.equal(ranking.items.length, 10)
  assert.deepEqual(ranking.items, [recent[0], ...more.toReversed().slice(0, 9)])
  assert(shelves[0].items.includes(recent[0]))
  assert.deepEqual(
    buildHomeShelves(recent).find((s) => s.id === 'acclaimed')?.items,
    recent,
  )
  assert.equal(
    buildHomeShelves(recent, []).some((s) => s.id === 'acclaimed'),
    false,
  )
})

test('large libraries remain finite and can supply their own genre', () => {
  const recent = Array.from({ length: 36 }, (_, i) =>
    movie('film-' + i, {
      genres: i % 3 ? ['Comédie', 'COMÉDIE'] : ['Drame'],
    }),
  )
  const rated = Array.from({ length: 36 }, (_, i) =>
    movie('rated-' + i, { rating: 8.5 }),
  )
  const shelves = buildHomeShelves(recent, rated)
  assert(shelves.length <= 7)
  assert(shelves.every((shelf) => shelf.items.length <= 12))
  const genre = shelves.find((shelf) => shelf.id === 'genre')
  assert.equal(genre?.genre, 'Comédie')
  assert.equal(genre.items.length, 12)
  assert.deepEqual(buildHomeShelves(recent, rated), shelves)
})
