import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto.js'
import type {
  AdminUser,
  AdminUserDetails,
  AdminUserPolicy,
} from '@hollyfilms/shared/accounts'
import { Prisma } from './generated/prisma/client.ts'
import type { PrismaClient, Registration } from './generated/prisma/client.ts'
import type { jellyfinAccounts } from './jellyfin.ts'
import type { ServerConfig } from './config.ts'
import {
  selectAdminUserPolicy,
  validateAdminUserPolicy,
} from './admin-user-policy.ts'
import { ApiError } from './errors.ts'

type RegistrationSummary = Pick<
  Registration,
  'method' | 'status' | 'googleName' | 'googleEmail'
>
type Account = UserDto & {
  Id: string
  Name: string
  Policy: NonNullable<UserDto['Policy']>
}

const normalizeId = (id: string) => id.replaceAll('-', '').toLowerCase()
const usernameKey = (username: string) => username.toUpperCase()
const protectedAccess = () =>
  new ApiError(
    403,
    'USER_ACCESS_PROTECTED',
    'L’accès de ce compte est protégé.',
  )
const missingUser = () =>
  new ApiError(404, 'USER_NOT_FOUND', 'Compte Jellyfin introuvable.')
const setupPending = () =>
  new ApiError(
    409,
    'USER_SETUP_PENDING',
    'Ce compte attend la fin de son inscription.',
  )
const unavailableName = () =>
  new ApiError(
    409,
    'USERNAME_UNAVAILABLE',
    'Ce nom d’utilisateur est indisponible.',
  )
const invalidInput = () =>
  new ApiError(400, 'INVALID_INPUT', 'Vérifie les informations saisies.')

function validateUsername(username: string) {
  if (
    !/^[\p{L}\p{M}\p{N}\p{Pc} .@+'-]+$/u.test(username) ||
    username !== username.trim() ||
    username === '.' ||
    username === '..' ||
    /^(?:hf-setup-|google-[\da-f]{24}$)/i.test(username)
  )
    throw invalidInput()
}

function isStatus(error: unknown, ...statuses: number[]) {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    statuses.includes(error.status)
  )
}

function summary(
  user: UserDto,
  registration?: RegistrationSummary | null,
): AdminUser | null {
  if (!user.Id || !user.Name) return null
  const setupPending = Boolean(registration && registration.status !== 'ACTIVE')
  return {
    id: normalizeId(user.Id),
    username: user.Name,
    displayName:
      registration?.method === 'GOOGLE'
        ? (registration.googleName ?? registration.googleEmail ?? user.Name)
        : user.Name,
    administrator: user.Policy?.IsAdministrator === true,
    disabled: user.Policy?.IsDisabled === true,
    hidden: user.Policy?.IsHidden === true,
    lastActivityAt: user.LastActivityDate ?? null,
    registrationMethod: registration?.method ?? null,
    setupPending,
    canChangeAccess: user.Policy?.IsAdministrator === false && !setupPending,
  }
}

