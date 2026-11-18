import { apiMessage } from './i18n/api-messages.ts'
import type {
  AdminUser,
  AuthOptions,
  AuthResult,
  JellyfinSession,
  RegistrationSummary,
} from '@hollyfilms/shared/accounts'
import type { ShowcaseItem } from '@hollyfilms/shared/showcase'
import type { AccountProfile } from '@hollyfilms/shared/profile'

export const getProfile = (session: JellyfinSession, signal?: AbortSignal) =>
  request<AccountProfile>('/profile', {
    headers: adminHeaders(session),
    signal,
  })
export async function getProfileImage(
  session: JellyfinSession,
  signal?: AbortSignal,
) {
  const response = await fetch('/api/profile/image', {
    headers: adminHeaders(session),
    signal,
  })
  if (!response.ok) throw new Error('Impossible de charger la photo.')
  return response.blob()
}
export async function updateProfileImage(session: JellyfinSession, file: File) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 2_097_152
  )
    throw new Error('Choisis une image JPG, PNG ou WebP de moins de 2 Mo.')
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Impossible de lire cette image.'))
    reader.readAsDataURL(file)
  })
  return request<void>('/profile/image', {
    method: 'PUT',
    headers: { ...adminHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, type: file.type }),
  })
}
export const deleteProfileImage = (session: JellyfinSession) =>
  request<void>('/profile/image', {
    method: 'DELETE',
    headers: adminHeaders(session),
  })
export const updateProfilePassword = (
  session: JellyfinSession,
  currentPassword: string,
  newPassword: string,
) =>
  request<void>('/profile/password', {
    method: 'PUT',
    headers: { ...adminHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  })

export const getShowcase = (signal: AbortSignal) =>
  request<{ items: ShowcaseItem[] }>('/showcase', { signal })

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init)
  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)
  if (!response.ok || (data === undefined && response.status !== 204)) {
    const message =
      apiMessage(data?.code) ??
      'HollyFilms est temporairement indisponible. Réessaie dans un instant.'
    throw new Error(message)
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

export { request as accountRequest, adminHeaders as accountHeaders }

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

export const listAdminUsers = (
  session: JellyfinSession,
  signal?: AbortSignal,
) =>
  request<AdminUser[]>('/admin/users', {
    headers: adminHeaders(session),
    signal,
  })

export const setAdminUserAccess = (
  session: JellyfinSession,
  id: string,
  disabled: boolean,
) =>
  request<void>(`/admin/users/${encodeURIComponent(id)}/access`, {
    method: 'PUT',
    headers: { ...adminHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ disabled }),
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
