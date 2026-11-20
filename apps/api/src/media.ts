import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import {
  safeExternalUrl,
  type MediaLocalization,
  type MediaReview,
  type ReviewPage,
  type WatchProviders,
} from '@hollyfilms/shared/media-details'
import type { PrismaClient } from './generated/prisma/client.ts'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'
import {
  localizeTmdb,
  mediaLocales,
  type MediaLocale,
  type TmdbLocalizedDetails,
} from './tmdb-localization.ts'

type Params = { id: string }
type ReviewInput = { content: string; rating: number | null }
type TmdbReview = {
  id: string
  author: string
  content: string
  created_at: string
  url?: string
  author_details?: { rating?: number | null }
}
type TmdbReviews = {
  results?: TmdbReview[]
  total_results?: number
  total_pages?: number
}
type Provider = {
  provider_id: number
  provider_name: string
  logo_path?: string
}
type ProviderRegion = {
  link?: string
  flatrate?: Provider[]
  free?: Provider[]
  ads?: Provider[]
  rent?: Provider[]
  buy?: Provider[]
}
const paramsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: '^[a-fA-F0-9-]{32,36}$' } },
}
const normalize = (id: string) => id.replaceAll('-', '').toLowerCase()

export function addMediaRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  config: ServerConfig,
) {
  // Cache only public TMDB responses; every route checks this user's library
  // access before consulting this cache. Never cache authentication decisions.
  const cache = new Map<string, { expires: number; value: unknown }>()
  app.addHook('onClose', async () => {
    cache.clear()
  })
  const pendingTmdb = new Map<string, Promise<unknown>>()
  async function tmdb<T>(
    path: string,
    select?: (value: unknown) => T,
  ): Promise<T> {
    const cached = cache.get(path)
    if (cached && cached.expires > Date.now()) return cached.value as T
    const pending = pendingTmdb.get(path)
    if (pending) return pending as Promise<T>
    const request = fetchTmdb(path, select)
    pendingTmdb.set(path, request)
    try {
      return await request
    } finally {
      pendingTmdb.delete(path)
    }
  }
  async function fetchTmdb<T>(
    path: string,
    select: ((value: unknown) => T) | undefined,
  ): Promise<T> {
    const response = await fetch('https://api.themoviedb.org/3/' + path, {
      headers: {
        Authorization: `Bearer ${config.tmdbToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(7000),
      redirect: 'error',
    })
    if (!response.ok)
      throw new ApiError(
        503,
        'TMDB_UNAVAILABLE',
        'Les données TMDB sont momentanément indisponibles.',
      )
    const data: unknown = await response.json()
    const value = select ? select(data) : (data as T)
    if (cache.size >= 1024) cache.delete(cache.keys().next().value!)
    cache.set(path, { expires: Date.now() + 15 * 60_000, value })
    return value
  }
  function authenticatedApi(request: FastifyRequest) {
    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    )?.[1]
    if (!token)
      throw new ApiError(
        401,
        'AUTH_REQUIRED',
        'Connecte-toi pour accéder à cette fiche.',
      )
    const device = request.headers['x-hollyfilms-device']
    return createJellyfinApi(
      config.jellyfinUrl,
      typeof device === 'string' && /^[a-z\d-]{1,128}$/i.test(device)
        ? device
        : undefined,
      token,
    )
  }
  async function getMediaUser(api: ReturnType<typeof authenticatedApi>) {
    const { data: user } = await getUserApi(api).getCurrentUser({
      timeout: 5000,
    })
    if (!user.Id || user.Policy?.IsDisabled)
      throw new ApiError(
        403,
        'ACCESS_DENIED',
        'Ce compte ne peut pas accéder à cette fiche.',
      )
    return { id: user.Id, name: user.Name }
  }
  function jellyfinError(error: unknown): never {
    if (error instanceof ApiError) throw error
    const status = (error as { response?: { status?: number } })?.response
      ?.status
    if (status === 401 || status === 403 || status === 404)
      throw new ApiError(
        status,
        'ACCESS_DENIED',
        'Ce titre n’est pas accessible avec ce compte.',
      )
    throw new ApiError(
      503,
      'JELLYFIN_UNAVAILABLE',
      'Impossible de vérifier l’accès à ce titre. Réessaie.',
    )
  }
  async function authorize(request: FastifyRequest<{ Params: Params }>) {
    const api = authenticatedApi(request)
    try {
      const user = await getMediaUser(api)
      const id = normalize(request.params.id)
      const { data: item } = await getLibraryApi(api).getItem(
        { itemId: id, userId: user.id },
        { timeout: 5000 },
      )
      if (!item.Id || normalize(item.Id) !== id)
        throw new ApiError(
          404,
          'MEDIA_NOT_FOUND',
          'Ce titre n’est pas accessible.',
        )
      return {
        userId: normalize(user.id),
        author: user.name || 'Membre',
        item,
        id,
      }
    } catch (error) {
      return jellyfinError(error)
    }
  }
  function tmdbPath(item: Awaited<ReturnType<typeof authorize>>['item']) {
    const id = item.ProviderIds?.Tmdb
    return id &&
      /^\d+$/.test(id) &&
      ['Movie', 'Series'].includes(item.Type ?? '')
      ? `${item.Type === 'Series' ? 'tv' : 'movie'}/${id}`
      : undefined
  }
  const routeOptions = {
    schema: { params: paramsSchema },
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }
  app.get<{ Querystring: { ids: string; locale: MediaLocale } }>(
    '/api/media/localizations',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['ids', 'locale'],
          properties: {
            ids: {
              type: 'string',
              pattern: '^[a-fA-F0-9]{32}(,[a-fA-F0-9]{32}){0,11}$',
            },
            locale: { type: 'string', enum: Object.keys(mediaLocales) },
          },
        },
      },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store')
      const api = authenticatedApi(request)
      const { locale } = request.query
      const ids = [...new Set(request.query.ids.toLowerCase().split(','))]
      const match = new Set(ids)
      const localized: Record<string, MediaLocalization> = {}
      const library = getLibraryApi(api)
      const items = await (async () => {
        try {
          const user = await getMediaUser(api)
          if (!config.tmdbToken) return []
          const { data } = await library.getItems(
            {
              ids,
              userId: user.id,
              recursive: true,
              collapseBoxSetItems: false,
              fields: ['ProviderIds'],
              limit: ids.length,
              enableTotalRecordCount: false,
              enableUserData: false,
              enableImages: false,
            },
            { timeout: 5000 },
          )
          return data.Items ?? []
        } catch (error) {
          return jellyfinError(error)
        }
      })()
      const { language, regions } = mediaLocales[locale]
      const params = new URLSearchParams({
        append_to_response: 'translations,images',
        language: `${language}-${regions[0]}`,
        include_image_language: `${language},null`,
      })
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const id = normalize(item.Id ?? '')
          const path = tmdbPath(item)
          if (!match.has(id) || !path) return
          const translation = await tmdb(path + '?' + params, (data) =>
            localizeTmdb(data as TmdbLocalizedDetails, locale),
          )
          if (translation) localized[id] = translation
        }),
      )
      return {
        items: localized,
        retry: results.some((result) => result.status === 'rejected'),
      }
    },
  )
  app.get<{ Params: Params; Querystring: { region?: string } }>(
    '/api/media/:id/providers',
    {
      ...routeOptions,
      schema: {
        ...routeOptions.schema,
        querystring: {
          type: 'object',
          properties: { region: { type: 'string', pattern: '^[A-Z]{2}$' } },
        },
      },
    },
    async (request): Promise<WatchProviders> => {
      const { item } = await authorize(request)
      const region = request.query.region || 'FR',
        path = tmdbPath(item)
      const empty = { region, regions: [], providers: [] }
      if (!path) return { ...empty, status: 'unmatched' }
      if (!config.tmdbToken) return { ...empty, status: 'unconfigured' }
      const data = await tmdb<{ results?: Record<string, ProviderRegion> }>(
        path + '/watch/providers',
      )
      const entry = data.results?.[region],
        providers = new Map<number, WatchProviders['providers'][number]>()
      for (const [key, label] of [
        ['flatrate', 'Abonnement'],
        ['free', 'Gratuit'],
        ['ads', 'Avec publicité'],
        ['rent', 'Location'],
        ['buy', 'Achat'],
      ] as const) {
        for (const p of entry?.[key] ?? []) {
          const provider = providers.get(p.provider_id) ?? {
            id: p.provider_id,
            name: p.provider_name,
            offers: [],
            logo:
              p.logo_path && /^\/[\w.-]+$/.test(p.logo_path)
                ? 'https://image.tmdb.org/t/p/w92' + p.logo_path
                : undefined,
          }
          provider.offers.push(label)
          providers.set(provider.id, provider)
        }
      }
      return {
        status: 'ready',
        region,
        regions: Object.keys(data.results ?? {}).filter((code) =>
          /^[A-Z]{2}$/.test(code),
        ),
        providers: [...providers.values()],
        url: safeExternalUrl(entry?.link),
      }
    },
  )
  const reviewView = (
    row: {
      id: string
      userId: string
      author: string
      content: string
      rating: number | null
      updatedAt: Date
    },
    userId: string,
  ): MediaReview => ({
    id: row.id,
    author: row.author,
    content: row.content,
    rating: row.rating,
    date: row.updatedAt.toISOString(),
    source: 'HollyFilms',
    own: row.userId === userId,
  })
  app.get<{ Params: Params; Querystring: { page?: string } }>(
    '/api/media/:id/reviews',
    {
      ...routeOptions,
      schema: {
        ...routeOptions.schema,
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string', pattern: '^[1-9][0-9]{0,3}$' },
          },
        },
      },
    },
    async (request): Promise<ReviewPage> => {
      const { userId, item, id } = await authorize(request),
        page = Number(request.query.page || 1),
        path = tmdbPath(item)
      const [rows, total, own] = await Promise.all([
        db.mediaReview.findMany({
          where: { itemId: id },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * 12,
          take: 12,
        }),
        db.mediaReview.count({ where: { itemId: id } }),
        db.mediaReview.findUnique({
          where: { itemId_userId: { itemId: id, userId } },
        }),
      ])
      let external: ReviewPage['external'] = !path
        ? 'unmatched'
        : !config.tmdbToken
          ? 'unconfigured'
          : 'ready'
      let remote: TmdbReviews = {}
      if (external === 'ready') {
        try {
          remote = await tmdb<TmdbReviews>(
            `${path}/reviews?language=en-US&page=${page}`,
          )
        } catch {
          external = 'unavailable'
        }
      }
      return {
        items: [
          ...rows.map((row) => reviewView(row, userId)),
          ...(remote.results ?? []).map((r) => ({
            id: 'tmdb-' + r.id,
            author: r.author,
            content: r.content,
            rating: r.author_details?.rating ?? null,
            date: r.created_at,
            source: 'TMDB' as const,
            url: safeExternalUrl(r.url),
          })),
        ],
        own: own ? reviewView(own, userId) : null,
        total: total + (remote.total_results ?? 0),
        hasMore: page * 12 < total || page < (remote.total_pages ?? 0),
        external,
      }
    },
  )
  app.put<{ Params: Params; Body: ReviewInput }>(
    '/api/media/:id/review',
    {
      ...routeOptions,
      bodyLimit: 65_536,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        params: paramsSchema,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['content', 'rating'],
          properties: {
            content: { type: 'string', maxLength: 10000 },
            rating: {
              anyOf: [
                { type: 'number', minimum: 0, maximum: 10 },
                { type: 'null' },
              ],
            },
          },
        },
      },
    },
    async (request) => {
      const { userId, author, id } = await authorize(request),
        content = request.body.content.trim(),
        rating = request.body.rating
      if (!content && rating == null)
        throw new ApiError(400, 'EMPTY_REVIEW', 'Ajoute un texte ou une note.')
      return reviewView(
        await db.mediaReview.upsert({
          where: { itemId_userId: { itemId: id, userId } },
          create: { itemId: id, userId, author, content, rating },
          update: { author, content, rating },
        }),
        userId,
      )
    },
  )
  app.delete<{ Params: Params }>(
    '/api/media/:id/review',
    routeOptions,
    async (request, reply) => {
      const { userId, id } = await authorize(request)
      await db.mediaReview.deleteMany({ where: { itemId: id, userId } })
      return reply.code(204).send()
    },
  )
}
