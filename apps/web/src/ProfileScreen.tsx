import { useQueryClient } from '@tanstack/react-query'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import {
  deleteProfileImage,
  updateProfileImage,
  updateProfilePassword,
} from './account-api.ts'
import { useProfile, profileKey } from './use-profile.ts'
import { ProfilePage } from './ProfilePage.tsx'
import { DeviceSettings } from './ui/DeviceSettings.tsx'
import { useDevicePreferences } from './pwa/use-device-preferences.ts'

function ConnectedDeviceSettings({
  session,
  userId,
}: {
  session: JellyfinSession
  userId: string
}) {
  const preferences = useDevicePreferences(session, userId)
  return <DeviceSettings {...preferences} />
}

export function ProfileScreen({
  session,
  onSignOut,
  signingOut,
}: {
  session: JellyfinSession
  onSignOut: () => void
  signingOut: boolean
}) {
  const profile = useProfile(session)
  const client = useQueryClient()
  const refresh = () =>
    client.invalidateQueries({ queryKey: profileKey(session), exact: true })
  return (
    <ProfilePage
      profile={profile.data}
      deviceSettings={
        profile.data && (
          <ConnectedDeviceSettings
            key={profile.data.id}
            session={session}
            userId={profile.data.id}
          />
        )
      }
      avatarUrl={profile.avatarUrl}
      state={
        profile.isPending ? 'loading' : profile.isError ? 'error' : 'ready'
      }
      signingOut={signingOut}
      onSignOut={onSignOut}
      onRetry={() => void profile.refetch()}
      onUpload={async (file) => {
        await updateProfileImage(session, file)
        await refresh()
      }}
      onDeleteImage={async () => {
        await deleteProfileImage(session)
        await refresh()
      }}
      onPassword={async (current, next) => {
        await updateProfilePassword(session, current, next)
        await refresh()
      }}
    />
  )
}
