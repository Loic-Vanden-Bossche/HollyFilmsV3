import { ECDH } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { sendNotification } from 'web-push'
import { authorizeRequest } from './authorize-request.ts'
import { backgroundTask } from './background-task.ts'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'
import type {
  Prisma,
  PrismaClient,
  PushSubscription,
} from './generated/prisma/client.ts'

const fallbackBody = 'Ouvre tes demandes pour consulter la mise à jour.'
const normalize = (id: string) => id.replaceAll('-', '').toLowerCase()
const visible = {
  id: true,
  title: true,
  body: true,
  url: true,
  createdAt: true,
  readAt: true,
} as const

type Notice = {
  userId: string
  title: string
  body?: string
  url: '/requests' | '/requests?section=subtitles'
}

// Commit the inbox event and its intended devices together with the business change.
export async function recordNotification(
  tx: Prisma.TransactionClient,
  notice: Notice,
) {
  const userId = normalize(notice.userId)
  const notification = await tx.notification.create({
    data: {
      userId,
      title: notice.title,
      body: notice.body || fallbackBody,
      url: notice.url,
    },
    select: { id: true },
  })
  // Lock eligible devices in this statement so a simultaneous unsubscribe
  // cannot invalidate a foreign key and roll back the viewer's inbox event.
  await tx.$executeRaw`
    INSERT INTO "PushDelivery" ("notificationId", "subscriptionId")
    SELECT ${notification.id}::uuid, "id" FROM "PushSubscription"
    WHERE "userId" = ${userId} AND ("expiresAt" IS NULL OR "expiresAt" > now())
    ORDER BY "id" FOR KEY SHARE
  `
}

const endpointSchema = { type: 'string', minLength: 1, maxLength: 2048 }
const deviceBody = {
  type: 'object',
  required: ['endpoint'],
  properties: { endpoint: endpointSchema },
}
type Device = { endpoint: string }
type BrowserSubscription = Device & {
  keys: { auth: string; p256dh: string }
  expirationTime?: number | null
}

function validEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    // Only browser-operated relays may receive a POST from the API.
    return (
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.pathname.length > 1 &&
      (url.hostname === 'fcm.googleapis.com' ||
        url.hostname.endsWith('.push.services.mozilla.com') ||
        url.hostname.endsWith('.push.apple.com') ||
        url.hostname.endsWith('.notify.windows.com'))
    )
  } catch {
    return false
  }
}

function validKeys({ p256dh, auth }: BrowserSubscription['keys']) {
  try {
    const point = ECDH.convertKey(
      Buffer.from(p256dh, 'base64url'),
      'prime256v1',
      undefined,
      undefined,
      'uncompressed',
    )
    return (
      Buffer.from(point).toString('base64url') === p256dh &&
      Buffer.from(auth, 'base64url').toString('base64url') === auth
    )
  } catch {
    return false
  }
}

type Payload = {
  id: string
  title: string
  body: string
  url: string
  tag: string
  userId: string
}
export type PushSender = (
  device: PushSubscription,
  payload: Payload,
  vapid: NonNullable<ServerConfig['vapid']>,
) => Promise<unknown>
const send: PushSender = (device, payload, vapidDetails) =>
  sendNotification(
    {
      endpoint: device.endpoint,
      keys: { auth: device.auth, p256dh: device.p256dh },
    },
    JSON.stringify(payload),
    { vapidDetails, TTL: 3600, timeout: 6000, urgency: 'normal' },
  )

function expired(error: unknown) {
  const status = (error as { statusCode?: number } | null)?.statusCode
  return status === 404 || status === 410
}

async function pruneDevice(db: PrismaClient, device: PushSubscription) {
  // A renewal may have rotated the subscription keys during the network request.
  await db.pushSubscription.deleteMany({
    where: {
      id: device.id,
      userId: device.userId,
      p256dh: device.p256dh,
      auth: device.auth,
    },
  })
}

