import type { FastifyInstance } from 'fastify'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js'
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api.js'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import {
  showcasePosterWidths,
  type ShowcaseItem,
} from '@hollyfilms/shared/showcase'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'

export function addShowcaseRoutes(app: FastifyInstance, config: ServerConfig) {
  const api = createJellyfinApi(
    config.jellyfinUrl,
    'hollyfilms-showcase',
    config.jellyfinApiKey,
  )
  let cache: ShowcaseItem[] = []
  let expires = 0
  let pending: Promise<ShowcaseItem[]> | undefined

  async function selection() {
    if (Date.now() < expires) return cache
    pending ??= getLibraryApi(api)
      .getItems(
        {
          recursive: true,
          includeItemTypes: ['Movie', 'Series'],
          limit: 18,
          sortBy: ['DateCreated'],
          sortOrder: ['Descending'],
          enableUserData: false,
          enableTotalRecordCount: false,
        },
        { timeout: 5000, maxRedirects: 0 },
      )
      .then(({ data }) => {
        cache = (data.Items ?? [])
          .filter((item) => item.Id && item.Name)
          .map((item) => ({
            id: item.Id!,
            title: item.Name!,
            year: item.ProductionYear ?? null,
            kind: item.Type === 'Series' ? 'Série' : 'Film',
            poster: item.ImageTags?.Primary
              ? '/api/showcase/' + item.Id + '/poster'
              : null,
          }))
        expires = Date.now() + 60_000
        return cache
      })
      .finally(() => {
        pending = undefined
      })
    return pending
  }

  app.get(
    '/api/showcase',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async () => ({ items: await selection() }),
  )

  app.get<{ Params: { id: string }; Querystring: { width?: string } }>(
    '/api/showcase/:id/poster',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            width: { type: 'string', enum: showcasePosterWidths.map(String) },
          },
        },
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', pattern: '^[a-fA-F0-9-]{32,36}$' },
          },
        },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const item = (await selection()).find(
        (item) => item.id === request.params.id && item.poster,
      )
      if (!item)
        throw new ApiError(404, 'POSTER_NOT_FOUND', 'Affiche indisponible.')
      const { data } = await getImageApi(api).getItemImage(
        {
          itemId: item.id,
          imageType: 'Primary',
          maxWidth: Number(request.query.width ?? 400),
          quality: 80,
          format: 'Jpg',
        },
        {
          timeout: 5000,
          maxRedirects: 0,
          responseType: 'arraybuffer',
          maxContentLength: 3_000_000,
        },
      )
      return reply
        .type('image/jpeg')
        .header('Cache-Control', 'public, max-age=300')
        .send(Buffer.from(data as unknown as ArrayBuffer))
    },
  )
}
