import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer, request as forward } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api.js'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { calculatePKCECodeChallenge } from 'openid-client'
import { createApp } from '../src/app.ts'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import type { GoogleProvider } from '../src/google.ts'
import {
  authenticateJellyfin,
  createJellyfinApi,
  getJellyfinUser,
} from '@hollyfilms/shared/jellyfin'
import type {
  AuthResult,
  RegistrationSummary,
} from '@hollyfilms/shared/accounts'

const databaseUrl = process.env.HOLLYFILMS_TEST_DATABASE_URL
const jellyfinUrl = process.env.HOLLYFILMS_TEST_JELLYFIN_URL
const origin = 'http://localhost:5173'

test(
  'Inscriptions et approbations avec PostgreSQL et Jellyfin 12',
  { timeout: 60_000 },
  async (context) => {
    assert.ok(
      databaseUrl && jellyfinUrl,
      'Configure les URL de test PostgreSQL et Jellyfin isolées.',
    )
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    })
    context.after(() => db.$disconnect())
    assert.equal(
      await db.registration.count(),
      0,
      'Utilise une base de test vide avec les migrations appliquées.',
    )
    const system = await fetch(`${jellyfinUrl}/System/Info/Public`).then(
      (response) => response.json(),
    )
    assert.match(system.Version, /^12\./)
    assert.equal(
      system.StartupWizardCompleted,
      false,
      'Utilise une instance Jellyfin de test neuve.',
    )

    const adminPassword = randomBytes(24).toString('hex')
    await fetch(`${jellyfinUrl}/Startup/User`)
    const configure = await fetch(`${jellyfinUrl}/Startup/User`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Name: 'HollyFilmsTestAdmin',
        Password: adminPassword,
      }),
    })
    assert.equal(configure.status, 204)
    assert.equal(
      (await fetch(`${jellyfinUrl}/Startup/Complete`, { method: 'POST' }))
        .status,
      204,
    )

    const admin = await authenticateJellyfin(
      jellyfinUrl,
      'HollyFilmsTestAdmin',
      adminPassword,
    )
    const adminHeaders = {
      authorization: `Bearer ${admin.accessToken}`,
      'x-hollyfilms-device': admin.deviceId,
    }
    const adminApi = createJellyfinApi(
      jellyfinUrl,
      admin.deviceId,
      admin.accessToken,
    )
    const credentialsApi = getAuthenticationApi(adminApi)
    await credentialsApi.createKey({ app: 'HollyFilms integration test' })
    const key = (await credentialsApi.getKeys()).data.Items?.find(
      (entry) => entry.AppName === 'HollyFilms integration test',
    )?.AccessToken
    assert.ok(key)
    const users = getUserApi(adminApi)

    let failPolicy = false
    let policyReached = () => {}
    let releasePolicy = () => {}
    const policyInFlight = new Promise<void>((resolve) => {
      policyReached = resolve
    })
    const policyReleased = new Promise<void>((resolve) => {
      releasePolicy = resolve
    })
    const proxy = createServer(async (request, reply) => {
      const url = new URL(request.url ?? '/', jellyfinUrl)
      if (
        failPolicy &&
        request.method === 'POST' &&
        url.pathname.endsWith('/Policy')
      ) {
        failPolicy = false
        request.resume()
        policyReached()
        await policyReleased
        reply.writeHead(503).end()
        return
      }
      const upstream = forward(
        url,
        { method: request.method, headers: request.headers },
        (response) => {
          reply.writeHead(response.statusCode ?? 502, response.headers)
          response.pipe(reply)
        },
      )
      upstream.on('error', () => reply.writeHead(502).end())
      request.pipe(upstream)
    })
    proxy.listen(0, '127.0.0.1')
    await once(proxy, 'listening')
    context.after(() => {
      releasePolicy()
      proxy.close()
      proxy.closeAllConnections()
    })
    const address = proxy.address()
    assert.ok(address && typeof address !== 'string')

    const provider: GoogleProvider = {
      async authorizationUrl(params) {
        return new URL(
          `https://accounts.google.com/mock?${new URLSearchParams(params)}`,
        )
      },
      async identity(url, checks) {
        assert.equal(url.searchParams.get('code'), 'fixture-code')
        assert.equal(url.searchParams.get('state'), checks.expectedState)
        assert.equal(url.searchParams.get('nonce'), checks.expectedNonce)
        assert.ok(checks.pkceCodeVerifier)
        assert.equal(
          await calculatePKCECodeChallenge(checks.pkceCodeVerifier),
          url.searchParams.get('challenge'),
        )
        return {
          issuer: 'https://accounts.google.com',
          subject: 'fixture-subject',
          email: 'test@example.org',
        }
      },
    }
    const app = await createApp(
      {
        databaseUrl,
        jellyfinUrl: `http://127.0.0.1:${address.port}`,
        jellyfinApiKey: key,
        publicOrigin: origin,
        google: {
          clientId: 'fixture-client',
          clientSecret: 'fixture-secret',
          passwordKey: randomBytes(32),
        },
      },
      provider,
    )
    context.after(() => app.close())

    const post = (url: string, payload: object) =>
      app.inject({ method: 'POST', url, payload })
    const list = async () => {
      const response = await app.inject({
        url: '/api/admin/registrations',
        headers: adminHeaders,
      })
      assert.equal(response.statusCode, 200, response.body)
      return response.json<RegistrationSummary[]>()
    }
    const decide = (id: string, action: string) =>
      app.inject({
        method: 'POST',
        url: `/api/admin/registrations/${id}/${action}`,
        headers: adminHeaders,
      })
    const password = randomBytes(16).toString('hex')
    const body = { username: 'Demande Test', password }

    const existing = await post('/api/auth/password', {
      username: 'HollyFilmsTestAdmin',
      password: adminPassword,
    })
    assert.equal(existing.json<AuthResult>().status, 'authenticated')
    assert.equal((await app.inject('/api/admin/registrations')).statusCode, 401)
    const registrations = await Promise.all([
      post('/api/auth/register', body),
      post('/api/auth/register', {
        ...body,
        username: body.username.toUpperCase(),
      }),
    ])
    assert.deepEqual(
      registrations.map((response) => response.statusCode).sort(),
      [201, 409],
    )
    const registration = (await list())[0]!
    const stored = await db.registration.findUniqueOrThrow({
      where: { id: registration.id },
    })
    assert.match(stored.passwordHash ?? '', /^\$argon2id\$/)
    assert.equal(stored.jellyfinId, null)
    assert.ok(
      !(await users.getUsers({})).data.some(
        (user) => user.Name?.toUpperCase() === body.username.toUpperCase(),
      ),
    )
    assert.equal(
      (await post('/api/auth/password', body)).json<AuthResult>().status,
      'pending',
    )
    assert.equal(
      (await post('/api/auth/password', { ...body, password: 'incorrect' }))
        .statusCode,
      401,
    )

    failPolicy = true
    const approval = decide(registration.id, 'approve')
    const arrived = await Promise.race([
      policyInFlight.then(() => true),
      approval.then(() => false),
    ])
    assert.equal(
      arrived,
      true,
      'L’approbation doit atteindre la mise à jour de politique Jellyfin.',
    )
    assert.equal((await decide(registration.id, 'approve')).statusCode, 409)
    releasePolicy()
    const failed = await approval
    assert.equal(failed.statusCode, 503, failed.body)
    const partial = await db.registration.findUniqueOrThrow({
      where: { id: registration.id },
    })
    assert.ok(partial.jellyfinId && partial.lastError)
    const recovered = await decide(registration.id, 'approve')
    assert.equal(recovered.statusCode, 204, recovered.body)
    assert.equal(
      (await users.getUserById({ userId: partial.jellyfinId })).data.Policy
        ?.IsDisabled,
      true,
    )

    const activated = await post('/api/auth/password', body)
    assert.equal(activated.statusCode, 200, activated.body)
    const login = activated.json<AuthResult>()
    assert.equal(login.status, 'authenticated')
    if (login.status !== 'authenticated') throw new Error('Session attendue')
    assert.equal(
      (await getJellyfinUser(jellyfinUrl, login.session)).isAdministrator,
      false,
    )
    const active = await db.registration.findUniqueOrThrow({
      where: { id: registration.id },
    })
    assert.equal(active.jellyfinId, partial.jellyfinId)
    assert.equal(active.passwordHash, null)
    assert.equal(
      (await users.getUserById({ userId: partial.jellyfinId })).data.Policy
        ?.EnableAllFolders,
      true,
    )
    const standardHeaders = {
      authorization: `Bearer ${login.session.accessToken}`,
      'x-hollyfilms-device': login.session.deviceId,
    }
    assert.equal(
      (
        await app.inject({
          url: '/api/admin/registrations',
          headers: standardHeaders,
        })
      ).statusCode,
      403,
    )
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: `/api/admin/registrations/${registration.id}/approve`,
          headers: standardHeaders,
        })
      ).statusCode,
      403,
    )

    const rejected = await post('/api/auth/register', {
      username: 'Demande Refusee',
      password,
    })
    assert.equal(rejected.statusCode, 201, rejected.body)
    const rejectedId = (await list()).find(
      (entry) => entry.username === 'Demande Refusee',
    )!.id
    assert.equal((await decide(rejectedId, 'reject')).statusCode, 204)
    const refused = await db.registration.findUniqueOrThrow({
      where: { id: rejectedId },
    })
    assert.equal(refused.status, 'REJECTED')
    assert.equal(refused.jellyfinId, null)
    assert.equal(refused.passwordHash, null)

    async function googleFlow() {
      const start = await app.inject('/api/auth/google/start')
      assert.equal(start.statusCode, 303, start.body)
      const params = new URL(start.headers.location!).searchParams
      assert.equal(params.get('code_challenge_method'), 'S256')
      const cookie = start.cookies[0]!
      assert.equal(cookie.httpOnly, true)
      const callback = new URLSearchParams({
        code: 'fixture-code',
        state: params.get('state')!,
        nonce: params.get('nonce')!,
        challenge: params.get('code_challenge')!,
      })
      const completed = await app.inject({
        url: `/api/auth/google/callback?${callback}`,
        cookies: { [cookie.name]: cookie.value },
      })
      assert.equal(completed.headers.location, '/?google=complete')
      const exchange = () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/google/complete',
          headers: { origin },
          cookies: { [cookie.name]: cookie.value },
        })
      const result = await exchange()
      assert.equal(result.statusCode, 200, result.body)
      assert.equal((await exchange()).statusCode, 401)
      return result.json<AuthResult>()
    }

    assert.equal((await googleFlow()).status, 'pending')
    const google = (await list()).find(
      (entry) => entry.googleEmail === 'test@example.org',
    )!
    const approvedGoogle = await decide(google.id, 'approve')
    assert.equal(approvedGoogle.statusCode, 204, approvedGoogle.body)
    const googleLogin = await googleFlow()
    assert.equal(googleLogin.status, 'authenticated')
    if (googleLogin.status !== 'authenticated')
      throw new Error('Session Google attendue')
    assert.deepEqual(await getJellyfinUser(jellyfinUrl, googleLogin.session), {
      id: (
        await db.registration.findUniqueOrThrow({ where: { id: google.id } })
      ).jellyfinId,
      name: google.username,
      isAdministrator: false,
    })
    assert.equal(
      await db.registration.count({ where: { method: 'GOOGLE' } }),
      1,
    )
  },
)
