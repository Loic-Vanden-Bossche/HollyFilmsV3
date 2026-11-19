import type { JellyfinSession } from '@hollyfilms/shared/accounts'

const storageKey = 'hollyfilms.jellyfin.session'

function readStoredSession(storage: 'localStorage' | 'sessionStorage') {
  try {
    return window[storage].getItem(storageKey)
  } catch {
    return null
  }
}

function parseSession(stored: string | null): JellyfinSession | null {
  try {
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
    // Ignore invalid browser data.
  }

  return null
}

function forgetSession(storage: 'localStorage' | 'sessionStorage') {
  try {
    window[storage].removeItem(storageKey)
  } catch {
    // The browser may block storage access.
  }
}

export function readSession() {
  return parseSession(
    readStoredSession('localStorage') ?? readStoredSession('sessionStorage'),
  )
}

export function writeSession(session: JellyfinSession | null) {
  const stored = JSON.stringify(session)
  try {
    // A signed-out marker stops older tabs from restoring a legacy session.
    window.localStorage.setItem(storageKey, stored)
    forgetSession('sessionStorage')
  } catch {
    forgetSession('localStorage')
    forgetSession('sessionStorage')
    if (!session) return
    try {
      window.sessionStorage.setItem(storageKey, stored)
    } catch {
      // The session can remain in memory when browser storage is unavailable.
    }
  }
}

export function clearSession(expected: JellyfinSession) {
  const saved = readSession()
  if (
    saved &&
    (saved.accessToken !== expected.accessToken ||
      saved.deviceId !== expected.deviceId)
  ) {
    return saved
  }
  writeSession(null)
  return null
}

export function subscribeToSession(
  onChange: (session: JellyfinSession | null) => void,
) {
  const browser = window
  const onStorage = (event: StorageEvent) => {
    if (
      (event.key !== storageKey && event.key !== null) ||
      event.storageArea !== browser.localStorage
    ) {
      return
    }
    forgetSession('sessionStorage')
    onChange(readSession())
  }

  browser.addEventListener('storage', onStorage)
  const remembered = readStoredSession('localStorage')
  const session = parseSession(
    remembered ?? readStoredSession('sessionStorage'),
  )
  if (remembered !== null) {
    forgetSession('sessionStorage')
  } else if (session) {
    writeSession(session)
  }
  onChange(session)
  return () => browser.removeEventListener('storage', onStorage)
}
