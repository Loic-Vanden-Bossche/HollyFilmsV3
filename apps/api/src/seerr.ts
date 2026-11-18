import type {
  DiscoveryTitle,
  MediaRequestItem,
  RequestMediaType,
} from '@hollyfilms/shared/requests'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'

export type SeerrUser = {
  id: number
  jellyfinUserId?: string
  permissions: number
  displayName?: string
  username?: string
  jellyfinUsername?: string
}
type Download = {
  size: number
  sizeLeft: number
  status: string
  timeLeft?: string
  title?: string
}
export type SeerrMedia = {
  id: number
  tmdbId: number
  status: number
  status4k?: number
  jellyfinMediaId?: string
  externalServiceId?: number
  externalServiceId4k?: number
  serviceUrl?: string
  serviceUrl4k?: string
  downloadStatus?: Download[]
  downloadStatus4k?: Download[]
  requests?: SeerrRequest[]
}
export type SeerrTitle = {
  id: number
  mediaType?: RequestMediaType | 'person'
  title?: string
  name?: string
  overview?: string
  releaseDate?: string
  firstAirDate?: string
  posterPath?: string
  voteAverage?: number
  adult?: boolean
  mediaInfo?: SeerrMedia
}
export type SeerrRequest = {
  id: number
  type: RequestMediaType
  status: number
  createdAt: string
  updatedAt: string
  is4k: boolean
  serverId?: number
  profileId?: number
  profileName?: string
  rootFolder?: string
  seasons?: { seasonNumber: number }[]
  media: SeerrMedia
  requestedBy: SeerrUser
  modifiedBy?: SeerrUser
}
export type SeerrService = {
  id: number
  name: string
  isDefault: boolean
  is4k: boolean
}
const normalize = (id: string) => id.replaceAll('-', '').toLowerCase()
const name = (user?: SeerrUser) =>
  user?.displayName ||
  user?.jellyfinUsername ||
  user?.username ||
  String(user?.id ?? '')

