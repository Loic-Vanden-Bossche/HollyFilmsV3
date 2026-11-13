import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { getProfile, getProfileImage } from './account-api.ts'

export const profileKey = (session: JellyfinSession) => [
  'profile',
  session.deviceId,
]

export function useProfile(session: JellyfinSession) {
  const profile = useQuery({
    queryKey: profileKey(session),
    queryFn: ({ signal }) => getProfile(session, signal),
    staleTime: 60_000,
    retry: false,
  })
  const image = useQuery({
    queryKey: [...profileKey(session), 'image', profile.data?.imageTag],
    queryFn: ({ signal }) => getProfileImage(session, signal),
    enabled: Boolean(profile.data?.imageTag),
    staleTime: Infinity,
    retry: false,
  })
  const [localImage, setLocalImage] = useState<{ blob: Blob; url: string }>()
  useEffect(() => {
    if (!image.data) return
    const url = URL.createObjectURL(image.data)
    // oxlint-disable-next-line react/set-state-in-effect -- Publish this effect-owned browser resource; cleanup revokes it.
    setLocalImage({ blob: image.data, url })
    return () => URL.revokeObjectURL(url)
  }, [image.data])
  const avatarUrl = profile.data?.imageTag
    ? localImage?.blob === image.data
      ? localImage?.url
      : undefined
    : (profile.data?.google?.picture ?? undefined)
  return { ...profile, avatarUrl, imageError: image.isError }
}
