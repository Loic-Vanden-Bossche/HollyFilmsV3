import type { MediaItem } from '@hollyfilms/shared/library'

const titles = {
  recent: 'Tout juste arrivés',
  suspense: 'Sous tension',
  adventure: 'Cap sur l’aventure',
  imagination: 'Voyage dans l’imaginaire',
  short: 'Une séance en 90 minutes',
  acclaimed: 'Les films les mieux notés',
  series: 'Côté séries',
  genre: '{genre} à l’affiche',
} as const

export type HomeShelfId = keyof typeof titles
export type HomeShelfBrowse = 'movies' | 'series'

export type HomeShelf = {
  id: HomeShelfId
  title: (typeof titles)[keyof typeof titles]
  items: MediaItem[]
  browse?: HomeShelfBrowse
  genre?: string
}

const moods = {
  suspense:
    /\b(thriller|suspense|crime|policier|mystery|mystere)\b|惊悚|悬疑|犯罪/,
  adventure: /\b(action|adventure|aventure)\b|动作|冒险/,
  imagination:
    /\b(science[ -]?fiction|sci[ -]?fi|fantasy|fantastique|fantaisie)\b|科幻|奇幻/,
}

function genreKey(genre: string) {
  return genre.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function distinct(items: readonly MediaItem[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

/** Each source is a single Jellyfin page. The recent source is already in
 * DateCreated order, which can differ from the films' theatrical releases. */
export function buildHomeShelves(
  recent: readonly MediaItem[],
  rated: readonly MediaItem[] = recent,
  series: readonly MediaItem[] = [],
): HomeShelf[] {
  const latest = distinct(recent)
  const pool = distinct([...latest, ...rated, ...series])
  const movies = pool.filter((item) => item.kind === 'Film')
  const shelves: HomeShelf[] = []
  const shown = new Set<string>()
  // Base the width of each selection on the first page so already visible
  // rows don't change length simply because another source finished loading.
  const limit = Math.min(
    12,
    Math.max(3, Math.ceil((latest.length || pool.length) / 3)),
  )

  function add(id: HomeShelf['id'], candidates: MediaItem[], genre?: string) {
    const items = candidates
      .filter((item) => !shown.has(item.id))
      .slice(0, limit)
    if (items.length < (id === 'recent' ? 1 : 2)) return
    for (const item of items) shown.add(item.id)
    shelves.push({
      id,
      title: titles[id],
      items,
      browse: id === 'series' ? 'series' : undefined,
      genre,
    })
  }

  // Leave room for distinct discoveries even if the entire library fits
  // in Jellyfin’s first page.
  add('recent', latest.slice(0, Math.max(2, Math.ceil(latest.length / 3))))
  // Rank the user's rating-sorted Jellyfin page (or their entire small
  // library). A top film keeps its rank even if another shelf features it.
  const ranking = distinct(rated)
    .filter(
      (item) =>
        item.kind === 'Film' &&
        (item.rating ?? 0) > 0 &&
        (item.rating ?? 0) <= 10,
    )
    .sort((a, b) => b.rating! - a.rating!)
    .slice(0, 10)
  if (ranking.length >= 2)
    shelves.push({
      id: 'acclaimed',
      title: titles.acclaimed,
      items: ranking,
      browse: 'movies',
    })
  for (const id of ['suspense', 'adventure', 'imagination'] as const) {
    add(
      id,
      movies.filter((item) =>
        item.genres.some((genre) => moods[id].test(genreKey(genre))),
      ),
    )
  }
  add(
    'short',
    movies.filter(
      ({ minutes }) => minutes != null && minutes > 0 && minutes <= 90,
    ),
  )
  add(
    'series',
    pool.filter((item) => item.kind === 'Série'),
  )

  if (shelves.length < 7) {
    // Let the library supply one more theme, including genres in languages
    // outside our editorial groupings. Keep the server's original spelling.
    const genres = new Map<string, { name: string; items: MediaItem[] }>()
    for (const item of pool) {
      if (shown.has(item.id)) continue
      for (const name of item.genres) {
        const key = genreKey(name)
        if (!key || Object.values(moods).some((mood) => mood.test(key)))
          continue
        const group = genres.get(key) ?? { name: name.trim(), items: [] }
        if (group.items.at(-1) !== item) group.items.push(item)
        genres.set(key, group)
      }
    }
    const largest = [...genres.values()].sort(
      (a, b) => b.items.length - a.items.length,
    )[0]
    if (largest) add('genre', largest.items, largest.name)
  }

  if (shelves.length === 1 && shelves[0].id === 'recent')
    shelves[0].items = latest.slice(0, 12)
  return shelves
}
