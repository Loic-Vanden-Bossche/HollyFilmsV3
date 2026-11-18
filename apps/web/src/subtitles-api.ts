import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type {
  SubtitleCandidate,
  SubtitleLibrary,
  SubtitleRequest,
  SubtitleRequestPage,
  SubtitleRequestStatus,
} from '@hollyfilms/shared/subtitles'
import { accountHeaders, accountRequest } from './account-api.ts'
const json = (session: JellyfinSession, body: unknown) => ({
  method: 'POST',
  headers: { ...accountHeaders(session), 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
export const getSubtitleLibrary = (
  session: JellyfinSession,
  itemId: string,
  signal?: AbortSignal,
) =>
  accountRequest<SubtitleLibrary>(
    `/media/${encodeURIComponent(itemId)}/subtitles`,
    { headers: accountHeaders(session), signal },
  )
export const searchSubtitles = (
  session: JellyfinSession,
  itemId: string,
  sourceId: string,
  language: string,
  perfect: boolean,
) =>
  accountRequest<{ items: SubtitleCandidate[] }>(
    `/admin/media/${encodeURIComponent(itemId)}/subtitles/search?` +
      new URLSearchParams({ sourceId, language, perfect: String(perfect) }),
    { headers: accountHeaders(session) },
  )
export const requestSubtitles = (
  session: JellyfinSession,
  itemId: string,
  sourceId: string,
  language: string,
) =>
  accountRequest<SubtitleRequest>(
    `/media/${encodeURIComponent(itemId)}/subtitle-requests`,
    json(session, { sourceId, language }),
  )
export const downloadSubtitles = (
  session: JellyfinSession,
  itemId: string,
  sourceId: string,
  language: string,
  remoteId: string,
  requestId?: string,
) =>
  accountRequest<SubtitleRequest>(
    `/admin/media/${encodeURIComponent(itemId)}/subtitles/download`,
    json(session, { sourceId, language, remoteId, requestId }),
  )
export const getSubtitleRequests = (
  session: JellyfinSession,
  administrator: boolean,
  page: number,
  status?: SubtitleRequestStatus,
  signal?: AbortSignal,
) =>
  accountRequest<SubtitleRequestPage>(
    (administrator ? '/admin/subtitle-requests' : '/subtitle-requests') +
      '?' +
      new URLSearchParams({
        page: String(page),
        ...(status ? { status } : {}),
      }),
    { headers: accountHeaders(session), signal },
  )
export const rejectSubtitleRequest = (session: JellyfinSession, id: string) =>
  accountRequest<{ ok: boolean }>(
    `/admin/subtitle-requests/${encodeURIComponent(id)}/reject`,
    { method: 'POST', headers: accountHeaders(session) },
  )
