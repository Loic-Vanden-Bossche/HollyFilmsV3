import type { LibraryFilter, LibrarySort } from '@hollyfilms/shared/library'

export type AppRoute = {
  filter: LibraryFilter
  search: string
  sort?: LibrarySort
  collection?: string
  media?: string
  play?: string
  time?: number
  source?: string
  audio?: number
  subtitle?: number
  secondarySubtitle?: number
  paused?: boolean
}

const id = (value: string | null) =>
  value && /^[\w-]{1,128}$/.test(value) ? value : undefined
function number(value: string | null, min = 0) {
  if (!value?.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= 31_536_000
    ? parsed
    : undefined
}

export function readAppRoute(search: string, pathname = '/app'): AppRoute {
  const params = new URLSearchParams(search)
  const filter =
    /^\/app\/(favorites|movies|series|collections)\/?$/.exec(pathname)?.[1] ??
    params.get('view')
  const sort = params.get('sort')
  const play = id(params.get('play'))
  return {
    filter:
      filter === 'movies' ||
      filter === 'series' ||
      filter === 'favorites' ||
      filter === 'collections'
        ? filter
        : 'all',
    sort:
      sort === 'title' || sort === 'rating' || sort === 'year'
        ? sort
        : undefined,
    collection:
      filter === 'collections' ? id(params.get('collection')) : undefined,
    search: params.get('q') ?? '',
    media: id(params.get('media')),
    play,
    time: play ? number(params.get('t')) : undefined,
    source: play ? id(params.get('source')) : undefined,
    audio: play ? number(params.get('audio')) : undefined,
    subtitle: play ? number(params.get('sub'), -1) : undefined,
    secondarySubtitle: play ? number(params.get('sub2'), -1) : undefined,
    paused: play ? params.get('paused') === '1' : undefined,
  }
}

export function appRouteUrl(href: string, patch: Partial<AppRoute>) {
  const url = new URL(href)
  const route = { ...readAppRoute(url.search, url.pathname), ...patch }
  const appPath = /^\/app(?:\/(favorites|movies|series|collections))?\/?$/.test(
    url.pathname,
  )
  if (appPath)
    url.pathname = route.filter === 'all' ? '/app' : `/app/${route.filter}`
  if (
    (route.filter !== 'all' || route.search.trim()) &&
    url.hash.startsWith('#home-shelf-')
  )
    url.hash = ''
  const values = {
    view: appPath || route.filter === 'all' ? undefined : route.filter,
    sort: route.sort === 'recent' ? undefined : route.sort,
    collection: route.filter === 'collections' ? route.collection : undefined,
    q: route.search || undefined,
    media: route.media,
    play: route.play,
    t: route.play ? route.time : undefined,
    source: route.play ? route.source : undefined,
    audio: route.play ? route.audio : undefined,
    sub: route.play ? route.subtitle : undefined,
    sub2: route.play ? route.secondarySubtitle : undefined,
    paused: route.play && route.paused ? 1 : undefined,
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) url.searchParams.delete(key)
    else url.searchParams.set(key, String(value))
  }
  return url.pathname + url.search + url.hash
}
