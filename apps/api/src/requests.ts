import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import type {
  DiscoveryPage,
  RequestFilter,
  RequestMediaType,
  RequestsPageData,
  RequestServices,
} from '@hollyfilms/shared/requests'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'
import type { PrismaClient } from './generated/prisma/client.ts'
import {
  seerrClient,
  type SeerrTitle,
  type SeerrRequest,
  type SeerrService,
} from './seerr.ts'

const languageSchema = { type: 'string', enum: ['fr', 'en', 'zh-CN'] }
const filters = [
  'all',
  'pending',
  'approved',
  'processing',
  'available',
  'failed',
]
const idSchema = { type: 'string', pattern: '^[1-9][0-9]{0,9}$' }
const querySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: idSchema,
    filter: { type: 'string', enum: filters },
    language: languageSchema,
  },
}
const limited = { rateLimit: { max: 60, timeWindow: '1 minute' } }

export function addRequestRoutes(
  app: FastifyInstance,
  config: ServerConfig,
  db: PrismaClient,
) {
  const seerr = seerrClient(config)
  const operations = new Map<string, Promise<unknown>>()
  async function authorize(request: FastifyRequest, admin = false) {
    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    )?.[1]
    if (!token)
      throw new ApiError(401, 'AUTH_REQUIRED', 'Reconnecte-toi pour continuer.')
    const device = request.headers['x-hollyfilms-device']
    const api = createJellyfinApi(
      config.jellyfinUrl,
      typeof device === 'string' && /^[a-z\d-]{1,128}$/i.test(device)
        ? device
        : undefined,
      token,
    )
    try {
      const { data } = await getUserApi(api).getCurrentUser({ timeout: 5000 })
      if (!data.Id || data.Policy?.IsDisabled)
        throw new ApiError(403, 'ACCESS_DENIED', 'Ce compte est désactivé.')
      const isAdmin = data.Policy?.IsAdministrator === true
      if (admin && !isAdmin)
        throw new ApiError(
          403,
          'ADMIN_REQUIRED',
          'Un compte administrateur est requis.',
        )
      return { id: data.Id, admin: isAdmin }
    } catch (error) {
      if (error instanceof ApiError) throw error
      const status = (error as { response?: { status?: number } }).response
        ?.status
      throw new ApiError(
        status === 401 || status === 403 ? status : 503,
        status === 401 || status === 403
          ? 'ACCESS_DENIED'
          : 'JELLYFIN_UNAVAILABLE',
        'Impossible de vérifier la session.',
      )
    }
  }
  async function services(admin: boolean): Promise<RequestServices> {
    if (!config.seerr) return { enabled: false, movies: false, series: false }
    const [radarr, sonarr] = await Promise.all([
      seerr.call<SeerrService[]>('service/radarr'),
      seerr.call<SeerrService[]>('service/sonarr'),
    ])
    return {
      enabled: true,
      movies: radarr.some((entry) => entry.isDefault && !entry.is4k),
      series: sonarr.some((entry) => entry.isDefault && !entry.is4k),
      ...(admin
        ? {
            seerrUrl: config.seerr.url,
            services: [
              ...radarr.map((entry) => ({
                id: entry.id,
                name: entry.name,
                isDefault: entry.isDefault,
                is4k: entry.is4k,
                type: 'movie' as const,
              })),
              ...sonarr.map((entry) => ({
                id: entry.id,
                name: entry.name,
                isDefault: entry.isDefault,
                is4k: entry.is4k,
                type: 'tv' as const,
              })),
            ],
            counts: Object.fromEntries(
              Object.entries(
                await seerr.call<Record<string, unknown>>('request/count'),
              ).filter(([, value]) => typeof value === 'number'),
            ) as Record<string, number>,
          }
        : {}),
    }
  }
  app.get('/api/requests/options', { config: limited }, async (request) => {
    const user = await authorize(request)
    return services(user.admin)
  })
  app.get<{
    Querystring: {
      q: string
      page?: string
      language?: string
      type?: RequestMediaType
    }
  }>(
    '/api/requests/search',
    {
      config: limited,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 2, maxLength: 200 },
            page: idSchema,
            language: languageSchema,
            type: { type: 'string', enum: ['movie', 'tv'] },
          },
        },
      },
    },
    async (request): Promise<DiscoveryPage> => {
      const identity = await authorize(request)
      const user = await seerr.user(identity.id)
      const query = new URLSearchParams({
        query: request.query.q,
        page: request.query.page ?? '1',
        language: request.query.language ?? 'fr',
      })
      const data = await seerr.call<{
        results: SeerrTitle[]
        page: number
        totalPages: number
      }>('search?' + query, {}, user?.id)
      return {
        page: data.page,
        pages: data.totalPages,
        items: data.results
          .filter(
            (item) =>
              ['movie', 'tv'].includes(item.mediaType ?? '') &&
              !item.adult &&
              (!request.query.type || item.mediaType === request.query.type) &&
              item.mediaInfo?.status !== 5,
          )
          .map((item) =>
            seerr.discovery(item, item.mediaType as RequestMediaType, user),
          ),
      }
    },
  )
  async function listing(
    request: FastifyRequest<{
      Querystring: { page?: string; filter?: RequestFilter; language?: string }
    }>,
    admin: boolean,
  ): Promise<RequestsPageData> {
    const identity = await authorize(request, admin)
    const user = admin ? undefined : await seerr.user(identity.id)
    const page = Number(request.query.page ?? 1)
    if (!admin && !user)
      return { items: [], page, pages: 0, total: 0, serviceErrors: [] }
    const query = new URLSearchParams({
      take: '20',
      skip: String((page - 1) * 20),
      filter: request.query.filter ?? 'all',
      sort: 'added',
      ...(user ? { requestedBy: String(user.id) } : {}),
    })
    const data = await seerr.call<{
      results: SeerrRequest[]
      pageInfo: { pages: number; results: number }
      serviceErrors?: {
        radarr?: { name: string }[]
        sonarr?: { name: string }[]
      }
    }>('request?' + query, {}, user?.id)
    const rows = data.results.filter(
      (row) => admin || row.requestedBy.id === user!.id,
    )
    // Bound concurrent metadata lookups while keeping current request/download state uncached.
    const items: RequestsPageData['items'] = []
    for (let start = 0; start < rows.length; start += 4)
      items.push(
        ...(await Promise.all(
          rows
            .slice(start, start + 4)
            .map((row) =>
              seerr.requestView(row, request.query.language ?? 'fr', admin),
            ),
        )),
      )
    return {
      items,
      page,
      pages: data.pageInfo.pages,
      total: data.pageInfo.results,
      serviceErrors: admin
        ? [
            ...(data.serviceErrors?.radarr ?? []),
            ...(data.serviceErrors?.sonarr ?? []),
          ].map((service) => service.name)
        : [],
    }
  }
  app.get<{
    Querystring: { page?: string; filter?: RequestFilter; language?: string }
  }>(
    '/api/requests',
    { config: limited, schema: { querystring: querySchema } },
    (request) => listing(request, false),
  )
  app.get<{
    Querystring: { page?: string; filter?: RequestFilter; language?: string }
  }>(
    '/api/admin/media-requests',
    { config: limited, schema: { querystring: querySchema } },
    (request) => listing(request, true),
  )
  app.post<{ Body: { type: RequestMediaType; id: number; language?: string } }>(
    '/api/requests',
    {
      config: { rateLimit: { max: 12, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'id'],
          properties: {
            type: { type: 'string', enum: ['movie', 'tv'] },
            id: { type: 'integer', minimum: 1, maximum: 2147483647 },
            language: languageSchema,
          },
        },
      },
    },
    async (request) => {
      const identity = await authorize(request)
      const key = `${identity.id}:${request.body.type}:${request.body.id}`
      const pending = operations.get(key)
      if (pending) return pending
      const operation = (async () => {
        const user = await seerr.user(identity.id, true)
        if (!user)
          throw new ApiError(
            503,
            'SEERR_IDENTITY',
            'Impossible de lier le compte au service de demandes.',
          )
        // Normal requests must never execute with the global key owner's privileges.
        // If an existing Seerr account grants auto-approval, fail before making a request.
        const autoApproval = 2 | 16 | 128 | 256 | 512 | 32768 | 65536 | 131072
        if (!identity.admin && (user.permissions & autoApproval) !== 0)
          throw new ApiError(
            403,
            'REQUEST_APPROVAL_POLICY',
            'Les permissions Seerr de ce compte doivent être vérifiées par un administrateur.',
          )
        const media = await seerr.detail(
          request.body.type,
          request.body.id,
          request.body.language ?? 'fr',
        )
        if (media.adult || media.mediaInfo?.status === 5)
          throw new ApiError(
            409,
            'REQUEST_EXISTS',
            'Ce titre est déjà disponible ou ne peut pas être demandé.',
          )
        let result = media.mediaInfo?.requests?.find(
          (row) => row.requestedBy?.id === user.id && row.status !== 3,
        )
        if (!result) {
          const available = await services(false)
          if (
            !(request.body.type === 'movie'
              ? available.movies
              : available.series)
          )
            throw new ApiError(
              503,
              'REQUEST_SERVICE_MISSING',
              'Aucun service de téléchargement par défaut n’est configuré pour ce type de média.',
            )
          try {
            result = await seerr.call<SeerrRequest>(
              'request',
              {
                method: 'POST',
                body: JSON.stringify({
                  mediaType: request.body.type,
                  mediaId: request.body.id,
                  ...(request.body.type === 'tv' ? { seasons: 'all' } : {}),
                }),
              },
              user.id,
            )
          } catch (error) {
            if (!(error instanceof ApiError) || error.statusCode !== 409)
              throw error
            const refreshed = await seerr.detail(
              request.body.type,
              request.body.id,
              request.body.language ?? 'fr',
            )
            result = refreshed.mediaInfo?.requests?.find(
              (row) => row.requestedBy?.id === user.id && row.status !== 3,
            )
            if (!result) throw error
          }
        }
        if (identity.admin && result.status === 1)
          result = await seerr.call<SeerrRequest>(
            `request/${result.id}/approve`,
            { method: 'POST' },
          )
        return seerr.requestView(
          result,
          request.body.language ?? 'fr',
          identity.admin,
        )
      })()
      operations.set(key, operation)
      try {
        return await operation
      } finally {
        if (operations.get(key) === operation) operations.delete(key)
      }
    },
  )
  app.post<{ Params: { id: string; action: 'approve' | 'decline' | 'retry' } }>(
    '/api/admin/media-requests/:id/:action',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        params: {
          type: 'object',
          required: ['id', 'action'],
          properties: {
            id: idSchema,
            action: { type: 'string', enum: ['approve', 'decline', 'retry'] },
          },
        },
      },
    },
    async (request) => {
      await authorize(request, true)
      return db.$transaction(
        async (transaction) => {
          // Shared across API replicas; re-read after the lock so competing decisions cannot both win.
          await transaction.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`seerr:request:${request.params.id}`}, 0))`
          const current = await seerr.call<SeerrRequest>(
            'request/' + request.params.id,
          )
          if (
            (request.params.action === 'approve' ||
              request.params.action === 'decline') &&
            current.status !== 1
          )
            throw new ApiError(
              409,
              'REQUEST_CHANGED',
              'Cette demande a déjà été traitée. Actualise la page.',
            )
          if (request.params.action === 'retry' && current.status !== 4)
            throw new ApiError(
              409,
              'REQUEST_CHANGED',
              'Seules les demandes en échec peuvent être relancées.',
            )
          await seerr.call(
            `request/${request.params.id}/${request.params.action}`,
            { method: 'POST' },
          )
          return { ok: true }
        },
        { maxWait: 5000, timeout: 30000 },
      )
    },
  )
}
