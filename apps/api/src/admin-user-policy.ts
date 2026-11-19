import {
  adminUserPolicyFlags,
  adminUserScheduleDays,
  adminUserSyncPlayModes,
  adminUserUnratedKinds,
  type AdminUserOptions,
  type AdminUserPolicy,
} from '@hollyfilms/shared/accounts'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import type { NameIdPair } from '@jellyfin/sdk/lib/generated-client/models/name-id-pair.js'
import type { ParentalRating } from '@jellyfin/sdk/lib/generated-client/models/parental-rating.js'
import type { UserPolicy } from '@jellyfin/sdk/lib/generated-client/models/user-policy.js'
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api.js'
import { getChannelApi } from '@jellyfin/sdk/lib/utils/api/channel-api.js'
import { getDeviceApi } from '@jellyfin/sdk/lib/utils/api/device-api.js'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js'
import { getLocalizationApi } from '@jellyfin/sdk/lib/utils/api/localization-api.js'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'

const options = { timeout: 5_000, maxRedirects: 0 }
const listFields = [
  'EnabledFolders',
  'EnabledChannels',
  'EnabledDevices',
  'EnableContentDeletionFromFolders',
  'BlockedTags',
  'AllowedTags',
] as const satisfies readonly (keyof AdminUserPolicy)[]

const choiceId = { type: 'string', minLength: 1, maxLength: 512 }
const numberLimit = { type: 'integer', minimum: 0, maximum: 2_147_483_647 }
const parentalScore = {
  ...numberLimit,
  minimum: -2_147_483_648,
  nullable: true,
}
const hour = { type: 'number', minimum: 0, maximum: 24 }
const rejectAdditional = { not: {} }
const policyProperties = {
  ...Object.fromEntries(
    adminUserPolicyFlags.map((name) => [name, { type: 'boolean' }]),
  ),
  ...Object.fromEntries(
    listFields.map((name) => [
      name,
      {
        type: 'array',
        maxItems: 1_000,
        uniqueItems: true,
        items: choiceId,
      },
    ]),
  ),
  LoginAttemptsBeforeLockout: { ...numberLimit, minimum: -1 },
  MaxActiveSessions: numberLimit,
  RemoteClientBitrateLimit: numberLimit,
  MaxParentalRating: parentalScore,
  MaxParentalSubRating: parentalScore,
  AuthenticationProviderId: choiceId,
  PasswordResetProviderId: choiceId,
  SyncPlayAccess: { type: 'string', enum: adminUserSyncPlayModes },
  BlockUnratedItems: {
    type: 'array',
    maxItems: adminUserUnratedKinds.length,
    uniqueItems: true,
    items: { type: 'string', enum: adminUserUnratedKinds },
  },
  AccessSchedules: {
    type: 'array',
    maxItems: 100,
    uniqueItems: true,
    items: {
      type: 'object',
      required: ['DayOfWeek', 'StartHour', 'EndHour'],
      additionalProperties: rejectAdditional,
      properties: {
        DayOfWeek: { type: 'string', enum: adminUserScheduleDays },
        StartHour: hour,
        EndHour: hour,
      },
    },
  },
} satisfies Partial<Record<keyof AdminUserPolicy, unknown>>

export const adminUserPolicySchema = {
  type: 'object',
  required: ['policy'],
  additionalProperties: rejectAdditional,
  properties: {
    policy: {
      type: 'object',
      minProperties: 1,
      additionalProperties: rejectAdditional,
      properties: policyProperties,
    },
  },
}

export function selectAdminUserPolicy(policy: UserPolicy): AdminUserPolicy {
  const { AccessSchedules, ...settings } = policy
  const fields = Object.keys(policyProperties) as (keyof AdminUserPolicy)[]
  return {
    ...Object.fromEntries(
      fields.flatMap((field) =>
        field === 'AccessSchedules' || settings[field] === undefined
          ? []
          : [[field, settings[field]]],
      ),
    ),
    AccessSchedules: (AccessSchedules ?? []).flatMap(
      ({ DayOfWeek, StartHour, EndHour }) =>
        DayOfWeek &&
        typeof StartHour === 'number' &&
        typeof EndHour === 'number'
          ? [{ DayOfWeek, StartHour, EndHour }]
          : [],
    ),
  }
}