function startDelivery(
  app: FastifyInstance,
  db: PrismaClient,
  vapid: NonNullable<ServerConfig['vapid']>,
  sender: PushSender,
) {
  async function flush() {
    const due = await db.pushDelivery.findMany({
      where: { nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: 'asc' },
      take: 12,
      include: { notification: true, subscription: true },
    })
    await Promise.all(
      due.map(
        async ({ notification, subscription, attempts, nextAttemptAt }) => {
          const identity = {
            notificationId: notification.id,
            subscriptionId: subscription.id,
          }
          // Multiple replicas can poll concurrently. A crashed sender releases its lease in a minute.
          const claimed = await db.pushDelivery.updateMany({
            where: { ...identity, attempts, nextAttemptAt },
            data: {
              attempts: { increment: 1 },
              nextAttemptAt: new Date(Date.now() + 60000),
            },
          })
          if (!claimed.count) return
          const lease = { ...identity, attempts: attempts + 1 }
          if (subscription.expiresAt && subscription.expiresAt <= new Date()) {
            await pruneDevice(db, subscription)
          } else if (
            !notification.readAt &&
            notification.createdAt.getTime() > Date.now() - 86400000
          ) {
            try {
              await sender(
                subscription,
                {
                  id: notification.id,
                  title: notification.title,
                  body: fallbackBody,
                  url: notification.url,
                  tag: notification.id,
                  userId: subscription.userId,
                },
                vapid,
              )
            } catch (error) {
              if (expired(error)) await pruneDevice(db, subscription)
              else if (attempts < 7) {
                await db.pushDelivery.updateMany({
                  where: lease,
                  data: {
                    nextAttemptAt: new Date(Date.now() + 30000 * 2 ** attempts),
                  },
                })
                return
              }
            }
          }
          await db.pushDelivery.deleteMany({ where: lease })
        },
      ),
    )
  }
  backgroundTask(
    app,
    5000,
    flush,
    'Distribution des notifications temporairement indisponible',
  )
}

