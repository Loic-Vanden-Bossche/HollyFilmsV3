import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { PrismaPg } from '@prisma/adapter-pg'
import Fastify, { LogController } from 'fastify'
import type { FastifyRequest } from 'fastify'
import { accountService } from './accounts.ts'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'
import { PrismaClient } from './generated/prisma/client.ts'
import { addGoogleRoutes } from './google.ts'
import type { GoogleProvider } from './google.ts'
import { addShowcaseRoutes } from './showcase.ts'
import { addMediaRoutes } from './media.ts'
import { addProfileRoutes } from './profile.ts'
import { addRequestRoutes } from './requests.ts'
import { addSubtitleRoutes } from './subtitles.ts'
import { addNotificationRoutes, type PushSender } from './notifications.ts'

type Credentials = { username: string; password: string }
type RegistrationParams = { id: string }

const credentialsSchema = (minPasswordLength: number) => ({
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 255 },
    password: { type: 'string', minLength: minPasswordLength, maxLength: 1024 },
  },
})

const idSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
}

export async function createApp(
  config: ServerConfig,
  google?: GoogleProvider,
  pushSender?: PushSender,
) {
  const app = Fastify({
    logger: true,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 16_384,
    trustProxy: config.trustProxy ?? false,
    ajv: { customOptions: { coerceTypes: false } },
  })
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  })
  app.addHook('onClose', () => db.$disconnect())
  await app.register(cookie)
  await app.register(rateLimit, { global: false })
  const accounts = accountService(db, config)

  const acceptedOrigins = new Set([config.publicOrigin])
  const publicUrl = new URL(config.publicOrigin)
  if (
    publicUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname)
  ) {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      const alias = new URL(publicUrl)
      alias.hostname = hostname
      acceptedOrigins.add(alias.origin)
    }
  }

  app.addHook('onRequest', async (request, reply) => {
    reply
      .header('Cache-Control', 'no-store')
      .header('Referrer-Policy', 'no-referrer')
    if (
      ['POST', 'PUT', 'DELETE'].includes(request.method) &&
      request.headers.origin &&
      !acceptedOrigins.has(request.headers.origin)
    ) {
      throw new ApiError(403, 'INVALID_ORIGIN', 'Origine de requête invalide.')
    }
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError)
      return reply
        .code(error.statusCode)
        .send({ code: error.code, message: error.message })
    const failure = error as {
      validation?: unknown
      statusCode?: number
      name?: string
    } | null
    if (failure?.validation) {
      return reply.code(400).send({
        code: 'INVALID_INPUT',
        message: 'Vérifie les informations saisies.',
      })
    }
    if (failure?.statusCode === 429) {
      return reply.code(429).send({
        code: 'RATE_LIMIT',
        message: 'Trop de tentatives. Réessaie dans un instant.',
      })
    }
    if (
      typeof failure?.statusCode === 'number' &&
      failure.statusCode >= 400 &&
      failure.statusCode < 500
    ) {
      return reply
        .code(failure.statusCode)
        .send({ code: 'INVALID_REQUEST', message: 'La requête est invalide.' })
    }
    request.log.error(
      { route: request.routeOptions.url, errorName: failure?.name },
      'Échec de la requête',
    )
    return reply.code(503).send({
      code: 'UNAVAILABLE',
      message:
        'HollyFilms est temporairement indisponible. Réessaie dans un instant.',
    })
  })

  app.get('/api/health', async () => {
    await db.$queryRaw`SELECT 1`
    return { status: 'ok' }
  })

  addShowcaseRoutes(app, config)
  addMediaRoutes(app, db, config)
  addProfileRoutes(app, db, config)
  addRequestRoutes(app, config, db)
  addSubtitleRoutes(app, db, config)
  addNotificationRoutes(app, db, config, pushSender)

  app.get('/api/auth/options', async () => ({
    googleStartUrl: config.google
      ? `${config.publicOrigin}/api/auth/google/start`
      : null,
  }))

  app.post<{ Body: Credentials }>(
    '/api/auth/register',
    {
      schema: { body: credentialsSchema(8) },
      config: { rateLimit: { max: 8, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { username, password } = request.body
      if (
        !/^[\p{L}\p{Mn}\p{Nd}\p{Pc} .@+'-]+$/u.test(username) ||
        username !== username.trim() ||
        username === '.' ||
        username === '..' ||
        /^hf-setup-/i.test(username) ||
        !password.trim()
      ) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'Choisis un nom d’utilisateur et un mot de passe valides.',
        )
      }
      await accounts.register(username, password)
      return reply.code(201).send({ status: 'pending' })
    },
  )

  app.post<{ Body: Credentials }>(
    '/api/auth/password',
    {
      schema: { body: credentialsSchema(0) },
      config: { rateLimit: { max: 25, timeWindow: '1 minute' } },
    },
    async (request) =>
      accounts.signInPassword(request.body.username, request.body.password),
  )

  addGoogleRoutes(app, db, config, accounts, google)

  function requireAdmin(request: FastifyRequest) {
    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    )?.[1]
    if (!token)
      throw new ApiError(
        401,
        'AUTH_REQUIRED',
        'Connecte-toi avec un compte administrateur Jellyfin.',
      )
    const device = request.headers['x-hollyfilms-device']
    const deviceId =
      typeof device === 'string' && /^[a-z\d-]{1,128}$/i.test(device)
        ? device
        : undefined
    return accounts.admin(token, deviceId)
  }

  app.get('/api/admin/registrations', async (request) => {
    await requireAdmin(request)
    return accounts.list()
  })

  app.post<{ Params: RegistrationParams }>(
    '/api/admin/registrations/:id/approve',
    { schema: { params: idSchema } },
    async (request, reply) => {
      await accounts.approve(request.params.id, await requireAdmin(request))
      return reply.code(204).send()
    },
  )

  app.post<{ Params: RegistrationParams }>(
    '/api/admin/registrations/:id/reject',
    { schema: { params: idSchema } },
    async (request, reply) => {
      await accounts.reject(request.params.id, await requireAdmin(request))
      return reply.code(204).send()
    },
  )

  return app
}
