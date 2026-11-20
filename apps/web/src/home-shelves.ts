import type { MediaItem } from '@hollyfilms/shared/library'

const titles = {
  recent: 'Tout juste arrivés',
  suspense: 'Sous tension',
  adventure: 'Cap sur l’aventure',
  imagination: 'Voyage dans l’imaginaire',
  short: 'Une séance en 90 minutes',
  acclaimed: 'Les films les mieux notés',
  series: 'Côté séries',
  epics: 'Les films de 2 h 30 et plus',
  uhd: 'Grand écran en 4K',
  decade: 'Le cinéma des années {decade}',
  genre: '{genre} à l’affiche',
} as const

type EditorialShelfId = Exclude<keyof typeof titles, 'genre' | 'decade'>
export type HomeShelfId =
  EditorialShelfId | `genre-${string}` | `decade-${number}`
export type HomeShelfBrowse = 'movies' | 'series'

export type HomeShelf = {
  id: HomeShelfId
  title: (typeof titles)[keyof typeof titles]
  items: MediaItem[]
  browse?: HomeShelfBrowse
  genre?: string
  decade?: number
}

const moods = {
  suspense:
    /\b(thriller|suspense|crime|policier|mystery|mystere)\b|惊悚|悬疑|犯罪/,
  adventure: /\b(action|adventure|aventure)\b|动作|冒险/,
  imagination:
    /\b(science[ -]?fiction|sci[ -]?fi|fantasy|fantastique|fantaisie)\b|科幻|奇幻/,
}

function coveredByMood(key: string) {
  return Object.values(moods).some((mood) => mood.test(key))
}

function genreKey(genre: string) {
  return genre.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function distinct(items: readonly MediaItem[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function membership(items: readonly MediaItem[]) {
  return JSON.stringify(items.map(({ id }) => id).sort())
}

function genreShelfId(key: string): HomeShelfId {
  // Keep fragment links readable for simple names and unambiguous for any
  // punctuation or script present in the library's metadata.
  const slug = key.replace(
    /[^a-z0-9-]/gu,
    (character) => `_${character.codePointAt(0)!.toString(16)}_`,
  )
  return `genre-${slug}`
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
  // Base the width of each selection on the first page so already visible
  // rows don't change length simply because another source finished loading.
  const limit = Math.min(
    12,
    Math.max(3, Math.ceil((latest.length || pool.length) / 3)),
  )

  // Leave room for distinct discoveries even if the entire library fits
  // in Jellyfin’s first page.
  const arrivals = latest.slice(
    0,
    Math.min(limit, Math.max(2, Math.ceil(latest.length / 3))),
  )
  if (arrivals.length)
    shelves.push({ id: 'recent', title: titles.recent, items: arrivals })
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

  const themes: HomeShelf[] = []
  const shown = new Set(arrivals.map(({ id }) => id))
  const groups = new Set<string>()
  const previews = new Set<string>()
  function addTheme(
    shelf: Omit<HomeShelf, 'items'>,
    candidates: MediaItem[],
    selection: 'editorial' | 'catalogue' = 'catalogue',
  ) {
    if (themes.length >= 14 || candidates.length < 2) return
    const group = membership(candidates)
    if (groups.has(group)) return
    // A film can belong to both adventure and animation. Prefer fresh picks,
    // but keep a real category even if other shelves already feature its films.
    const fresh = candidates.filter(({ id }) => !shown.has(id))
    const picks =
      selection === 'editorial' && fresh.length >= 2
        ? fresh
        : [...fresh, ...candidates.filter(({ id }) => shown.has(id))]
    const items = picks.slice(0, limit)
    const preview = membership(items)
    if (previews.has(preview)) return
    groups.add(group)
    previews.add(preview)
    for (const { id } of items) shown.add(id)
    themes.push({ ...shelf, items })
  }
  for (const id of ['suspense', 'adventure', 'imagination'] as const) {
    addTheme(
      { id, title: titles[id] },
      movies.filter((item) =>
        item.genres.some((genre) => moods[id].test(genreKey(genre))),
      ),
      'editorial',
    )
  }
  addTheme(
    { id: 'short', title: titles.short },
    movies.filter(
      ({ minutes }) => minutes != null && minutes > 0 && minutes <= 90,
    ),
    'editorial',
  )
  addTheme(
    { id: 'series', title: titles.series, browse: 'series' },
    pool.filter((item) => item.kind === 'Série'),
    'editorial',
  )

  const genres = new Map<string, { name: string; items: MediaItem[] }>()
  for (const item of pool) {
    for (const name of item.genres) {
      const key = genreKey(name)
      if (!key) continue
      const group = genres.get(key) ?? { name: name.trim(), items: [] }
      if (group.items.at(-1) !== item) group.items.push(item)
      genres.set(key, group)
    }
  }
  // Give animation, drama and other distinct genres a place before breaking
  // the existing mood shelves down into action, adventure or fantasy again.
  const popularGenres = [...genres].sort(
    ([keyA, a], [keyB, b]) =>
      Number(coveredByMood(keyA)) - Number(coveredByMood(keyB)) ||
      b.items.length - a.items.length,
  )
  function addGenre([key, group]: (typeof popularGenres)[number]) {
    addTheme(
      { id: genreShelfId(key), title: titles.genre, genre: group.name },
      group.items,
    )
  }
  // Mix genres with other ways of choosing a film before the rail fills up.
  popularGenres.slice(0, 4).forEach(addGenre)
  addTheme(
    { id: 'epics', title: titles.epics },
    movies.filter(({ minutes }) => (minutes ?? 0) >= 150),
  )
  addTheme(
    { id: 'uhd', title: titles.uhd },
    movies.filter(({ quality }) => quality === '4K UHD'),
  )
  const decades = new Map<number, MediaItem[]>()
  for (const item of movies) {
    if (!item.year || item.year < 1880 || !Number.isInteger(item.year)) continue
    const decade = Math.floor(item.year / 10) * 10
    const group = decades.get(decade) ?? []
    group.push(item)
    decades.set(decade, group)
  }
  const byDecade = [...decades].sort(([, a], [, b]) => b.length - a.length)
  for (const [decade, group] of byDecade.slice(0, 2)) {
    addTheme({ id: `decade-${decade}`, title: titles.decade, decade }, group)
  }
  popularGenres.slice(4).forEach(addGenre)
  shelves.push(...themes)
  if (shelves.length === 1 && shelves[0].id === 'recent')
    shelves[0].items = latest.slice(0, 12)
  return shelves
}
