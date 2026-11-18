import type { FastifyRequest } from 'fastify'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'

export async function authorizeRequest(
  config: ServerConfig,
  request: FastifyRequest,
  admin = false,
) {
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
    const { data } = await getUserApi(api).getCurrentUser({
      timeout: 5000,
      maxRedirects: 0,
    })
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
