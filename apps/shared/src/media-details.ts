import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js'
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js'
import type { JellyfinSession } from './accounts.ts'
import { createJellyfinApi } from './jellyfin.ts'
import {
  toMediaItem,
  type LibraryImage,
  type MediaItem,
  type LibraryPage,
} from './library.ts'

export type MediaPerson = {
  id?: string
  name: string
  role: string
  type: string
  image?: LibraryImage | string
}
export type MediaChapter = {
  name: string
  position: number
  image?: LibraryImage | string
}
export type MediaCollection = {
  id: string
  title: string
  count?: number
  poster?: LibraryImage | string
  item?: MediaItem
}
export type MediaDetailsData = {
  item: MediaItem
  tags: string[]
  people: MediaPerson[]
  directors: string[]
  writers: string[]
  studios: string[]
  links: { name: string; url: string }[]
  chapters: MediaChapter[]
}
export type MediaRelations = {
  similar: MediaItem[]
  collections: MediaCollection[]
  errors: string[]
}
export type MediaReview = {
  id: string
  author: string
  content: string
  rating: number | null
  date: string
  source: 'HollyFilms' | 'TMDB'
  url?: string
  own?: boolean
}
export type ReviewPage = {
  items: MediaReview[]
  own: MediaReview | null
  total: number
  hasMore: boolean
  external: 'ready' | 'unconfigured' | 'unmatched' | 'unavailable'
}
export type WatchProviders = {
  status: 'ready' | 'unconfigured' | 'unmatched'
  region: string
  regions: string[]
  url?: string
  providers: { id: number; name: string; logo?: string; offers: string[] }[]
}

export function safeExternalUrl(value?: string | null) {
  try {
    const url = new URL(value ?? '')
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}
export function toMediaDetails(data: BaseItemDto): MediaDetailsData {
  const item = toMediaItem(data)
  if (!item) throw new Error('Fiche média invalide')
  const people = (data.People ?? []).flatMap((person) =>
    person.Name
      ? [
          {
            id: person.Id,
            name: person.Name,
            role: person.Role ?? person.Type ?? '',
            type: person.Type ?? '',
            image:
              person.Id && person.PrimaryImageTag
                ? {
                    itemId: person.Id,
                    type: 'Primary' as const,
                    tag: person.PrimaryImageTag,
                  }
                : undefined,
          },
        ]
      : [],
  )
  return {
    item,
    people,
    tags: data.Tags ?? [],
    studios: (data.Studios ?? []).flatMap((s) => (s.Name ? [s.Name] : [])),
    directors: people.filter((p) => p.type === 'Director').map((p) => p.name),
    writers: people
      .filter((p) => ['Writer', 'Screenplay'].includes(p.type))
      .map((p) => p.name),
    links: (data.ExternalUrls ?? []).flatMap((link) => {
      const url = safeExternalUrl(link.Url)
      return url ? [{ name: link.Name || new URL(url).hostname, url }] : []
    }),
    chapters: (data.Chapters ?? []).flatMap((chapter, index) =>
      chapter.StartPositionTicks != null && chapter.StartPositionTicks >= 0
        ? [
            {
              name: chapter.Name || `Scène ${index + 1}`,
              position: chapter.StartPositionTicks / 10_000_000,
              image: chapter.ImageTag
                ? {
                    itemId: item.id,
                    type: 'Chapter' as const,
                    tag: chapter.ImageTag,
                    index,
                  }
                : undefined,
            },
          ]
        : [],
    ),
  }
}
const client = (base: string, session: JellyfinSession) =>
  getLibraryApi(createJellyfinApi(base, session.deviceId, session.accessToken))
const mediaItems = (items: BaseItemDto[] = []) =>
  items.map(toMediaItem).filter((item): item is MediaItem => !!item)
export async function getMediaDetails(
  base: string,
  session: JellyfinSession,
  userId: string,
  itemId: string,
  signal?: AbortSignal,
) {
  return toMediaDetails(
    (
      await client(base, session).getItem(
        { itemId, userId },
        { signal, timeout: 10000 },
      )
    ).data,
  )
}
export async function getMediaRelations(
  base: string,
  session: JellyfinSession,
  userId: string,
  itemId: string,
  signal?: AbortSignal,
): Promise<MediaRelations> {
  const api = client(base, session),
    options = { signal, timeout: 10000 }
  const [similar, collections] = await Promise.allSettled([
    api.getSimilarItems(
      {
        itemId,
        userId,
        limit: 18,
        fields: [
          'Overview',
          'Genres',
          'RemoteTrailers',
          'MediaSources',
          'MediaStreams',
        ],
      },
      options,
    ),
    api.getItemCollections(
      { itemId, userId, limit: 100, fields: ['MediaSources', 'MediaStreams'] },
      options,
    ),
  ])
  if (signal?.aborted) throw signal.reason
  return {
    similar:
      similar.status === 'fulfilled'
        ? mediaItems(similar.value.data.Items).filter((i) => i.id !== itemId)
        : [],
    collections:
      collections.status === 'fulfilled'
        ? (collections.value.data.Items ?? []).flatMap((c) =>
            c.Id && c.Name
              ? [
                  {
                    id: c.Id,
                    title: c.Name,
                    item: toMediaItem(c) ?? undefined,
                    count: c.ChildCount ?? undefined,
                    poster: c.ImageTags?.Primary
                      ? {
                          itemId: c.Id,
                          type: 'Primary' as const,
                          tag: c.ImageTags.Primary,
                        }
                      : undefined,
                  },
                ]
              : [],
          )
        : [],
    errors: [
      ...(similar.status === 'rejected'
        ? ['Les recommandations n’ont pas pu être chargées.']
        : []),
      ...(collections.status === 'rejected'
        ? ['Les collections n’ont pas pu être chargées.']
        : []),
    ],
  }
}
export async function getRelatedPage(
  base: string,
  session: JellyfinSession,
  userId: string,
  filter: { parentId?: string; personId?: string },
  startIndex = 0,
  signal?: AbortSignal,
): Promise<LibraryPage> {
  const { data } = await client(base, session).getItems(
    {
      userId,
      parentId: filter.parentId,
      personIds: filter.personId ? [filter.personId] : undefined,
      recursive: true,
      includeItemTypes: ['Movie', 'Series'],
      fields: [
        'Overview',
        'Genres',
        'RemoteTrailers',
        'MediaSources',
        'MediaStreams',
      ],
      limit: 36,
      startIndex,
      enableUserData: true,
      sortBy: ['SortName'],
      enableTotalRecordCount: true,
    },
    { signal, timeout: 10000 },
  )
  return { items: mediaItems(data.Items), total: data.TotalRecordCount ?? 0 }
}
export async function mediaRequest<T>(
  session: JellyfinSession,
  path: string,
  options: { signal?: AbortSignal; method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch('/api/media/' + path, {
    signal: options.signal,
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-Hollyfilms-Device': session.deviceId,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(
      error?.message || 'Impossible de charger ces informations. Réessaie.',
      { cause: typeof error?.code === 'string' ? error.code : undefined },
    )
  }
  return response.status === 204 ? (undefined as T) : response.json()
}
