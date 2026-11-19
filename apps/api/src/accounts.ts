import { randomBytes } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import pg from 'pg'
import type { AuthResult } from '@hollyfilms/shared/accounts'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'
import { Prisma } from './generated/prisma/client.ts'
import type { PrismaClient, Registration } from './generated/prisma/client.ts'
import { jellyfinAccounts } from './jellyfin.ts'
import { adminUserService } from './admin-users.ts'
import { decryptPassword, encryptPassword } from './passwords.ts'
import { googlePictureUrl } from '@hollyfilms/shared/profile'

export type GoogleIdentity = {
  issuer: string
  subject: string
  email: string | null
  name?: string | null
  picture?: string | null
}

const registrationSummary = {
  id: true,
  username: true,
  method: true,
  status: true,
  googleEmail: true,
  googleName: true,
  createdAt: true,
  decidedAt: true,
  decidedBy: true,
  lastError: true,
} as const

const normalizeName = (name: string) => name.toUpperCase()
const technicalName = () => `hf-setup-${randomBytes(18).toString('hex')}`
const unavailable = () =>
  new ApiError(
    409,
    'USERNAME_UNAVAILABLE',
    'Ce nom d’utilisateur est indisponible.',
  )

export function accountService(db: PrismaClient, config: ServerConfig) {
  const jellyfin = jellyfinAccounts(config)

  async function locked<T>(id: string, work: () => Promise<T>): Promise<T> {
    const connection = new pg.Client({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 5_000,
    })
    // pg reports connection failures on idle clients as events. Checkpoints are
    // committed separately, so a new request can resume after disconnection.
    connection.on('error', () => {})
    try {
      await connection.connect()
      const { rows } = await connection.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',
        [id],
      )
      if (!rows[0]?.acquired)
        throw new ApiError(
          409,
          'IN_PROGRESS',
          'Une opération est déjà en cours. Réessaie dans un instant.',
        )
      return await work()
    } finally {
      await connection.end()
    }
  }

  async function getRegistration(id: string) {
    const registration = await db.registration.findUnique({ where: { id } })
    if (!registration)
      throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable.')
    return registration
  }

  function googleKey() {
    if (!config.google)
      throw new ApiError(
        503,
        'GOOGLE_DISABLED',
        'La connexion Google est indisponible.',
      )
    return config.google.passwordKey
  }

  async function provision(registration: Registration) {
    const users = await jellyfin.list()
    if (
      users.some(
        (user) =>
          user.Id !== registration.jellyfinId &&
          normalizeName(user.Name ?? '') === registration.usernameKey,
      )
    ) {
      throw unavailable()
    }

    let password = randomBytes(32).toString('base64url')
    if (registration.method === 'GOOGLE') {
      const key = googleKey()
      if (registration.technicalPassword) {
        password = decryptPassword(
          registration.technicalPassword,
          key,
          registration.id,
        )
      } else {
        await db.registration.update({
          where: { id: registration.id },
          data: {
            technicalPassword: encryptPassword(password, key, registration.id),
          },
        })
      }
    }

    let id = registration.jellyfinId
    if (!id) {
      id =
        users.find((user) => user.Name === registration.technicalName)?.Id ??
        (await jellyfin.create(registration.technicalName, password))
      await db.registration.update({
        where: { id: registration.id },
        data: { jellyfinId: id },
      })
    }

    const account = await jellyfin.account(id)
    await jellyfin.setPolicy(id, account, true, true)
    if (registration.method === 'GOOGLE')
      await jellyfin.setPassword(id, password)
    await jellyfin.rename(id, account, registration.username)
    if (registration.method === 'GOOGLE') {
      await jellyfin.setPolicy(id, await jellyfin.account(id), false, true)
    }

    await db.registration.update({
      where: { id: registration.id },
      data: {
        status:
          registration.method === 'GOOGLE' ? 'ACTIVE' : 'AWAITING_PASSWORD',
        lastError: null,
      },
    })
  }

  return {
    admin: jellyfin.admin,
    adminUsers: adminUserService(db, config, jellyfin, locked),

    async register(username: string, password: string) {
      const usernameKey = normalizeName(username)
      if (
        (await jellyfin.list()).some(
          (user) => normalizeName(user.Name ?? '') === usernameKey,
        )
      )
        throw unavailable()
      const passwordHash = await hash(password)
      try {
        await db.registration.create({
          data: {
            method: 'PASSWORD',
            username,
            usernameKey,
            technicalName: technicalName(),
            passwordHash,
          },
        })
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          throw unavailable()
        throw error
      }
    },

    async googleRegistration(identity: GoogleIdentity) {
      const username = `Google-${randomBytes(12).toString('hex')}`
      const googlePicture = googlePictureUrl(identity.picture)
      const googleIssuer_googleSubject = {
        googleIssuer: identity.issuer,
        googleSubject: identity.subject,
      }
      return db.registration.upsert({
        where: { googleIssuer_googleSubject },
        create: {
          ...googleIssuer_googleSubject,
          method: 'GOOGLE',
          googleEmail: identity.email,
          googleName: identity.name ?? null,
          googlePicture,
          username,
          usernameKey: normalizeName(username),
          technicalName: technicalName(),
        },
        update: {
          googleEmail: identity.email,
          googleName: identity.name ?? undefined,
          googlePicture,
        },
        select: { id: true },
      })
    },

    async signInGoogle(id: string): Promise<AuthResult> {
      const registration = await getRegistration(id)
      if (registration.status === 'REJECTED') return { status: 'rejected' }
      if (registration.status !== 'ACTIVE') return { status: 'pending' }
      if (
        !registration.jellyfinId ||
        !registration.technicalPassword ||
        registration.method !== 'GOOGLE'
      ) {
        throw new Error('Compte Google incomplet')
      }
      const password = decryptPassword(
        registration.technicalPassword,
        googleKey(),
        id,
      )
      return {
        status: 'authenticated',
        session: await jellyfin.signIn(
          registration.username,
          password,
          registration.jellyfinId,
        ),
      }
    },

    async signInPassword(
      username: string,
      password: string,
    ): Promise<AuthResult> {
      const registration = await db.registration.findUnique({
        where: { usernameKey: normalizeName(username) },
      })
      if (
        !registration ||
        registration.method !== 'PASSWORD' ||
        registration.status === 'REJECTED'
      ) {
        return {
          status: 'authenticated',
          session: await jellyfin.signIn(username, password),
        }
      }
      if (registration.status === 'ACTIVE') {
        if (!registration.jellyfinId)
          throw new Error('Compte Jellyfin incomplet')
        return {
          status: 'authenticated',
          session: await jellyfin.signIn(
            username,
            password,
            registration.jellyfinId,
          ),
        }
      }
      if (
        !registration.passwordHash ||
        !(await verify(registration.passwordHash, password))
      ) {
        throw new ApiError(
          401,
          'INVALID_CREDENTIALS',
          'Jellyfin a refusé la connexion. Vérifie tes identifiants.',
        )
      }
      if (registration.status !== 'AWAITING_PASSWORD')
        return { status: 'pending' }

      return locked(registration.id, async () => {
        const current = await getRegistration(registration.id)
        if (!current.jellyfinId) throw new Error('Compte Jellyfin incomplet')
        if (current.status === 'ACTIVE') {
          return {
            status: 'authenticated',
            session: await jellyfin.signIn(
              username,
              password,
              current.jellyfinId,
            ),
          }
        }
        const account = await jellyfin.account(current.jellyfinId)
        if (
          account.Policy?.IsAdministrator ||
          account.Name !== current.username ||
          account.Id !== current.jellyfinId
        ) {
          throw new Error('Le compte Jellyfin ne correspond pas à la demande')
        }
        await jellyfin.setPassword(current.jellyfinId, password)
        await jellyfin.setPolicy(current.jellyfinId, account, false, false)
        const session = await jellyfin.signIn(
          current.username,
          password,
          current.jellyfinId,
        )
        await db.registration.update({
          where: { id: current.id },
          data: { status: 'ACTIVE', passwordHash: null },
        })
        return { status: 'authenticated', session }
      })
    },

    list: () =>
      db.registration.findMany({
        select: registrationSummary,
        orderBy: { createdAt: 'desc' },
      }),

    async approve(id: string, adminId: string) {
      return locked(id, async () => {
        let registration = await getRegistration(id)
        if (
          registration.status === 'ACTIVE' ||
          registration.status === 'AWAITING_PASSWORD'
        )
          return
        if (registration.status === 'REJECTED')
          throw new ApiError(
            409,
            'ALREADY_REJECTED',
            'Cette demande a déjà été refusée.',
          )
        registration = await db.registration.update({
          where: { id },
          data: {
            status: 'PROVISIONING',
            lastError: null,
            decidedAt: registration.decidedAt ?? new Date(),
            decidedBy: registration.decidedBy ?? adminId,
          },
        })
        try {
          await provision(registration)
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : 'La création ou la configuration du compte Jellyfin a échoué.'
          await db.registration.update({
            where: { id },
            data: { lastError: message },
          })
          throw new ApiError(
            error instanceof ApiError ? error.statusCode : 503,
            'PROVISIONING_FAILED',
            message,
          )
        }
      })
    },

    async reject(id: string, adminId: string) {
      return locked(id, async () => {
        const registration = await getRegistration(id)
        if (registration.status === 'REJECTED') return
        if (registration.status !== 'PENDING')
          throw new ApiError(
            409,
            'ALREADY_APPROVED',
            'La création du compte a déjà commencé.',
          )
        await db.registration.update({
          where: { id },
          data: {
            status: 'REJECTED',
            decidedAt: new Date(),
            decidedBy: adminId,
            passwordHash: null,
          },
        })
      })
    },
  }
}