export function seerrClient(config: ServerConfig) {
  const titles = new Map<string, { expires: number; title: SeerrTitle }>()
  async function call<T>(
    path: string,
    init: RequestInit = {},
    userId?: number,
  ): Promise<T> {
    if (!config.seerr)
      throw new ApiError(
        503,
        'SEERR_DISABLED',
        'Les demandes de médias sont indisponibles.',
      )
    let response: Response
    try {
      response = await fetch(`${config.seerr.url}/api/v1/${path}`, {
        ...init,
        headers: {
          'X-Api-Key': config.seerr.apiKey,
          'Content-Type': 'application/json',
          ...(userId == null ? {} : { 'X-Api-User': String(userId) }),
        },
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      })
    } catch {
      throw new ApiError(
        503,
        'SEERR_UNAVAILABLE',
        'Le service de demandes est momentanément indisponible.',
      )
    }
    if (!response.ok) {
      const code =
        response.status === 404
          ? 'REQUEST_NOT_FOUND'
          : response.status === 409
            ? 'REQUEST_EXISTS'
            : response.status === 403
              ? 'REQUEST_FORBIDDEN'
              : 'SEERR_UNAVAILABLE'
      throw new ApiError(
        response.status === 404 ||
          response.status === 409 ||
          response.status === 403
          ? response.status
          : 503,
        code,
        'La demande n’a pas pu être traitée.',
      )
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T)
  }
  async function user(
    jellyfinId: string,
    create = false,
  ): Promise<SeerrUser | undefined> {
    try {
      const result = await call<SeerrUser>(
        'user/jellyfin/' + normalize(jellyfinId),
      )
      if (
        !result.jellyfinUserId ||
        normalize(result.jellyfinUserId) !== normalize(jellyfinId)
      )
        throw new ApiError(
          503,
          'SEERR_IDENTITY',
          'Le compte du service de demandes ne correspond pas.',
        )
      return result
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 404) throw error
      if (!create) return undefined
      await call('user/import-from-jellyfin', {
        method: 'POST',
        body: JSON.stringify({ jellyfinUserIds: [normalize(jellyfinId)] }),
      })
      return user(jellyfinId)
    }
  }
  async function detail(type: RequestMediaType, id: number, language: string) {
    return call<SeerrTitle>(
      `${type}/${id}?language=${encodeURIComponent(language)}`,
    )
  }
  async function title(type: RequestMediaType, id: number, language: string) {
    const key = `${type}:${id}:${language}`
    const cached = titles.get(key)
    if (cached && cached.expires > Date.now()) return cached.title
    const data = await detail(type, id, language)
    // Cache only public descriptive metadata, never availability or requester identities.
    const value: SeerrTitle = {
      id,
      title: data.title,
      name: data.name,
      overview: data.overview,
      releaseDate: data.releaseDate,
      firstAirDate: data.firstAirDate,
      posterPath: data.posterPath,
      voteAverage: data.voteAverage,
    }
    if (titles.size >= 256) titles.delete(titles.keys().next().value!)
    titles.set(key, { title: value, expires: Date.now() + 300000 })
    return value
  }
  function discovery(
    item: SeerrTitle,
    type: RequestMediaType,
    seerrUser?: SeerrUser,
  ): DiscoveryTitle {
    const own = item.mediaInfo?.requests?.find(
      (request) =>
        request.requestedBy?.id === seerrUser?.id && request.status !== 3,
    )
    return {
      id: item.id,
      type,
      title: item.title || item.name || `TMDB ${item.id}`,
      overview: item.overview ?? '',
      year: (item.releaseDate || item.firstAirDate)?.slice(0, 4),
      poster:
        item.posterPath && /^\/[\w.-]+$/.test(item.posterPath)
          ? 'https://image.tmdb.org/t/p/w342' + item.posterPath
          : undefined,
      rating: item.voteAverage,
      mediaStatus: item.mediaInfo?.status ?? 1,
      requested: !!item.mediaInfo && [2, 3].includes(item.mediaInfo.status),
      requestId: own?.id,
    }
  }
  async function requestView(
    request: SeerrRequest,
    language: string,
    admin: boolean,
  ): Promise<MediaRequestItem> {
    const metadata = await title(request.type, request.media.tmdbId, language)
    let serviceUrl: string | undefined
    const upstreamUrl = request.is4k
      ? request.media.serviceUrl4k
      : request.media.serviceUrl
    if (admin && upstreamUrl) {
      try {
        const url = new URL(upstreamUrl)
        if (
          ['https:', 'http:'].includes(url.protocol) &&
          !url.username &&
          !url.password
        )
          serviceUrl = url.origin + url.pathname
      } catch {
        /* Invalid upstream link is omitted. */
      }
    }
    return {
      id: request.id,
      title: discovery(
        {
          ...metadata,
          mediaInfo: {
            ...request.media,
            status: request.is4k
              ? (request.media.status4k ?? 1)
              : request.media.status,
          },
        },
        request.type,
      ),
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      is4k: request.is4k,
      seasons: request.seasons?.map((season) => season.seasonNumber) ?? [],
      downloads:
        (request.is4k
          ? request.media.downloadStatus4k
          : request.media.downloadStatus
        )?.map((download) => ({
          progress:
            download.size > 0 && Number.isFinite(download.sizeLeft)
              ? Math.max(
                  0,
                  Math.min(100, (1 - download.sizeLeft / download.size) * 100),
                )
              : null,
          status: download.status,
          remaining: download.timeLeft,
          title: admin ? download.title : undefined,
        })) ?? [],
      ...(admin
        ? {
            admin: {
              requestedBy: name(request.requestedBy),
              modifiedBy: request.modifiedBy
                ? name(request.modifiedBy)
                : undefined,
              serverId: request.serverId,
              profileId: request.profileId,
              profileName: request.profileName,
              rootFolder: request.rootFolder,
              externalId: request.is4k
                ? request.media.externalServiceId4k
                : request.media.externalServiceId,
              serviceUrl,
            },
          }
        : {}),
    }
  }
  function cachedRequestTitle(request: SeerrRequest) {
    for (const language of ['fr', 'en', 'zh-CN']) {
      const entry = titles.get(
        `${request.type}:${request.media.tmdbId}:${language}`,
      )
      if (entry && entry.expires > Date.now())
        return entry.title.title || entry.title.name
    }
  }
  return { call, user, detail, discovery, requestView, cachedRequestTitle }
}
