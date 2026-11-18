import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type { NotificationInbox } from '@hollyfilms/shared/notifications'
import { accountHeaders, accountRequest } from './account-api.ts'

export function getInbox(
  session: JellyfinSession,
  signal: AbortSignal,
  before?: string | null,
) {
  const path = before
    ? '/notifications?before=' + encodeURIComponent(before)
    : '/notifications'
  return accountRequest<NotificationInbox>(path, {
    headers: accountHeaders(session),
    signal,
  })
}

export function markNotificationsRead(session: JellyfinSession, id?: string) {
  return accountRequest<void>('/notifications/read', {
    method: 'POST',
    headers: { ...accountHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
    keepalive: true,
  })
}
