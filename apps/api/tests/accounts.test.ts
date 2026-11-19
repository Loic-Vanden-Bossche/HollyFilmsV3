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
  AdminUser,
  AdminUserDetails,
  AdminUserOptions,
  AuthResult,
  RegistrationSummary,
} from '@hollyfilms/shared/accounts'
import {
  googlePictureUrl,
  type AccountProfile,
} from '@hollyfilms/shared/profile'

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

    let googleProfileName: string | null = null
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
          name: googleProfileName,
          picture: 'https://lh3.googleusercontent.com/fixture-avatar',
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
    const directory = async () => {
      const response = await app.inject({
        url: '/api/admin/users',
        headers: adminHeaders,
      })
      assert.equal(response.statusCode, 200, response.body)
      return response.json<AdminUser[]>()
    }
    const adminUserPath = '/api/admin/users'
    const manageUser = (
      method: 'GET' | 'PUT' | 'DELETE',
      path: string,
      payload?: object,
      headers = adminHeaders,
    ) =>
      app.inject({
        method,
        url: `${adminUserPath}/${path}`,
        headers,
        payload,
      })
    const setAccess = (id: string, disabled: boolean, headers = adminHeaders) =>
      app.inject({
        method: 'PUT',
        url: `/api/admin/users/${id}/access`,
        headers,
        payload: { disabled },
      })
    const password = randomBytes(16).toString('hex')
    const body = { username: 'Demande Test', password }

    const existing = await post('/api/auth/password', {
      username: 'HollyFilmsTestAdmin',
      password: adminPassword,
    })
    assert.equal(existing.json<AuthResult>().status, 'authenticated')
    assert.equal((await app.inject('/api/admin/registrations')).statusCode, 401)
    assert.equal((await app.inject('/api/admin/users')).statusCode, 401)
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

    assert.equal(
      (await directory()).find((user) => user.id === partial.jellyfinId)
        ?.setupPending,
      true,
    )
    assert.equal((await setAccess(partial.jellyfinId, false)).statusCode, 409)
    assert.equal(
      (
        await manageUser('PUT', `${partial.jellyfinId}/policy`, {
          policy: { IsHidden: false },
        })
      ).statusCode,
      409,
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
      (await app.inject({ url: '/api/admin/users', headers: standardHeaders }))
        .statusCode,
      403,
    )
    const listed = await directory()
    const adminUser = listed.find(
      (row) => row.username === 'HollyFilmsTestAdmin',
    )!
    assert.equal(adminUser.administrator, true)
    assert.equal(adminUser.canChangeAccess, false)
    assert.equal((await setAccess(adminUser.id, true)).statusCode, 403)
    assert.equal(
      listed.find((row) => row.id === active.jellyfinId)?.registrationMethod,
      'PASSWORD',
    )

    const nativeUsername = 'Jellyfin Native Member'
    const { data: nativeUser } = await users.createUserByName({
      createUserByName: { Name: nativeUsername, Password: password },
    })
    assert.ok(nativeUser.Id && nativeUser.Policy)
    await users.updateUserPolicy({
      userId: nativeUser.Id,
      userPolicy: {
        ...nativeUser.Policy,
        IsHidden: true,
        EnableAllFolders: false,
      },
    })
    const nativeAccount = (await directory()).find(
      (user) => user.id === nativeUser.Id,
    )!
    assert.equal(nativeAccount.registrationMethod, null)
    assert.equal(nativeAccount.hidden, true)
    assert.equal(nativeAccount.canChangeAccess, true)
    const nativeSession = await authenticateJellyfin(
      jellyfinUrl,
      nativeUsername,
      password,
    )
    assert.equal(
      (await setAccess(nativeAccount.id, true, standardHeaders)).statusCode,
      403,
    )
    const suspended = await setAccess(nativeAccount.id, true)
    assert.equal(suspended.statusCode, 204, suspended.body)
    await assert.rejects(getJellyfinUser(jellyfinUrl, nativeSession))
    assert.equal((await setAccess(nativeAccount.id, true)).statusCode, 204)
    assert.equal(
      (await directory()).find((user) => user.id === nativeAccount.id)
        ?.disabled,
      true,
    )
    assert.equal(
      (await post('/api/auth/password', { username: nativeUsername, password }))
        .statusCode,
      401,
    )
    const restored = await setAccess(nativeAccount.id, false)
    assert.equal(restored.statusCode, 204, restored.body)
    const restoredPolicy = (
      await users.getUserById({ userId: nativeAccount.id })
    ).data.Policy
    assert.equal(restoredPolicy?.IsDisabled, false)
    assert.equal(restoredPolicy?.IsHidden, true)
    assert.equal(restoredPolicy?.EnableAllFolders, false)
    assert.equal(
      (
        await post('/api/auth/password', { username: nativeUsername, password })
      ).json<AuthResult>().status,
      'authenticated',
    )
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
      assert.equal(params.get('scope'), 'openid email profile')
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
    assert.equal(google.googleName, null)
    const approvedGoogle = await decide(google.id, 'approve')
    assert.equal(approvedGoogle.statusCode, 204, approvedGoogle.body)
    assert.equal(
      (await directory()).find((user) => user.username === google.username)
        ?.displayName,
      'test@example.org',
    )
    googleProfileName = 'Élodie Moreau'
    const googleLogin = await googleFlow()
    assert.equal(googleLogin.status, 'authenticated')
    if (googleLogin.status !== 'authenticated')
      throw new Error('Session Google attendue')
    assert.equal(
      (await list()).find((entry) => entry.id === google.id)?.googleName,
      googleProfileName,
    )
    assert.equal(
      (await directory()).find((user) => user.username === google.username)
        ?.displayName,
      googleProfileName,
    )
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

    await context.test(
      'Gestion administrateur : création, règles Jellyfin et suppression',
      async () => {
        const username = 'Compte administration Test'
        const replacementPassword = randomBytes(18).toString('hex')
        const create = (name: string, headers = adminHeaders) =>
          app.inject({
            method: 'POST',
            url: adminUserPath,
            headers,
            payload: { username: name, password },
          })

        assert.equal(
          (await app.inject(`${adminUserPath}/options`)).statusCode,
          401,
        )
        assert.equal(
          (await manageUser('GET', 'options', undefined, standardHeaders))
            .statusCode,
          403,
        )
        const options = await manageUser('GET', 'options')
        assert.equal(options.statusCode, 200, options.body)
        const choices = options.json<AdminUserOptions>()
        assert.ok(Array.isArray(choices.libraries))
        assert.ok(Array.isArray(choices.devices))
        assert.ok(Array.isArray(choices.channels))
        assert.ok(Array.isArray(choices.ratings))
        assert.ok(choices.authenticationProviders.length > 0)
        assert.ok(choices.passwordResetProviders.length > 0)
        assert.equal((await create(username, standardHeaders)).statusCode, 403)
        assert.equal(
          (await create(body.username.toUpperCase())).statusCode,
          409,
        )
        const created = await create(username)
        assert.equal(created.statusCode, 204, created.body)
        const target = (await directory()).find(
          (user) => user.username === username,
        )
        assert.ok(target)

        const current = await manageUser('GET', target.id)
        assert.equal(current.statusCode, 200, current.body)
        const details = current.json<AdminUserDetails>()
        assert.equal(details.policy.IsAdministrator, false)
        assert.equal(details.canRename, true)
        assert.equal(details.canChangePassword, true)
        assert.equal(details.canChangeRole, true)
        assert.equal(details.canDelete, true)
        assert.equal(
          (await manageUser('GET', target.id, undefined, standardHeaders))
            .statusCode,
          403,
        )
        const editPolicy = (policy: object, headers = adminHeaders) =>
          manageUser('PUT', `${target.id}/policy`, { policy }, headers)
        const setVisible = await editPolicy({ IsHidden: false })
        assert.equal(setVisible.statusCode, 204, setVisible.body)
        assert.ok(
          (await users.getPublicUsers()).data.some(
            (user) => user.Id === target.id,
          ),
        )
        const edited = await editPolicy({
          IsHidden: true,
          EnableAllFolders: false,
          EnableMediaPlayback: false,
        })
        assert.equal(edited.statusCode, 204, edited.body)
        assert.equal(
          (await editPolicy({ IsDisabled: true }, standardHeaders)).statusCode,
          403,
        )
        assert.equal(
          (await editPolicy({ UnknownPolicyOption: true })).statusCode,
          400,
        )
        assert.equal(
          (await editPolicy({ InvalidLoginAttemptCount: 37 })).statusCode,
          400,
        )

        const updated = await editPolicy({ EnableMediaPlayback: true })
        assert.equal(updated.statusCode, 204, updated.body)
        const policy = (await users.getUserById({ userId: target.id })).data
          .Policy
        assert.equal(policy?.IsDisabled, false)
        assert.equal(policy?.IsHidden, true)
        assert.equal(policy?.EnableAllFolders, false)
        assert.equal(policy?.EnableMediaPlayback, true)
        assert.equal(policy?.InvalidLoginAttemptCount, 0)
        assert.ok(
          !(await users.getPublicUsers()).data.some(
            (user) => user.Id === target.id,
          ),
        )
        const session = await authenticateJellyfin(
          jellyfinUrl,
          username,
          password,
        )

        const promoted = await editPolicy({ IsAdministrator: true })
        assert.equal(promoted.statusCode, 204, promoted.body)
        assert.equal(
          (await getJellyfinUser(jellyfinUrl, session)).isAdministrator,
          true,
        )
        const suspendAdmin = await editPolicy({ IsDisabled: true })
        assert.ok(
          [403, 409].includes(suspendAdmin.statusCode),
          suspendAdmin.body,
        )
        const demoted = await editPolicy({ IsAdministrator: false })
        assert.equal(demoted.statusCode, 204, demoted.body)
        assert.equal(
          (await getJellyfinUser(jellyfinUrl, session)).isAdministrator,
          false,
        )
        const selfDemotion = await manageUser('PUT', `${adminUser.id}/policy`, {
          policy: { IsAdministrator: false },
        })
        assert.equal(selfDemotion.statusCode, 403, selfDemotion.body)

        const renamed = 'Compte administration Renommé'
        const rename = await manageUser('PUT', `${target.id}/username`, {
          username: renamed,
        })
        assert.equal(rename.statusCode, 204, rename.body)
        assert.equal(
          (await getJellyfinUser(jellyfinUrl, session)).name,
          renamed,
        )
        const reset = await manageUser('PUT', `${target.id}/password`, {
          password: replacementPassword,
        })
        assert.equal(reset.statusCode, 204, reset.body)
        await assert.rejects(getJellyfinUser(jellyfinUrl, session))
        const newSession = await authenticateJellyfin(
          jellyfinUrl,
          renamed,
          replacementPassword,
        )
        assert.equal(
          (await getJellyfinUser(jellyfinUrl, newSession)).id,
          target.id,
        )

        const restricted = await editPolicy({
          BlockedTags: ['fixture-tag'],
          AccessSchedules: [
            { DayOfWeek: 'Monday', StartHour: 17.5, EndHour: 20 },
          ],
        })
        assert.equal(restricted.statusCode, 204, restricted.body)
        const saved = (
          await manageUser('GET', target.id)
        ).json<AdminUserDetails>()
        assert.deepEqual(saved.policy.BlockedTags, ['fixture-tag'])
        const [schedule] = saved.policy.AccessSchedules ?? []
        assert.equal(schedule?.DayOfWeek, 'Monday')
        assert.equal(schedule?.StartHour, 17.5)
        assert.equal(schedule?.EndHour, 20)

        assert.equal(
          (await manageUser('DELETE', target.id, undefined, standardHeaders))
            .statusCode,
          403,
        )
        assert.equal((await manageUser('DELETE', adminUser.id)).statusCode, 403)
        const removed = await manageUser('DELETE', target.id)
        assert.equal(removed.statusCode, 204, removed.body)
        await assert.rejects(getJellyfinUser(jellyfinUrl, newSession))
        assert.equal((await manageUser('GET', target.id)).statusCode, 404)
      },
    )

    await context.test(
      'Profils : identité, photo Google, import, suppression et permissions',
      async () => {
        const googleHeaders = {
          authorization: `Bearer ${googleLogin.session.accessToken}`,
          'x-hollyfilms-device': googleLogin.session.deviceId,
        }
        const profile = async (headers = standardHeaders) => {
          const result = await app.inject({ url: '/api/profile', headers })
          assert.equal(result.statusCode, 200, result.body)
          return result.json<AccountProfile>()
        }
        assert.equal((await app.inject('/api/profile')).statusCode, 401)
        assert.equal((await app.inject('/api/profile/image')).statusCode, 401)
        assert.equal(
          (await app.inject({ method: 'DELETE', url: '/api/profile/image' }))
            .statusCode,
          401,
        )
        assert.equal((await profile()).id, active.jellyfinId)
        assert.equal((await profile()).google, null)
        assert.equal((await profile()).name, active.username)
        assert.equal((await profile()).canEdit, true)
        assert.equal((await profile(googleHeaders)).name, 'Élodie Moreau')
        assert.equal(
          (await profile(googleHeaders)).google?.picture,
          'https://lh3.googleusercontent.com/fixture-avatar',
        )
        assert.equal(
          (await profile(googleHeaders)).google?.email,
          'test@example.org',
        )
        assert.equal(
          googlePictureUrl(
            'https://googleusercontent.com.attacker.test/avatar',
          ),
          null,
        )
        assert.equal(
          googlePictureUrl('http://lh3.googleusercontent.com/avatar'),
          null,
        )
        assert.equal(googlePictureUrl('javascript:alert(1)'), null)
        const png =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHfoAAAAASUVORK5CYII='
        const upload = await app.inject({
          method: 'PUT',
          url: '/api/profile/image',
          headers: googleHeaders,
          payload: { type: 'image/png', data: png },
        })
        assert.equal(upload.statusCode, 204, upload.body)
        assert.ok((await profile(googleHeaders)).imageTag)
        assert.equal(
          (await profile()).imageTag,
          null,
          'Uploading never modifies another user',
        )
        assert.ok(
          (
            await users.getUserById({
              userId: (await profile(googleHeaders)).id,
            })
          ).data.PrimaryImageTag,
        )
        const image = await app.inject({
          url: '/api/profile/image',
          headers: googleHeaders,
        })
        assert.equal(image.statusCode, 200, image.body)
        assert.match(String(image.headers['content-type']), /^image\//)
        assert.ok(image.rawPayload.length > 0)
        assert.equal(
          (
            await app.inject({
              method: 'DELETE',
              url: '/api/profile/image',
              headers: googleHeaders,
            })
          ).statusCode,
          204,
        )
        assert.equal((await profile(googleHeaders)).imageTag, null)
        assert.ok(
          (await profile(googleHeaders)).google?.picture,
          'Custom removal restores the Google fallback',
        )
        const invalid = await app.inject({
          method: 'PUT',
          url: '/api/profile/image',
          headers: standardHeaders,
          payload: {
            type: 'image/png',
            data: Buffer.from('not an actual image').toString('base64'),
          },
        })
        assert.equal(invalid.statusCode, 400)
        assert.equal(
          (
            await app.inject({
              method: 'PUT',
              url: '/api/profile/image',
              headers: { ...standardHeaders, origin: 'https://attacker.test' },
              payload: { type: 'image/png', data: png },
            })
          ).statusCode,
          403,
        )
        const policy = (await users.getUserById({ userId: active.jellyfinId! }))
          .data.Policy!
        await users.updateUserPolicy({
          userId: active.jellyfinId!,
          userPolicy: { ...policy, EnableUserPreferenceAccess: false },
        })
        assert.equal((await profile()).canEdit, false)
        assert.equal(
          (
            await app.inject({
              method: 'PUT',
              url: '/api/profile/image',
              headers: standardHeaders,
              payload: { type: 'image/png', data: png },
            })
          ).statusCode,
          403,
        )
        await users.updateUserPolicy({
          userId: active.jellyfinId!,
          userPolicy: policy,
        })
      },
    )
    await context.test(
      'Mot de passe : vérification, changement, suppression et protection SSO/admin',
      async () => {
        const change = (
          headers: typeof standardHeaders,
          currentPassword: string,
          newPassword: string,
        ) =>
          app.inject({
            method: 'PUT',
            url: '/api/profile/password',
            headers,
            payload: { currentPassword, newPassword },
          })
        assert.equal(
          (await change(standardHeaders, 'incorrect', 'new-password'))
            .statusCode,
          403,
        )
        const changed = await change(standardHeaders, password, 'new-password')
        assert.equal(changed.statusCode, 204, changed.body)
        assert.equal(
          (
            await post('/api/auth/password', {
              ...body,
              password: 'new-password',
            })
          ).json<AuthResult>().status,
          'authenticated',
        )
        const removed = await change(standardHeaders, 'new-password', '')
        assert.equal(removed.statusCode, 204, removed.body)
        assert.equal(
          (
            await post('/api/auth/password', { ...body, password: '' })
          ).json<AuthResult>().status,
          'authenticated',
        )
        assert.equal(
          (await change(adminHeaders, adminPassword, '')).statusCode,
          400,
        )
        const googleHeaders = {
          authorization: `Bearer ${googleLogin.session.accessToken}`,
          'x-hollyfilms-device': googleLogin.session.deviceId,
        }
        assert.equal(
          (await change(googleHeaders, '', 'do-not-change')).statusCode,
          409,
        )
        googleProfileName = null
        assert.equal(
          (await googleFlow()).status,
          'authenticated',
          'Google SSO must remain functional',
        )
        assert.equal(
          (await list()).find((entry) => entry.id === google.id)?.googleName,
          'Élodie Moreau',
          'An omitted Google claim must preserve the last known profile name',
        )
      },
    )
    await context.test(
      'Gestion administrateur : identifiants synchronisés et protection Google',
      async () => {
        assert.ok(active.jellyfinId)
        const username = 'Demande renommée'
        const renamed = await manageUser(
          'PUT',
          `${active.jellyfinId}/username`,
          {
            username,
          },
        )
        assert.equal(renamed.statusCode, 204, renamed.body)
        const linked = await db.registration.findUniqueOrThrow({
          where: { id: active.id },
        })
        assert.equal(linked.username, username)
        assert.equal(linked.usernameKey, username.toUpperCase())
        assert.equal(linked.jellyfinId, active.jellyfinId)
        const login = await post('/api/auth/password', {
          username,
          password: '',
        })
        assert.equal(login.statusCode, 200, login.body)
        assert.equal(login.json<AuthResult>().status, 'authenticated')

        const googleUser = await getJellyfinUser(
          jellyfinUrl,
          googleLogin.session,
        )
        const googleDetails = await manageUser('GET', googleUser.id)
        assert.equal(googleDetails.statusCode, 200, googleDetails.body)
        const googleCapabilities = googleDetails.json<AdminUserDetails>()
        assert.equal(googleCapabilities.canRename, false)
        assert.equal(googleCapabilities.canChangePassword, false)
        assert.equal(googleCapabilities.canChangeProviders, false)
        assert.equal(googleCapabilities.canDelete, true)
        const renameGoogle = await manageUser(
          'PUT',
          `${googleUser.id}/username`,
          {
            username: 'Google Ne Pas Renommer',
          },
        )
        const resetGoogle = await manageUser(
          'PUT',
          `${googleUser.id}/password`,
          {
            password,
          },
        )
        for (const denied of [renameGoogle, resetGoogle]) {
          assert.ok([403, 409].includes(denied.statusCode), denied.body)
        }
        const providerGoogle = await manageUser(
          'PUT',
          `${googleUser.id}/policy`,
          {
            policy: {
              AuthenticationProviderId: 'Do.Not.Replace.Google.Provider',
            },
          },
        )
        assert.ok(
          [400, 403, 409].includes(providerGoogle.statusCode),
          providerGoogle.body,
        )
        assert.equal((await googleFlow()).status, 'authenticated')

        const deleted = await manageUser('DELETE', googleUser.id)
        assert.equal(deleted.statusCode, 204, deleted.body)
        const tombstone = await db.registration.findUniqueOrThrow({
          where: { id: google.id },
        })
        assert.equal(tombstone.status, 'REJECTED')
        assert.equal(tombstone.technicalPassword, null)
        await assert.rejects(getJellyfinUser(jellyfinUrl, googleLogin.session))
        assert.equal((await googleFlow()).status, 'rejected')
        assert.equal(
          (await manageUser('DELETE', googleUser.id)).statusCode,
          204,
        )
        assert.ok(
          !(await directory()).some((user) => user.id === googleUser.id),
        )
      },
    )
  },
)
