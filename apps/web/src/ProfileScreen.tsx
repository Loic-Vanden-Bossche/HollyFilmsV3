import { useQueryClient } from '@tanstack/react-query'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import {
  deleteProfileImage,
  updateProfileImage,
  updateProfilePassword,
} from './account-api.ts'
import { useProfile, profileKey } from './use-profile.ts'
import { ProfilePage } from './ProfilePage.tsx'

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
