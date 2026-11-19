import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js'
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api.js'
import {
  authenticateJellyfin,
  createJellyfinApi,
  endJellyfinSession,
} from '@hollyfilms/shared/jellyfin'
import {
  googlePictureUrl,
  type AccountProfile,
} from '@hollyfilms/shared/profile'
import type { PrismaClient } from './generated/prisma/client.ts'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'

export function addProfileRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  config: ServerConfig,
) {
  // Every operation acts on the authenticated user, never a client-supplied ID.
  async function authorize(request: FastifyRequest, editing = false) {
    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    )?.[1]
    if (!token)
      throw new ApiError(
        401,
        'AUTH_REQUIRED',
        'Reconnecte-toi pour accéder à ton profil.',
      )
    const device = request.headers['x-hollyfilms-device']
    const api = createJellyfinApi(
      config.jellyfinUrl,
      typeof device === 'string' && /^[a-z\d-]{1,128}$/i.test(device)
        ? device
        : undefined,
      token,
    )
    try {
      const { data: user } = await getUserApi(api).getCurrentUser({
        timeout: 5000,
      })
      if (!user.Id || user.Policy?.IsDisabled)
        throw new ApiError(403, 'ACCESS_DENIED', 'Ce compte est désactivé.')
      const canEdit =
        user.Policy?.IsAdministrator === true ||
        user.Policy?.EnableUserPreferenceAccess === true
      if (editing && !canEdit)
        throw new ApiError(
          403,
          'PREFERENCES_DISABLED',
          'La modification du profil est désactivée par l’administrateur.',
        )
      const registration = await db.registration.findUnique({
        where: { jellyfinId: user.Id.replaceAll('-', '').toLowerCase() },
        select: {
          method: true,
          googleEmail: true,
          googleName: true,
          googlePicture: true,
        },
      })
      const google = registration?.method === 'GOOGLE' ? registration : null
      const username = user.Name || 'Membre'
      const profile: AccountProfile = {
        id: user.Id,
        name: google?.googleName ?? google?.googleEmail ?? username,
        isAdministrator: user.Policy?.IsAdministrator === true,
        canEdit,
        hasPassword: user.HasPassword === true,
        imageTag: user.PrimaryImageTag ?? null,
        google: google
          ? {
              email: google.googleEmail,
              picture: googlePictureUrl(google.googlePicture),
            }
          : null,
      }
      return { api, profile, username }
    } catch (error) {
      throw failure(error)
    }
  }
  function failure(error: unknown) {
    if (error instanceof ApiError) return error
    const status = (error as { response?: { status?: number } })?.response
      ?.status
    if (status === 401 || status === 403)
      return new ApiError(
        status,
        'ACCESS_DENIED',
        'Session expirée ou opération non autorisée. Vérifie tes identifiants.',
      )
    if (status === 400)
      return new ApiError(
        400,
        'INVALID_PROFILE',
        'La modification a été refusée. Vérifie les informations saisies.',
      )
    return new ApiError(
      503,
      'PROFILE_UNAVAILABLE',
      'Impossible de joindre le serveur. Réessaie dans un instant.',
    )
  }
  const limited = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }
  app.get('/api/profile', async (request) => (await authorize(request)).profile)
  app.get('/api/profile/image', async (request, reply) => {
    const { api, profile } = await authorize(request)
    if (!profile.imageTag) return reply.code(404).send()
    try {
      const result = await getImageApi(api).getUserImage(
        { userId: profile.id, tag: profile.imageTag },
        { responseType: 'arraybuffer', timeout: 10000 },
      )
      return reply
        .header('X-Content-Type-Options', 'nosniff')
        .type(String(result.headers['content-type'] || 'image/jpeg'))
        .send(Buffer.from(result.data as unknown as ArrayBuffer))
    } catch (error) {
      throw failure(error)
    }
  })
  app.put<{ Body: { data: string; type: string } }>(
    '/api/profile/image',
    {
      ...limited,
      bodyLimit: 2_800_000,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['data', 'type'],
          properties: {
            data: {
              type: 'string',
              minLength: 16,
              maxLength: 2_796_204,
              pattern: '^[A-Za-z0-9+/]+={0,2}$',
            },
            type: {
              type: 'string',
              enum: ['image/jpeg', 'image/png', 'image/webp'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { api, profile } = await authorize(request, true)
      const bytes = Buffer.from(request.body.data, 'base64')
      const signature =
        request.body.type === 'image/jpeg'
          ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
          : request.body.type === 'image/png'
            ? bytes
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : bytes.toString('ascii', 0, 4) === 'RIFF' &&
              bytes.toString('ascii', 8, 12) === 'WEBP'
      if (!signature || bytes.length > 2_097_152)
        throw new ApiError(
          400,
          'INVALID_IMAGE',
          'Choisis une image JPG, PNG ou WebP de moins de 2 Mo.',
        )
      try {
        // Jellyfin 12.4 expects base64, despite the SDK's generated File type.
        await getImageApi(api).postUserImage(
          { userId: profile.id },
          {
            headers: { 'Content-Type': request.body.type },
            transformRequest: () => request.body.data,
            timeout: 15000,
          },
        )
        return reply.code(204).send()
      } catch (error) {
        throw failure(error)
      }
    },
  )
  app.delete('/api/profile/image', limited, async (request, reply) => {
    const { api, profile } = await authorize(request, true)
    try {
      await getImageApi(api).deleteUserImage(
        { userId: profile.id },
        { timeout: 10000 },
      )
      return reply.code(204).send()
    } catch (error) {
      throw failure(error)
    }
  })
  app.put<{ Body: { currentPassword: string; newPassword: string } }>(
    '/api/profile/password',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', maxLength: 1024 },
            newPassword: { type: 'string', maxLength: 1024 },
          },
        },
      },
    },
    async (request, reply) => {
      const { api, profile, username } = await authorize(request, true)
      if (profile.google)
        throw new ApiError(
          409,
          'GOOGLE_PASSWORD',
          'Le mot de passe de ce compte est géré par Google.',
        )
      if (profile.isAdministrator && !request.body.newPassword)
        throw new ApiError(
          400,
          'PASSWORD_REQUIRED',
          'Un compte administrateur doit conserver un mot de passe.',
        )
      try {
        if (!request.body.newPassword) {
          // ResetPassword skips Jellyfin's current-password check. Verify it first
          // with a separate short-lived session, then revoke that session.
          const verification = await authenticateJellyfin(
            config.jellyfinUrl,
            username,
            request.body.currentPassword,
            profile.id,
          )
          await endJellyfinSession(config.jellyfinUrl, verification)
        }
        await getUserApi(api).updateUserPassword(
          {
            userId: profile.id,
            updateUserPassword: {
              CurrentPw: request.body.currentPassword,
              NewPw: request.body.newPassword,
              ResetPassword: !request.body.newPassword,
            },
          },
          { timeout: 10000 },
        )
        return reply.code(204).send()
      } catch (error) {
        throw failure(error)
      }
    },
  )
}
