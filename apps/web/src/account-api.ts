import type {
  AuthOptions,
  AuthResult,
  JellyfinSession,
  RegistrationSummary,
} from '@hollyfilms/shared/accounts'
import type { ShowcaseItem } from '@hollyfilms/shared/showcase'

export const getShowcase = (signal: AbortSignal) =>
  request<{ items: ShowcaseItem[] }>('/showcase', { signal })

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init)
  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)
  if (!response.ok || (data === undefined && response.status !== 204)) {
    throw new Error(
      (typeof data?.message === 'string'
        ? data.message.replace(/\bjellyfin\b/gi, 'HollyFilms')
        : undefined) ??
        'HollyFilms est temporairement indisponible. Réessaie dans un instant.',
    )
  }
  return data as T
}

const credentials = (username: string, password: string): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
})

const adminHeaders = (session: JellyfinSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
  'X-HollyFilms-Device': session.deviceId,
})

export const authOptions = (signal: AbortSignal) =>
  request<AuthOptions>('/auth/options', { signal })
export const registerAccount = (username: string, password: string) =>
  request<AuthResult>('/auth/register', credentials(username, password))
export const signInPassword = (username: string, password: string) =>
  request<AuthResult>('/auth/password', credentials(username, password))
export const listRegistrations = (
  session: JellyfinSession,
  signal: AbortSignal,
) =>
  request<RegistrationSummary[]>('/admin/registrations', {
    headers: adminHeaders(session),
    signal,
  })
export const decideRegistration = (
  session: JellyfinSession,
  id: string,
  action: 'approve' | 'reject',
) =>
  request<void>(`/admin/registrations/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    headers: adminHeaders(session),
  })

export function statusNotice(
  status: Exclude<AuthResult['status'], 'authenticated'>,
) {
  if (status === 'rejected') return 'Ta demande a été refusée.'
  return 'Ta demande est en attente d’approbation.'
}

export type GoogleReturn = { result: AuthResult } | { error: string }

export function completeGoogleRedirect(): Promise<GoogleReturn> | undefined {
  const url = new URL(window.location.href)
  const google = url.searchParams.get('google')
  if (google !== 'complete' && google !== 'error') return
  url.searchParams.delete('google')
  window.history.replaceState(null, '', url)

  if (google === 'error')
    return Promise.resolve({
      error: 'La connexion Google a échoué. Réessaie.',
    })
  return request<AuthResult>('/auth/google/complete', { method: 'POST' }).then(
    (result) => ({ result }),
    (error: Error) => ({ error: error.message }),
  )
}
