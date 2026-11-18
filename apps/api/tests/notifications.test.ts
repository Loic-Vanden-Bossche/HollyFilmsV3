import assert from 'node:assert/strict'
import { createECDH, randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { PrismaPg } from '@prisma/adapter-pg'
import { generateRequestDetails, generateVAPIDKeys } from 'web-push'
import { createApp } from '../src/app.ts'
import { readConfig } from '../src/config.ts'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { recordNotification, type PushSender } from '../src/notifications.ts'

const publicOrigin = 'http://localhost:5173'
const member = '99999999999999999999999999999991'
const other = '99999999999999999999999999999992'
const vapid = { ...generateVAPIDKeys(), subject: 'mailto:admin@example.test' }
const base = { DATABASE_URL: 'postgres://unused', JELLYFIN_API_KEY: 'test' }
test('Web Push can be disabled and requires a matching VAPID pair when enabled', () => {
  assert.equal(readConfig(base).vapid, undefined)
  assert.throws(() =>
    readConfig({ ...base, VAPID_PUBLIC_KEY: vapid.publicKey }),
  )
  const env = {
    ...base,
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
    VAPID_SUBJECT: vapid.subject,
  }
  assert.deepEqual(readConfig(env).vapid, vapid)
  assert.throws(() =>
    readConfig({ ...env, VAPID_PUBLIC_KEY: generateVAPIDKeys().publicKey }),
  )
  assert.throws(() =>
    readConfig({ ...env, VAPID_SUBJECT: 'http://example.test' }),
  )
})

test('notifications stay private across devices, users, retries and API restarts', async (t) => {
  const databaseUrl = process.env.HOLLYFILMS_TEST_DATABASE_URL
  assert.ok(databaseUrl)
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })
  t.after(() => db.$disconnect())
  const jf = createServer((request, reply) => {
    const token = /Token="([^"]+)"/.exec(
      request.headers.authorization ?? '',
    )?.[1]
    if (!['member', 'other', 'disabled'].includes(token ?? '')) {
      reply.writeHead(401).end()
      return
    }
    reply.setHeader('Content-Type', 'application/json')
    reply.end(
      JSON.stringify({
        Id: token === 'other' ? other : member,
        Policy: { IsDisabled: token === 'disabled' },
      }),
    )
  })
  jf.listen(0, '127.0.0.1')
  await once(jf, 'listening')
  t.after(() => {
    jf.close()
    jf.closeAllConnections()
  })
  const address = jf.address()
  assert.ok(address && typeof address !== 'string')
  const config = {
    databaseUrl,
    jellyfinUrl: 'http://127.0.0.1:' + address.port,
    jellyfinApiKey: 'test',
    publicOrigin,
  }
  const calls: Parameters<PushSender>[1][] = []
  let upstream = 201
  const transport: PushSender = async (device, payload, vapidDetails) => {
    const req = generateRequestDetails(
      {
        endpoint: device.endpoint,
        keys: { auth: device.auth, p256dh: device.p256dh },
      },
      JSON.stringify(payload),
      { vapidDetails },
    )
    assert.equal(req.method, 'POST')
    assert.ok(req.body && !req.body.toString().includes(payload.title))
    assert.match(String(req.headers.Authorization), /^vapid /)
    calls.push(payload)
    if (upstream !== 201)
      throw Object.assign(new Error('relay failure'), { statusCode: upstream })
  }
  let app = await createApp(config)
  t.after(() => app.close())
  const endpoint = 'https://fcm.googleapis.com/fcm/send/test-device'
  const headers = (token = 'member') => ({
    authorization: 'Bearer ' + token,
    origin: publicOrigin,
  })
  const key = createECDH('prime256v1')
  const keys = {
    p256dh: key.generateKeys().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  }
  const inject = (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path = '',
    token = 'member',
    payload?: object,
  ) =>
    app.inject({
      method,
      url: '/api/notifications' + path,
      headers: headers(token),
      payload,
    })
  assert.equal((await inject('GET', '/push')).json().publicKey, null)
  assert.equal(
    (await inject('PUT', '/push', 'member', { endpoint, keys })).statusCode,
    503,
  )
  assert.equal((await inject('GET', '', 'unknown')).statusCode, 401)
  assert.equal((await inject('GET', '', 'disabled')).statusCode, 403)
  assert.deepEqual((await inject('GET')).json(), {
    items: [],
    unread: 0,
    nextCursor: null,
  })
  await app.close()
  app = await createApp({ ...config, vapid }, undefined, transport)
  assert.deepEqual((await inject('GET', '/push')).json(), {
    publicKey: vapid.publicKey,
  })
  assert.equal(
    (
      await inject('PUT', '/push', 'member', {
        endpoint: 'https://localhost/private',
        keys,
      })
    ).statusCode,
    400,
  )
  assert.equal(
    (
      await inject('PUT', '/push', 'member', {
        endpoint,
        keys: { ...keys, p256dh: 'A'.repeat(87) },
      })
    ).statusCode,
    400,
  )
  assert.equal(
    (
      await inject('PUT', '/push', 'member', {
        endpoint,
        keys,
        expirationTime: 1,
      })
    ).statusCode,
    400,
  )
  const save = () =>
    inject('PUT', '/push', 'member', { endpoint, keys, expirationTime: null })
  assert.deepEqual(
    (await Promise.all([save(), save()])).map((r) => r.statusCode),
    [204, 204],
  )
  assert.equal(
    (await inject('PUT', '/push', 'other', { endpoint, keys })).json().code,
    'PUSH_ALREADY_LINKED',
  )
  assert.equal(
    (await inject('POST', '/push/status', 'other', { endpoint })).json()
      .subscribed,
    false,
  )
  assert.equal(
    (await inject('DELETE', '/push', 'other', { endpoint })).statusCode,
    204,
  )
  assert.equal(
    (await inject('POST', '/push/status', 'member', { endpoint })).json()
      .subscribed,
    true,
  )
  assert.equal(
    (await inject('POST', '/push/test', 'other', { endpoint })).statusCode,
    404,
  )
  assert.equal(
    (await inject('POST', '/push/test', 'member', { endpoint })).statusCode,
    204,
  )
  assert.equal(calls[0].userId, member)
  const create = (userId: string) =>
    db.$transaction((tx) =>
      recordNotification(tx, {
        userId,
        title: 'Demande de média approuvée',
        body: 'Film du soir',
        url: '/requests',
      }),
    )
  await create(member)
  await create(other)
  const inbox = (await inject('GET')).json()
  assert.equal(inbox.unread, 1)
  const id = inbox.items[0].id
  assert.equal((await inject('POST', '/read', 'other', { id })).statusCode, 204)
  assert.equal((await inject('GET')).json().unread, 1)
  // A committed event survives restarting the API. A transient failure retains its delivery.
  await app.close()
  upstream = 503
  app = await createApp({ ...config, vapid }, undefined, transport)
  await app.ready()
  async function until(check: () => Promise<boolean>) {
    for (let i = 0; i < 120; i++) {
      if (await check()) return
      await delay(50)
    }
    assert.fail('Worker did not reach the expected delivery state')
  }
  await until(
    async () =>
      (await db.pushDelivery.findFirst({ where: { notificationId: id } }))
        ?.attempts === 1 && calls.length === 2,
  )
  await app.close()
  const pending = await db.pushDelivery.findFirstOrThrow({
    where: { notificationId: id },
  })
  assert.ok(pending.nextAttemptAt > new Date())
  await db.pushDelivery.updateMany({
    where: { notificationId: id },
    data: { nextAttemptAt: new Date(0) },
  })
  upstream = 201
  app = await createApp({ ...config, vapid }, undefined, transport)
  await app.ready()
  await until(
    async () =>
      (await db.pushDelivery.count({ where: { notificationId: id } })) === 0,
  )
  assert.equal(calls.at(-1)?.url, '/requests')
  assert.equal(calls.at(-1)?.userId, member)
  assert.ok(!JSON.stringify(calls).includes('Film du soir'))
  assert.equal(
    (await inject('POST', '/read', 'member', { id })).statusCode,
    204,
  )
  assert.equal((await inject('GET')).json().unread, 0)
  assert.equal((await inject('GET', '', 'other')).json().unread, 1)
  assert.equal((await inject('POST', '/read', 'other', {})).statusCode, 204)
  assert.equal((await inject('GET', '', 'other')).json().unread, 0)
  upstream = 410
  assert.equal(
    (await inject('POST', '/push/test', 'member', { endpoint })).json().code,
    'PUSH_EXPIRED',
  )
  assert.equal(
    (await inject('POST', '/push/status', 'member', { endpoint })).json()
      .subscribed,
    false,
  )
  assert.equal((await save()).statusCode, 204)
  await create(member)
  assert.equal(
    (await inject('DELETE', '/push', 'member', { endpoint })).statusCode,
    204,
  )
  assert.equal(
    await db.pushDelivery.count({
      where: { notification: { userId: member } },
    }),
    0,
  )
  assert.equal((await inject('GET')).json().unread, 1)
  await db.notification.createMany({
    data: Array.from({ length: 54 }, () => ({
      userId: member,
      title: 'Archives',
      body: 'Film',
      url: '/requests',
      createdAt: new Date(0),
    })),
  })
  const first = (await inject('GET')).json()
  assert.equal(first.items.length, 50)
  const second = (await inject('GET', '?before=' + first.nextCursor)).json()
  assert.equal(second.items.length, 6)
  assert.equal(second.unread, first.unread)
  assert.equal(second.nextCursor, null)
  assert.equal(
    new Set([...first.items, ...second.items].map((n) => n.id)).size,
    56,
  )
  const foreign = (await inject('GET', '', 'other')).json().items[0].id
  assert.deepEqual((await inject('GET', '?before=' + foreign)).json().items, [])
})
