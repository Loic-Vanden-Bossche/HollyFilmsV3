import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type {
  DiscoveryPage,
  MediaRequestItem,
  RequestFilter,
  RequestMediaType,
  RequestsPageData,
  RequestServices,
} from '@hollyfilms/shared/requests'
import { accountHeaders, accountRequest } from './account-api.ts'

export const requestLanguage = (locale: string) =>
  locale === 'zh-Hans' ? 'zh-CN' : locale
export function searchRequestTitles(
  session: JellyfinSession,
  query: string,
  language: string,
  page: number,
  type?: RequestMediaType,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    q: query,
    language,
    page: String(page),
    ...(type ? { type } : {}),
  })
  return accountRequest<DiscoveryPage>('/requests/search?' + params, {
    headers: accountHeaders(session),
    signal,
  })
}
export const getRequestOptions = (
  session: JellyfinSession,
  signal?: AbortSignal,
) =>
  accountRequest<RequestServices>('/requests/options', {
    headers: accountHeaders(session),
    signal,
  })
export function getMediaRequests(
  session: JellyfinSession,
  admin: boolean,
  page: number,
  filter: RequestFilter,
  language: string,
  signal?: AbortSignal,
) {
  return accountRequest<RequestsPageData>(
    (admin ? '/admin/media-requests' : '/requests') +
      '?' +
      new URLSearchParams({ page: String(page), filter, language }),
    { headers: accountHeaders(session), signal },
  )
}
export const createMediaRequest = (
  session: JellyfinSession,
  type: RequestMediaType,
  id: number,
  language: string,
) =>
  accountRequest<MediaRequestItem>('/requests', {
    method: 'POST',
    headers: { ...accountHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, id, language }),
  })
export const decideMediaRequest = (
  session: JellyfinSession,
  id: number,
  action: 'approve' | 'decline' | 'retry',
) =>
  accountRequest<{ ok: boolean }>(`/admin/media-requests/${id}/${action}`, {
    method: 'POST',
    headers: accountHeaders(session),
  })
