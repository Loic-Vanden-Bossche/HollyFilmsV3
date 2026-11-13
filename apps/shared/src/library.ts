import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js'
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api.js'
import { getUserDataApi } from '@jellyfin/sdk/lib/utils/api/user-data-api.js'
import { getUserViewApi } from '@jellyfin/sdk/lib/utils/api/user-view-api.js'
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js'
import type { JellyfinSession } from './accounts.ts'
import { createJellyfinApi } from './jellyfin.ts'
import { mediaMetadata } from './media-metadata.ts'
export { normalizeAudioLanguage } from './media-metadata.ts'

export type LibraryImage = {
  itemId: string
  type: 'Primary' | 'Backdrop' | 'Logo' | 'Chapter'
  tag: string
  index?: number
}
export type MediaItem = {
  id: string
  title: string
  kind: 'Film' | 'Série' | 'Épisode'
  year?: number
  overview: string
  genres: string[]
  rating?: number
  criticRating?: number
  favorite?: boolean
  watched?: boolean
  quality?: string
  audioLanguages?: string[]
  editions?: string[]
  logo?: LibraryImage | string
  trailers?: { url: string; name: string }[]
  classification?: string
  minutes?: number
  progress: number
  playbackPosition?: number
  seriesId?: string
  remainingMinutes?: number
  episode?: string
  poster?: LibraryImage | string
  backdrop?: LibraryImage | string
}
export type LibraryPage = { items: MediaItem[]; total: number }
export type LibraryFilter =
  'all' | 'favorites' | 'movies' | 'series' | 'collections'
export type LibrarySort = 'recent' | 'title' | 'rating' | 'year'
export type LibraryOptions = { sort?: LibrarySort; collectionId?: string }
export type CollectionItem = Pick<
  MediaItem,
  'id' | 'title' | 'overview' | 'poster' | 'backdrop'
> & { count?: number }
export type CollectionsPage = { items: CollectionItem[]; total: number }

export function toMediaItem(item: BaseItemDto): MediaItem | null {
  if (!item.Id || !item.Name) return null
  const runtime = item.RunTimeTicks ?? 0
  const position = item.UserData?.PlaybackPositionTicks ?? 0
  const progress =
    runtime > 0
      ? position / runtime
      : (item.UserData?.PlayedPercentage ?? 0) / 100
  const backdropId = item.BackdropImageTags?.[0]
    ? item.Id
    : item.ParentBackdropItemId
  const backdropTag =
    item.BackdropImageTags?.[0] ?? item.ParentBackdropImageTags?.[0]
  const posterId = item.ImageTags?.Primary ? item.Id : item.SeriesId
  const posterTag = item.ImageTags?.Primary ?? item.SeriesPrimaryImageTag
  return {
    id: item.Id,
    title: item.Type === 'Episode' ? item.SeriesName || item.Name : item.Name,
    kind:
      item.Type === 'Series'
        ? 'Série'
        : item.Type === 'Episode'
          ? 'Épisode'
          : 'Film',
    year: item.ProductionYear ?? undefined,
    overview: item.Overview ?? '',
    genres: item.Genres ?? [],
    rating: item.CommunityRating ?? undefined,
    criticRating: item.CriticRating ?? undefined,
    favorite: item.UserData?.IsFavorite ?? false,
    watched: item.UserData?.Played ?? false,
    ...mediaMetadata(item),
    logo: item.ImageTags?.Logo
      ? { itemId: item.Id, type: 'Logo', tag: item.ImageTags.Logo }
      : item.ParentLogoItemId && item.ParentLogoImageTag
        ? {
            itemId: item.ParentLogoItemId,
            type: 'Logo',
            tag: item.ParentLogoImageTag,
          }
        : undefined,
    trailers: (item.RemoteTrailers ?? []).flatMap((trailer) =>
      trailer.Url ? [{ url: trailer.Url, name: trailer.Name ?? '' }] : [],
    ),
    classification: item.OfficialRating ?? undefined,
    minutes: runtime > 0 ? Math.round(runtime / 600_000_000) : undefined,
    progress: Math.min(1, Math.max(0, progress)),
    playbackPosition: position / 10_000_000,
    seriesId: item.SeriesId ?? undefined,
    remainingMinutes:
      position > 0 && runtime > position
        ? Math.ceil((runtime - position) / 600_000_000)
        : undefined,
    episode:
      item.Type === 'Episode'
        ? [
            item.ParentIndexNumber != null ? 'S' + item.ParentIndexNumber : '',
            item.IndexNumber != null ? 'E' + item.IndexNumber : '',
            item.Name,
          ]
            .filter(Boolean)
            .join(' · ')
        : undefined,
    poster:
      posterId && posterTag
        ? { itemId: posterId, type: 'Primary', tag: posterTag }
        : undefined,
    backdrop:
      backdropId && backdropTag
        ? { itemId: backdropId, type: 'Backdrop', tag: backdropTag }
        : undefined,
  }
}

