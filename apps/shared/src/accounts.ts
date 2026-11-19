export type JellyfinSession = {
  accessToken: string
  deviceId: string
}

export type AuthResult =
  | { status: 'authenticated'; session: JellyfinSession }
  | { status: 'pending' | 'rejected' }

export type AuthOptions = {
  googleStartUrl: string | null
}

export type RegistrationSummary = {
  id: string
  username: string
  method: 'PASSWORD' | 'GOOGLE'
  status:
    'PENDING' | 'PROVISIONING' | 'AWAITING_PASSWORD' | 'ACTIVE' | 'REJECTED'
  googleEmail: string | null
  googleName?: string | null
  createdAt: string
  decidedAt: string | null
  decidedBy: string | null
  lastError: string | null
}

export type AdminUser = {
  id: string
  username: string
  displayName?: string
  administrator: boolean
  disabled: boolean
  hidden: boolean
  lastActivityAt: string | null
  registrationMethod: RegistrationSummary['method'] | null
  setupPending: boolean
  canChangeAccess: boolean
}
import type { UserPolicy } from '@jellyfin/sdk/lib/generated-client/models/user-policy.js'

export const adminUserPolicyFlags = [
  'IsAdministrator',
  'IsHidden',
  'IsDisabled',
  'EnableRemoteAccess',
  'EnableUserPreferenceAccess',
  'EnableRemoteControlOfOtherUsers',
  'EnableSharedDeviceControl',
  'EnableLiveTvAccess',
  'EnableLiveTvManagement',
  'EnableMediaPlayback',
  'EnableAudioPlaybackTranscoding',
  'EnableVideoPlaybackTranscoding',
  'EnablePlaybackRemuxing',
  'ForceRemoteSourceTranscoding',
  'EnableContentDownloading',
  'EnableContentDeletion',
  'EnableCollectionManagement',
  'EnableSubtitleManagement',
  'EnableLyricManagement',
  'EnablePublicSharing',
  'EnableAllFolders',
  'EnableAllChannels',
  'EnableAllDevices',
] as const satisfies readonly (keyof UserPolicy)[]

export const adminUserScheduleDays = [
  'Everyday',
  'Weekday',
  'Weekend',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export const adminUserUnratedKinds = [
  'Movie',
  'Trailer',
  'Series',
  'Music',
  'Book',
  'LiveTvChannel',
  'LiveTvProgram',
  'ChannelContent',
  'Other',
] as const

export const adminUserSyncPlayModes = [
  'CreateAndJoinGroups',
  'JoinGroups',
  'None',
] as const

export type AdminUserPolicy = Partial<
  Pick<
    UserPolicy,
    | (typeof adminUserPolicyFlags)[number]
    | 'EnableContentDeletionFromFolders'
    | 'EnabledFolders'
    | 'EnabledChannels'
    | 'EnabledDevices'
    | 'BlockedTags'
    | 'AllowedTags'
    | 'BlockUnratedItems'
    | 'AccessSchedules'
    | 'MaxParentalRating'
    | 'MaxParentalSubRating'
    | 'LoginAttemptsBeforeLockout'
    | 'MaxActiveSessions'
    | 'RemoteClientBitrateLimit'
    | 'AuthenticationProviderId'
    | 'PasswordResetProviderId'
    | 'SyncPlayAccess'
  >
>

export type AdminUserDetails = AdminUser & {
  policy: AdminUserPolicy
  isCurrentUser: boolean
  canEdit: boolean
  canRename: boolean
  canChangePassword: boolean
  canChangeRole: boolean
  canChangeProviders: boolean
  canDelete: boolean
}

type AdminUserChoice = { id: string; name: string }

export type AdminUserOptions = {
  libraries: AdminUserChoice[]
  channels: AdminUserChoice[]
  devices: AdminUserChoice[]
  authenticationProviders: AdminUserChoice[]
  passwordResetProviders: AdminUserChoice[]
  ratings: (AdminUserChoice & { value: number; subValue: number | null })[]
}
