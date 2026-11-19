import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import * as oidc from 'openid-client'
import type { GoogleIdentity, accountService } from './accounts.ts'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'
import type { PrismaClient } from './generated/prisma/client.ts'

const cookieName = 'hollyfilms_google'
const googleIssuer = 'https://accounts.google.com'
const ttlSeconds = 600

function profileName(value: unknown) {
  if (typeof value !== 'string') return null
  const name = value.replace(/\s+/gu, ' ').trim()
  return name && name.length <= 200 && !/\p{Cc}/u.test(name) ? name : null
}

export type GoogleProvider = {
  authorizationUrl(params: Record<string, string>): Promise<URL>
  identity(
    url: URL,
    checks: oidc.AuthorizationCodeGrantChecks,
  ): Promise<GoogleIdentity>
}

function googleProvider(
  google: NonNullable<ServerConfig['google']>,
): GoogleProvider {
  let discovery: Promise<oidc.Configuration> | undefined
  function configuration() {
    discovery ??= oidc
      .discovery(
        new URL(googleIssuer),
        google.clientId,
        google.clientSecret,
        undefined,
        {
          execute: [oidc.enableNonRepudiationChecks],
        },
      )
      .catch((error: unknown) => {
        discovery = undefined
        throw error
      })
    return discovery
  }

  return {
    async authorizationUrl(params) {
      return oidc.buildAuthorizationUrl(await configuration(), params)
    },
    async identity(url, checks) {
      const client = await configuration()
      const tokens = await oidc.authorizationCodeGrant(client, url, checks)
      const claims = tokens.claims()
      if (claims?.iss !== googleIssuer || !claims.sub)
        throw new Error('Identité Google invalide')
      let name = profileName(claims.name)
      if (!name) {
        const profile = await oidc
          .fetchUserInfo(client, tokens.access_token, claims.sub)
          .catch(() => undefined)
        name = profileName(profile?.name)
      }
      return {
        issuer: claims.iss,
        subject: claims.sub,
        name,
        picture: typeof claims.picture === 'string' ? claims.picture : null,
        email:
          claims.email_verified === true && typeof claims.email === 'string'
            ? claims.email
            : null,
      }
    },
  }
}

const flowId = (secret: string) =>
  createHash('sha256').update(secret).digest('hex')

export function addGoogleRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  config: ServerConfig,
  accounts: ReturnType<typeof accountService>,
  providerOverride?: GoogleProvider,
) {
  if (!config.google) return

  const provider = providerOverride ?? googleProvider(config.google)
  const redirectUri = `${config.publicOrigin}/api/auth/google/callback`
  const cookie = {
    path: '/api/auth/google',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.publicOrigin.startsWith('https:'),
  }
  const limited = { config: { rateLimit: { max: 25, timeWindow: '1 minute' } } }

  app.get('/api/auth/google/start', limited, async (_request, reply) => {
    const secret = randomBytes(32).toString('base64url')
    const state = oidc.randomState()
    const nonce = oidc.randomNonce()
    const verifier = oidc.randomPKCECodeVerifier()
    const authorizationUrl = await provider.authorizationUrl({
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
    })
    await db.googleFlow.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    })
    await db.googleFlow.create({
      data: {
        id: flowId(secret),
        state,
        nonce,
        verifier,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    })
    return reply
      .setCookie(cookieName, secret, { ...cookie, maxAge: ttlSeconds })
      .redirect(authorizationUrl.href, 303)
  })

  app.get('/api/auth/google/callback', limited, async (request, reply) => {
    const secret = request.cookies[cookieName]
    try {
      if (!secret) throw new Error('Flux Google absent')
      const id = flowId(secret)
      const flow = await db.googleFlow.findUnique({ where: { id } })
      const callbackUrl = new URL(redirectUri)
      callbackUrl.search = new URL(request.url, config.publicOrigin).search
      if (!flow || callbackUrl.searchParams.get('state') !== flow.state)
        throw new Error('État Google invalide')

      const claimed = await db.googleFlow.updateMany({
        where: { id, callbackUsed: false, expiresAt: { gt: new Date() } },
        data: { callbackUsed: true },
      })
      if (claimed.count !== 1)
        throw new Error('Flux Google expiré ou déjà utilisé')

      const identity = await provider.identity(callbackUrl, {
        expectedState: flow.state,
        expectedNonce: flow.nonce,
        pkceCodeVerifier: flow.verifier,
      })
      const registration = await accounts.googleRegistration(identity)
      await db.googleFlow.update({
        where: { id },
        data: { registrationId: registration.id },
      })
      return reply.redirect('/?google=complete', 303)
    } catch {
      return reply
        .clearCookie(cookieName, cookie)
        .redirect('/?google=error', 303)
    }
  })

  app.post('/api/auth/google/complete', limited, async (request, reply) => {
    if (request.headers.origin !== config.publicOrigin) {
      throw new ApiError(
        403,
        'INVALID_ORIGIN',
        'Origine de connexion invalide.',
      )
    }
    const secret = request.cookies[cookieName]
    reply.clearCookie(cookieName, cookie)
    if (!secret)
      throw new ApiError(
        401,
        'GOOGLE_EXPIRED',
        'La connexion Google a expiré. Réessaie.',
      )

    const id = flowId(secret)
    const registrationId = await db.$transaction(async (transaction) => {
      const flow = await transaction.googleFlow.findUnique({
        where: { id },
        select: { registrationId: true },
      })
      if (!flow?.registrationId) return null
      const deleted = await transaction.googleFlow.deleteMany({
        where: { id, expiresAt: { gt: new Date() } },
      })
      return deleted.count === 1 ? flow.registrationId : null
    })
    if (!registrationId)
      throw new ApiError(
        401,
        'GOOGLE_EXPIRED',
        'La connexion Google a expiré. Réessaie.',
      )
    return accounts.signInGoogle(registrationId)
  })
}