export async function getLibraryPage(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  filter: LibraryFilter,
  search: string,
  startIndex: number,
  signal?: AbortSignal,
  options: LibraryOptions = {},
): Promise<LibraryPage> {
  const api = createJellyfinApi(baseUrl, session.deviceId, session.accessToken)
  const { data } = await getLibraryApi(api).getItems(
    {
      userId,
      recursive: true,
      parentId: options.collectionId,
      collapseBoxSetItems: false,
      isFavorite: filter === 'favorites' ? true : undefined,
      includeItemTypes:
        filter === 'movies'
          ? ['Movie']
          : filter === 'series'
            ? ['Series']
            : ['Movie', 'Series'],
      searchTerm: search || undefined,
      startIndex,
      limit: 36,
      sortBy:
        options.sort === 'title'
          ? ['SortName']
          : options.sort === 'rating'
            ? ['CommunityRating', 'SortName']
            : options.sort === 'year'
              ? ['ProductionYear', 'SortName']
              : ['DateCreated', 'SortName'],
      sortOrder: [options.sort === 'title' ? 'Ascending' : 'Descending'],
      fields: [
        'Overview',
        'Genres',
        'RemoteTrailers',
        'MediaSources',
        'MediaStreams',
      ],
      enableUserData: true,
      enableImages: true,
      imageTypeLimit: 1,
      enableTotalRecordCount: true,
    },
    { signal, timeout: 10_000 },
  )
  return {
    items: (data.Items ?? [])
      .map(toMediaItem)
      .filter((item): item is MediaItem => item !== null),
    total: data.TotalRecordCount ?? 0,
  }
}

function toCollection(item: BaseItemDto): CollectionItem | null {
  const media = toMediaItem(item)
  if (!media || item.Type !== 'BoxSet') return null
  return {
    id: media.id,
    title: media.title,
    overview: media.overview,
    poster: media.poster,
    backdrop: media.backdrop,
    count: item.ChildCount ?? undefined,
  }
}

export async function getCollectionsPage(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  startIndex: number,
  search = '',
  signal?: AbortSignal,
): Promise<CollectionsPage> {
  const api = createJellyfinApi(baseUrl, session.deviceId, session.accessToken)
  const options = { signal, timeout: 10000 }
  const { data: views } = await getUserViewApi(api).getUserViews(
    { userId, includeHidden: true, includeExternalContent: false },
    options,
  )
  const collectionViews = (views.Items ?? []).filter(
    (view) => view.CollectionType === 'boxsets' && view.Id,
  )
  // Use the user's Collections library, including when hidden from My Media.
  // Explicit BoxSet filtering re-roots this query in Jellyfin 12; the library
  // itself supplies that filter when ParentId is used without IncludeItemTypes.
  // With no single collection library, retain the global, user-scoped listing.
  const parentId =
    collectionViews.length === 1 ? collectionViews[0].Id : undefined
  const { data } = await getLibraryApi(api).getItems(
    {
      userId,
      parentId,
      includeItemTypes: parentId ? undefined : ['BoxSet'],
      collapseBoxSetItems: false,
      recursive: true,
      startIndex,
      limit: 24,
      searchTerm: search || undefined,
      sortBy: ['SortName'],
      sortOrder: ['Ascending'],
      fields: ['Overview', 'ChildCount'],
      enableImages: true,
      imageTypeLimit: 1,
      enableUserData: true,
      enableTotalRecordCount: true,
    },
    options,
  )
  return {
    items: (data.Items ?? [])
      .map(toCollection)
      .filter((item): item is CollectionItem => item !== null),
    total: data.TotalRecordCount ?? 0,
  }
}

export async function getCollection(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  id: string,
  signal?: AbortSignal,
) {
  const api = createJellyfinApi(baseUrl, session.deviceId, session.accessToken)
  const { data } = await getLibraryApi(api).getItem(
    { userId, itemId: id },
    { signal, timeout: 10000 },
  )
  const collection = toCollection(data)
  if (!collection) throw new Error('Cette collection est indisponible.')
  return collection
}