export function adminUserService(
  db: PrismaClient,
  config: ServerConfig,
  jellyfin: ReturnType<typeof jellyfinAccounts>,
  locked: <T>(key: string, operation: () => Promise<T>) => Promise<T>,
) {
  async function readAccount(id: string): Promise<Account> {
    try {
      const user = await jellyfin.account(id)
      if (
        !user?.Id ||
        normalizeId(user.Id) !== id ||
        !user.Name ||
        !user.Policy
      )
        throw missingUser()
      return { ...user, Id: id, Name: user.Name, Policy: user.Policy }
    } catch (error) {
      if (isStatus(error, 404)) throw missingUser()
      throw error
    }
  }

  async function getRegistration(account: Account) {
    return db.registration.findFirst({
      where: {
        OR: [
          { jellyfinId: account.Id },
          { technicalName: account.Name, status: 'PROVISIONING' },
        ],
      },
    })
  }

  async function getUser(id: string, actor: string) {
    const account = await readAccount(normalizeId(id))
    const registration = await getRegistration(account)
    const listed = summary(account, registration)!
    const isCurrentUser = account.Id === normalizeId(actor)
    const canEdit = !listed.setupPending
    const google = registration?.method === 'GOOGLE'
    const detail: AdminUserDetails = {
      ...listed,
      policy: selectAdminUserPolicy(account.Policy),
      isCurrentUser,
      canEdit,
      canRename: canEdit && !google,
      canChangePassword: canEdit && !isCurrentUser && !google,
      canChangeRole: canEdit && !isCurrentUser,
      canChangeProviders: canEdit && !isCurrentUser && !google,
      canDelete: canEdit && !isCurrentUser,
    }
    return { account, registration, detail }
  }

  function assertReady(detail: AdminUserDetails) {
    if (!detail.canEdit) throw setupPending()
  }

  async function verifyAvailable(
    username: string,
    account?: Account,
    registrationId?: string,
  ) {
    validateUsername(username)
    const key = usernameKey(username)
    const [reserved, users] = await Promise.all([
      db.registration.findUnique({
        where: { usernameKey: key },
        select: { id: true },
      }),
      jellyfin.list(),
    ])
    if (
      (reserved && reserved.id !== registrationId) ||
      users.some(
        (user) =>
          (!account || normalizeId(user.Id ?? '') !== account.Id) &&
          usernameKey(user.Name ?? '') === key,
      )
    )
      throw unavailableName()
  }

  async function updateName(account: Account, username: string) {
    try {
      await jellyfin.rename(account.Id, account, username)
    } catch (error) {
      if (isStatus(error, 400, 409)) throw unavailableName()
      throw error
    }
  }

  return {
    async mutate(
      verifyActor: () => Promise<string>,
      operation: (actor: string) => Promise<void>,
    ) {
      await verifyActor()
      // Serialize role changes and recheck the caller after acquiring the lock.
      await locked('admin-user-management', async () =>
        operation(await verifyActor()),
      )
    },

    async list(): Promise<AdminUser[]> {
      const [users, registrations] = await Promise.all([
        jellyfin.list(),
        db.registration.findMany({
          where: {
            OR: [{ jellyfinId: { not: null } }, { status: 'PROVISIONING' }],
          },
          select: {
            jellyfinId: true,
            technicalName: true,
            method: true,
            status: true,
            googleName: true,
            googleEmail: true,
          },
        }),
      ])
      const byId = new Map(
        registrations.flatMap((row) =>
          row.jellyfinId ? [[normalizeId(row.jellyfinId), row] as const] : [],
        ),
      )
      const provisioning = new Map(
        registrations
          .filter((row) => row.status === 'PROVISIONING')
          .map((row) => [row.technicalName, row] as const),
      )
      return users.flatMap((user) => {
        const registration =
          byId.get(normalizeId(user.Id ?? '')) ??
          provisioning.get(user.Name ?? '')
        const listed = summary(user, registration)
        return listed ? [listed] : []
      })
    },

    async details(id: string, actor: string) {
      return (await getUser(id, actor)).detail
    },

    async create(username: string, password: string) {
      if (!password.trim()) throw invalidInput()
      await verifyAvailable(username)
      try {
        await jellyfin.create(username, password)
      } catch (error) {
        if (isStatus(error, 400, 409)) throw unavailableName()
        throw error
      }
    },

    async setAccess(id: string, actor: string, disabled: boolean) {
      const { account, detail } = await getUser(id, actor)
      assertReady(detail)
      if (detail.isCurrentUser || detail.administrator) throw protectedAccess()
      if (detail.disabled !== disabled) {
        await jellyfin.updatePolicy(account.Id, {
          ...account.Policy,
          IsDisabled: disabled,
          ...(disabled ? {} : { InvalidLoginAttemptCount: 0 }),
        })
      }
    },

    async setPolicy(id: string, actor: string, patch: AdminUserPolicy) {
      const { account, detail } = await getUser(id, actor)
      assertReady(detail)
      const next = { ...account.Policy, ...patch }
      if (
        (patch.IsAdministrator !== undefined && !detail.canChangeRole) ||
        (patch.IsDisabled !== undefined &&
          (detail.isCurrentUser || detail.administrator)) ||
        (next.IsAdministrator && next.IsDisabled) ||
        ((patch.AuthenticationProviderId !== undefined ||
          patch.PasswordResetProviderId !== undefined) &&
          !detail.canChangeProviders) ||
        (detail.isCurrentUser &&
          (patch.EnableRemoteAccess === false ||
            patch.EnableAllDevices === false ||
            Boolean(patch.AccessSchedules?.length)))
      )
        throw protectedAccess()
      await validateAdminUserPolicy(patch, config)
      if (
        patch.EnableAllFolders !== undefined ||
        patch.EnabledFolders !== undefined
      )
        next.BlockedMediaFolders = null
      if (
        patch.EnableAllChannels !== undefined ||
        patch.EnabledChannels !== undefined
      )
        next.BlockedChannels = null
      if (patch.IsDisabled === false) next.InvalidLoginAttemptCount = 0
      await jellyfin.updatePolicy(account.Id, next)
    },

    async rename(id: string, actor: string, username: string) {
      const { account, registration, detail } = await getUser(id, actor)
      assertReady(detail)
      if (!detail.canRename) throw protectedAccess()
      if (
        username === account.Name &&
        (!registration || registration.username === username)
      )
        return
      await verifyAvailable(username, account, registration?.id)
      if (!registration) return updateName(account, username)
      try {
        await db.$transaction(
          async (transaction) => {
            await transaction.registration.update({
              where: { id: registration.id },
              data: { username, usernameKey: usernameKey(username) },
            })
            await updateName(account, username)
          },
          { timeout: 15_000 },
        )
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          throw unavailableName()
        throw error
      }
    },

    async setPassword(id: string, actor: string, password: string) {
      const { account, detail } = await getUser(id, actor)
      assertReady(detail)
      if (!detail.canChangePassword) throw protectedAccess()
      if (!password.trim()) throw invalidInput()
      await jellyfin.setPassword(account.Id, password)
    },

    async remove(id: string, actor: string) {
      const userId = normalizeId(id)
      if (userId === normalizeId(actor)) throw protectedAccess()
      // A retry also completes database cleanup if Jellyfin has already deleted the user.
      const current = await getUser(userId, actor).catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'USER_NOT_FOUND')
          return null
        throw error
      })
      const registration =
        current?.registration ??
        (await db.registration.findUnique({ where: { jellyfinId: userId } }))
      if (
        !current &&
        registration &&
        !['ACTIVE', 'REJECTED'].includes(registration.status)
      )
        throw setupPending()
      if (current) {
        assertReady(current.detail)
        await jellyfin.remove(userId).catch((error: unknown) => {
          if (!isStatus(error, 404)) throw error
        })
      }
      await db.$transaction(async (transaction) => {
        await transaction.pushSubscription.deleteMany({ where: { userId } })
        if (!registration) return
        if (registration.method === 'PASSWORD') {
          await transaction.registration.delete({
            where: { id: registration.id },
          })
          return
        }
        await transaction.googleFlow.deleteMany({
          where: { registrationId: registration.id },
        })
        await transaction.registration.update({
          where: { id: registration.id },
          data: {
            status: 'REJECTED',
            technicalPassword: null,
            decidedBy: actor,
            decidedAt: new Date(),
            lastError: null,
          },
        })
      })
    },
  }
}