function choiceList(items: readonly NameIdPair[] | null | undefined) {
  return (items ?? []).flatMap(({ Id, Name }) =>
    Id ? [{ id: Id, name: Name?.trim() || Id }] : [],
  )
}

function ratingList(ratings: readonly ParentalRating[]) {
  const groups = new Map<
    string,
    { value: number; subValue: number | null; names: Set<string> }
  >()
  for (const rating of ratings) {
    const value = rating.RatingScore?.score ?? rating.Value
    const subValue = rating.RatingScore?.subScore ?? null
    if (typeof value !== 'number' || !rating.Name) continue
    const id = `${value}:${subValue ?? ''}`
    const existing = groups.get(id)
    if (existing) existing.names.add(rating.Name)
    else groups.set(id, { value, subValue, names: new Set([rating.Name]) })
  }
  return Array.from(groups, ([id, { value, subValue, names }]) => ({
    id,
    name: [...names].join(' / '),
    value,
    subValue,
  }))
}

function managementApi(config: ServerConfig) {
  return createJellyfinApi(
    config.jellyfinUrl,
    'hollyfilms-management',
    config.jellyfinApiKey,
  )
}

async function readOptions<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch {
    throw new ApiError(
      503,
      'JELLYFIN_UNAVAILABLE',
      'Impossible de charger les options des comptes Jellyfin.',
    )
  }
}

export function getAdminUserOptions(
  config: ServerConfig,
): Promise<AdminUserOptions> {
  return readOptions(async () => {
    const api = managementApi(config)
    const auth = getAuthenticationApi(api)
    const [libraries, channels, devices, ratings, providers, resetProviders] =
      await Promise.all([
        getLibraryApi(api).getMediaFolders({ isHidden: false }, options),
        getChannelApi(api).getChannels({}, options),
        getDeviceApi(api).getDevices({}, options),
        getLocalizationApi(api).getParentalRatings(options),
        auth.getAuthProviders(options),
        auth.getPasswordResetProviders(options),
      ])

    return {
      libraries: choiceList(libraries.data.Items),
      channels: choiceList(channels.data.Items),
      devices: choiceList(
        devices.data.Items?.map(({ Id, Name, CustomName }) => ({
          Id,
          Name: CustomName || Name,
        })),
      ),
      ratings: ratingList(ratings.data),
      authenticationProviders: choiceList(providers.data),
      passwordResetProviders: choiceList(resetProviders.data),
    }
  })
}

export async function validateAdminUserPolicy(
  policy: AdminUserPolicy,
  config: ServerConfig,
): Promise<void> {
  for (const schedule of policy.AccessSchedules ?? []) {
    if (
      typeof schedule.StartHour !== 'number' ||
      typeof schedule.EndHour !== 'number' ||
      schedule.StartHour >= schedule.EndHour
    ) {
      throw new ApiError(
        400,
        'INVALID_INPUT',
        'L’heure de fin doit être postérieure à l’heure de début.',
      )
    }
  }

  const { AuthenticationProviderId, PasswordResetProviderId } = policy
  if (
    AuthenticationProviderId === undefined &&
    PasswordResetProviderId === undefined
  )
    return

  const auth = getAuthenticationApi(managementApi(config))
  const [authentication, resets] = await readOptions(() =>
    Promise.all([
      AuthenticationProviderId === undefined
        ? undefined
        : auth.getAuthProviders(options),
      PasswordResetProviderId === undefined
        ? undefined
        : auth.getPasswordResetProviders(options),
    ]),
  )
  if (
    (authentication &&
      !authentication.data.some(({ Id }) => Id === AuthenticationProviderId)) ||
    (resets && !resets.data.some(({ Id }) => Id === PasswordResetProviderId))
  ) {
    throw new ApiError(
      400,
      'INVALID_INPUT',
      'Le fournisseur sélectionné est indisponible.',
    )
  }
}
