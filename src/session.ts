import type { JellyfinSession } from '../shared/accounts.ts'

const storageKey = 'hollyfilms.jellyfin.session'

export function readSession(): JellyfinSession | null {
  try {
    const stored = sessionStorage.getItem(storageKey)
    if (!stored) return null

    const session = JSON.parse(stored) as Partial<JellyfinSession> | null
    if (
      typeof session?.accessToken === 'string' &&
      session.accessToken &&
      typeof session.deviceId === 'string' &&
      session.deviceId
    ) {
      return { accessToken: session.accessToken, deviceId: session.deviceId }
    }
  } catch {
    // Le navigateur peut bloquer l’accès au stockage de l’onglet.
  }

  return null
}

export function writeSession(session: JellyfinSession | null) {
  try {
    if (session) {
      sessionStorage.setItem(storageKey, JSON.stringify(session))
    } else {
      sessionStorage.removeItem(storageKey)
    }
  } catch {
    // La session peut rester en mémoire si le stockage est indisponible.
  }
}
