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

test('several genres can supply distinct selections without repeating titles or alternate spellings', () => {
  const recent = Array.from({ length: 36 }, (_, i) =>
    movie('film-' + i, {
      genres: i % 3 ? ['Comédie', 'COMÉDIE'] : ['Drame'],
    }),
  )
  const rated = Array.from({ length: 36 }, (_, i) =>
    movie('rated-' + i, { rating: 8.5 }),
  )
  const shelves = buildHomeShelves(recent, rated)
  assert(shelves.every((shelf) => shelf.items.length <= 12))
  const genres = shelves.filter((shelf) => shelf.genre)
  assert.deepEqual(
    genres.map(({ id, genre, items }) => [id, genre, items.length]),
    [
      ['genre-comedie', 'Comédie', 12],
      ['genre-drame', 'Drame', 12],
    ],
  )
  assert.deepEqual(buildHomeShelves(recent, rated), shelves)
})

test('genre links are stable across reordering and only lead to distinct, populated selections', () => {
  const arrivals = [movie('first'), movie('second')]
  const archive = [
    movie('one', { genres: ['A/B', 'Overlap'] }),
    movie('two', { genres: ['A/B', 'Overlap'] }),
    movie('three', { genres: ['A B'] }),
    movie('four', { genres: ['A B'] }),
    movie('five', { genres: ['喜剧'] }),
    movie('six', { genres: ['喜剧'] }),
    movie('only', { genres: ['Solo', '  '] }),
  ]
  const genres = (items: MediaItem[]) =>
    buildHomeShelves(arrivals, items).filter((shelf) => shelf.genre)
  const first = genres(archive)
  assert.deepEqual(
    first.map((shelf) => shelf.genre),
    ['A/B', 'A B', '喜剧'],
  )
  assert.equal(new Set(first.map(({ id }) => id)).size, 3)
  const rearranged = genres(archive.toReversed())
  for (const shelf of first) {
    assert.match(shelf.id, /^genre-[a-z0-9_-]+$/)
    assert.equal(rearranged.find((s) => s.genre === shelf.genre)?.id, shelf.id)
  }
})

test('the home page keeps discovery finite even in a diverse library', () => {
  const archive = Array.from({ length: 30 }, (_, i) =>
    movie('archive-' + i, { genres: ['Genre ' + Math.floor(i / 2)] }),
  )
  const shelves = buildHomeShelves([movie('arrival')], archive)
  const themes = shelves.filter(
    ({ id }) => id !== 'recent' && id !== 'acclaimed',
  )
  assert.equal(themes.length, 14)
  assert(themes.every((shelf) => shelf.items.length === 2))
})

test('a genre can draw from multiple editorial shelves even when all its films are already shown', () => {
  const archive = [
    movie('quest', { genres: ['Aventure', 'Animation', 'Famille'] }),
    movie('voyage', { genres: ['Aventure'] }),
    movie('dream', { genres: ['Fantastique', 'Animation', 'Famille'] }),
    movie('magic', { genres: ['Fantastique'] }),
  ]
  const shelves = buildHomeShelves([movie('first'), movie('second')], archive)
  const animation = shelves.find(({ id }) => id === 'genre-animation')
  assert.deepEqual(
    animation?.items.map(({ id }) => id),
    ['quest', 'dream'],
  )
  assert(shelves.some(({ id }) => id === 'adventure'))
  assert(shelves.some(({ id }) => id === 'imagination'))
  // In this library Famille has exactly the same membership as Animation.
  assert(!shelves.some(({ id }) => id === 'genre-famille'))
})

test('duration, picture quality and decade picks follow the films’ metadata', () => {
  const archive = [
    movie('a', { minutes: 150, quality: '4K UHD', year: 2009 }),
    movie('b', { minutes: 149, quality: '1080p', year: 2000 }),
    movie('c', { minutes: 160, quality: '1080p', year: 2010 }),
    movie('d', { quality: '4K UHD', year: 2019 }),
    movie('unknown'),
    movie('series', {
      kind: 'Série',
      minutes: 160,
      quality: '4K UHD',
      year: 2009,
    }),
  ]
  const shelves = buildHomeShelves([], archive)
  const ids = (id: string) =>
    shelves
      .find((s) => s.id === id)
      ?.items.map((i) => i.id)
      .sort()
  assert.deepEqual(ids('epics'), ['a', 'c'])
  assert.deepEqual(ids('uhd'), ['a', 'd'])
  assert.deepEqual(ids('decade-2000'), ['a', 'b'])
  assert.deepEqual(ids('decade-2010'), ['c', 'd'])
})