export async function getResumeItems(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  signal?: AbortSignal,
  options: { episodesOnly?: boolean } = {},
) {
  const api = createJellyfinApi(baseUrl, session.deviceId, session.accessToken)
  const { data } = await getLibraryApi(api).getResumeItems(
    {
      userId,
      limit: 12,
      mediaTypes: ['Video'],
      includeItemTypes: options.episodesOnly ? ['Episode'] : undefined,
      fields: ['Overview', 'Genres', 'MediaSources', 'MediaStreams'],
      enableUserData: true,
      enableImages: true,
      imageTypeLimit: 1,
    },
    { signal, timeout: 10_000 },
  )
  return (data.Items ?? [])
    .map(toMediaItem)
    .filter((item): item is MediaItem => item !== null)
}

export async function getLibraryImage(
  baseUrl: string,
  session: JellyfinSession,
  image: LibraryImage,
  width: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const api = createJellyfinApi(baseUrl, session.deviceId, session.accessToken)
  const { data } = await getImageApi(api).getItemImage(
    {
      itemId: image.itemId,
      imageType: image.type,
      tag: image.tag,
      imageIndex: image.index ?? 0,
      maxWidth: width,
      quality: image.type === 'Logo' ? 100 : 90,
      format: image.type === 'Logo' ? 'Png' : 'Jpg',
    },
    { signal, timeout: 10_000, responseType: 'blob' },
  )
  return data
}

export type HeroPreview =
  { kind: 'youtube'; id: string } | { kind: 'video'; url: string }

export function youtubeId(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return
    const host = url.hostname.replace(/^www\./, '')
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(
              host,
            )
          ? (url.searchParams.get('v') ??
            url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1])
          : undefined
    return id && /^[\w-]{11}$/.test(id) ? id : undefined
  } catch {
    return undefined
  }
}

export async function getHeroPreview(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  item: MediaItem,
  signal?: AbortSignal,
): Promise<HeroPreview | null> {
  const api = getLibraryApi(
    createJellyfinApi(baseUrl, session.deviceId, session.accessToken),
  )
  const options = { signal, timeout: 5000 }
  const results = await Promise.allSettled([
    api.getThemeVideos(
      { itemId: item.id, userId, inheritFromParent: true },
      options,
    ),
    api.getLocalTrailers({ itemId: item.id, userId }, options),
  ])
  if (signal?.aborted) throw signal.reason
  const themes =
    results[0].status === 'fulfilled' ? (results[0].value.data.Items ?? []) : []
  const trailers =
    results[1].status === 'fulfilled' ? results[1].value.data : []
  const local = [...themes, ...trailers].find((video) => video.Id)
  if (local?.Id) {
    const url = new URL(
      baseUrl.replace(/\/$/, '') +
        '/Videos/' +
        encodeURIComponent(local.Id) +
        '/stream.mp4',
    )
    url.searchParams.set('api_key', session.accessToken)
    url.searchParams.set('static', 'true')
    if (local.MediaSources?.[0]?.Id)
      url.searchParams.set('mediaSourceId', local.MediaSources[0].Id)
    return { kind: 'video', url: url.href }
  }
  // Prefer the French trailer where metadata provides one, without a separate catalogue service.
  const remote = [...(item.trailers ?? [])].sort(
    (a, b) => Number(/\bVF\b/i.test(b.name)) - Number(/\bVF\b/i.test(a.name)),
  )
  for (const trailer of remote) {
    const id = youtubeId(trailer.url)
    if (id) return { kind: 'youtube', id }
  }
  return null
}

export async function setMediaFavorite(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  itemId: string,
  favorite: boolean,
) {
  const api = getUserDataApi(
    createJellyfinApi(baseUrl, session.deviceId, session.accessToken),
  )
  const { data } = favorite
    ? await api.markFavoriteItem({ userId, itemId }, { timeout: 10000 })
    : await api.unmarkFavoriteItem({ userId, itemId }, { timeout: 10000 })
  return data.IsFavorite ?? favorite
}

export async function setMediaWatched(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  itemId: string,
  watched: boolean,
) {
  const api = getUserDataApi(
    createJellyfinApi(baseUrl, session.deviceId, session.accessToken),
  )
  const { data } = watched
    ? await api.markPlayedItem({ userId, itemId }, { timeout: 10000 })
    : await api.markUnplayedItem({ userId, itemId }, { timeout: 10000 })
  return data.Played ?? watched
}
