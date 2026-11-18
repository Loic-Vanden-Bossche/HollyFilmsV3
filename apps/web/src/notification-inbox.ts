import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getInbox } from './notification-api.ts'

export function useNotificationInbox(
  session: JellyfinSession,
  userId: string,
  enabled = true,
) {
  const client = useQueryClient()
  const key = ['notifications', session.deviceId, userId] as const
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ signal, pageParam }) => getInbox(session, signal, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    refetchInterval: 60_000,
  })
  useEffect(() => {
    const worker = navigator.serviceWorker
    if (!enabled || !worker) return
    const update = ({ data }: MessageEvent) => {
      if (
        data?.type === 'HOLLYFILMS_NOTIFICATION' &&
        data.userId === userId.replaceAll('-', '').toLowerCase()
      ) {
        void client.invalidateQueries({
          queryKey: ['notifications', session.deviceId, userId],
        })
      }
    }
    worker.addEventListener('message', update)
    return () => worker.removeEventListener('message', update)
  }, [client, enabled, session.deviceId, userId])
  return query
}
