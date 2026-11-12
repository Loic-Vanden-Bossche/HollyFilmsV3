import { Jellyfin } from '@jellyfin/sdk/lib/jellyfin.js'
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api.js'
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api.js'
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api.js'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js'
import type { JellyfinSession } from './accounts.ts'

const timeout = 5_000

export function createJellyfinApi(
  baseUrl: string,
  deviceId = 'hollyfilms-public-info',
  accessToken?: string,
) {
  return new Jellyfin({
    clientInfo: { name: 'HollyFilms', version: '0.0.0' },
    deviceInfo: { name: 'HollyFilms', id: deviceId },
  }).createApi(baseUrl, accessToken)
}

export async function getJellyfinServerInfo(
  baseUrl: string,
  signal?: AbortSignal,
) {
  const api = createJellyfinApi(baseUrl)
  const { data } = await getSystemApi(api).getPublicSystemInfo({
    signal,
    timeout,
  })

  if (!data || typeof data.Version !== 'string' || !data.Version) {
    throw new Error('Réponse Jellyfin invalide')
  }

  return data
}

export async function authenticateJellyfin(
  baseUrl: string,
  username: string,
  password: string,
  expectedUserId?: string,
): Promise<JellyfinSession> {
  const deviceId = crypto.getRandomValues(new Uint32Array(4)).join('-')
  const api = createJellyfinApi(baseUrl, deviceId)
  const { data } = await getAuthenticationApi(api).authenticateUserByName(
    { authenticateUserByName: { Username: username, Pw: password } },
    { timeout, maxRedirects: 0 },
  )

  if (typeof data?.AccessToken !== 'string' || !data.AccessToken) {
    throw new Error('Jeton de connexion Jellyfin manquant')
  }

  if (expectedUserId && data.User?.Id !== expectedUserId) {
    await getSessionApi(api).reportSessionEnded({ timeout, maxRedirects: 0 })
    throw new Error('Le compte Jellyfin ne correspond pas à la demande')
  }

  return { accessToken: data.AccessToken, deviceId }
}

export async function getJellyfinUser(
  baseUrl: string,
  session: JellyfinSession,
  signal?: AbortSignal,
) {
  const api = createJellyfinApi(baseUrl, session.deviceId, session.accessToken)
  const { data } = await getUserApi(api).getCurrentUser({ signal, timeout })

  if (!data?.Id || typeof data.Name !== 'string') {
    throw new Error('Compte Jellyfin introuvable dans la réponse')
  }

  return {
    id: data.Id,
    name: data.Name,
    isAdministrator: data.Policy?.IsAdministrator === true,
  }
}

export async function endJellyfinSession(
  baseUrl: string,
  session: JellyfinSession,
) {
  const api = createJellyfinApi(baseUrl, session.deviceId, session.accessToken)
  await getSessionApi(api).reportSessionEnded({ timeout })
}

export function isJellyfinAccessDenied(error: unknown) {
  return (
    error instanceof Error &&
    'status' in error &&
    (error.status === 401 || error.status === 403)
  )
}