export function addNotificationRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  config: ServerConfig,
  sender: PushSender = send,
) {
  if (config.vapid) startDelivery(app, db, config.vapid, sender)
  const readLimit = { rateLimit: { max: 180, timeWindow: '1 minute' } }
  const writeLimit = { rateLimit: { max: 30, timeWindow: '1 minute' } }
  const requirePush = () => {
    if (!config.vapid)
      throw new ApiError(
        503,
        'PUSH_UNAVAILABLE',
        'Les notifications système sont indisponibles.',
      )
    return config.vapid
  }
  app.get<{ Querystring: { before?: string } }>(
    '/api/notifications',
    {
      config: readLimit,
      schema: {
        querystring: {
          type: 'object',
          properties: { before: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request) => {
      const userId = normalize((await authorizeRequest(config, request)).id)
      const before = request.query.before
      const [page, unread] = await db.$transaction(
        [
          db.notification.findMany({
            where: { userId },
            select: visible,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            cursor: before ? { id: before, userId } : undefined,
            skip: before ? 1 : 0,
            take: 51,
          }),
          db.notification.count({ where: { userId, readAt: null } }),
        ],
        { isolationLevel: 'RepeatableRead' },
      )
      const items = page.slice(0, 50)
      return {
        items,
        unread,
        nextCursor:
          page.length > items.length ? items[items.length - 1].id : null,
      }
    },
  )
  app.post<{ Body: { id?: string } }>(
    '/api/notifications/read',
    {
      config: writeLimit,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const userId = normalize((await authorizeRequest(config, request)).id)
      await db.notification.updateMany({
        where: { userId, id: request.body.id, readAt: null },
        data: { readAt: new Date() },
      })
      return reply.code(204).send()
    },
  )
  app.get('/api/notifications/push', { config: readLimit }, async (request) => {
    await authorizeRequest(config, request)
    return { publicKey: config.vapid?.publicKey ?? null }
  })
  app.post<{ Body: Device }>(
    '/api/notifications/push/status',
    { config: readLimit, schema: { body: deviceBody } },
    async (request) => {
      const userId = normalize((await authorizeRequest(config, request)).id)
      const device = await db.pushSubscription.findFirst({
        where: { userId, endpoint: request.body.endpoint },
        select: { expiresAt: true },
      })
      return {
        subscribed:
          !!device && (!device.expiresAt || device.expiresAt > new Date()),
      }
    },
  )
  app.put<{ Body: BrowserSubscription }>(
    '/api/notifications/push',
    {
      config: writeLimit,
      schema: {
        body: {
          type: 'object',
          required: ['endpoint', 'keys'],
          properties: {
            endpoint: endpointSchema,
            expirationTime: {
              anyOf: [
                { type: 'null' },
                { type: 'integer', minimum: 0, maximum: 8640000000000000 },
              ],
            },
            keys: {
              type: 'object',
              additionalProperties: false,
              required: ['p256dh', 'auth'],
              properties: {
                p256dh: { type: 'string', pattern: '^[A-Za-z0-9_-]{87}$' },
                auth: { type: 'string', pattern: '^[A-Za-z0-9_-]{22}$' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = normalize((await authorizeRequest(config, request)).id)
      requirePush()
      const { endpoint, keys, expirationTime } = request.body
      if (
        !validEndpoint(endpoint) ||
        !validKeys(keys) ||
        (expirationTime != null && expirationTime <= Date.now())
      ) {
        throw new ApiError(
          400,
          'INVALID_SUBSCRIPTION',
          'Cet abonnement aux notifications est invalide ou expiré.',
        )
      }
      const data = {
        p256dh: keys.p256dh,
        auth: keys.auth,
        expiresAt: expirationTime == null ? null : new Date(expirationTime),
      }
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'push:' + userId}, 0))`
        await tx.pushSubscription.deleteMany({
          where: { userId, expiresAt: { lte: new Date() } },
        })
        const count = await tx.pushSubscription.count({
          where: { userId, endpoint: { not: endpoint } },
        })
        if (count >= 16)
          throw new ApiError(
            409,
            'DEVICE_LIMIT',
            'La limite de 16 appareils est atteinte.',
          )
        // Never transfer an endpoint between accounts, including concurrent subscriptions.
        await tx.pushSubscription.createMany({
          data: [{ userId, endpoint, ...data }],
          skipDuplicates: true,
        })
        const updated = await tx.pushSubscription.updateMany({
          where: { userId, endpoint },
          data,
        })
        if (!updated.count)
          throw new ApiError(
            409,
            'PUSH_ALREADY_LINKED',
            'Cet abonnement est déjà lié à un autre compte.',
          )
      })
      return reply.code(204).send()
    },
  )
  app.delete<{ Body: Device }>(
    '/api/notifications/push',
    { config: writeLimit, schema: { body: deviceBody } },
    async (request, reply) => {
      const userId = normalize((await authorizeRequest(config, request)).id)
      await db.pushSubscription.deleteMany({
        where: { userId, endpoint: request.body.endpoint },
      })
      return reply.code(204).send()
    },
  )
  app.post<{ Body: Device }>(
    '/api/notifications/push/test',
    {
      config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
      schema: { body: deviceBody },
    },
    async (request, reply) => {
      const userId = normalize((await authorizeRequest(config, request)).id)
      const vapid = requirePush()
      const device = await db.pushSubscription.findFirst({
        where: { userId, endpoint: request.body.endpoint },
      })
      if (!device)
        throw new ApiError(
          404,
          'PUSH_NOT_FOUND',
          'Les notifications ne sont pas activées sur cet appareil.',
        )
      const gone = () =>
        new ApiError(
          410,
          'PUSH_EXPIRED',
          'Cet abonnement a expiré. Réactive les notifications.',
        )
      if (device.expiresAt && device.expiresAt <= new Date()) {
        await pruneDevice(db, device)
        throw gone()
      }
      try {
        await sender(
          device,
          {
            id: 'test',
            title: 'Notifications activées',
            body: 'Cet appareil peut recevoir les notifications HollyFilms.',
            url: '/profile',
            tag: 'hollyfilms-test',
            userId,
          },
          vapid,
        )
      } catch (error) {
        if (expired(error)) {
          await pruneDevice(db, device)
          throw gone()
        }
        throw new ApiError(
          503,
          'PUSH_DELIVERY_FAILED',
          'Le service de notifications est momentanément indisponible.',
        )
      }
      return reply.code(204).send()
    },
  )
}
