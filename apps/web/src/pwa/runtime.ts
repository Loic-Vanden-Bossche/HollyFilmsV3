import { useSyncExternalStore } from 'react'

type InstallResult = 'accepted' | 'dismissed' | 'unavailable'
type InstallPrompt = Event & {
  prompt(): Promise<unknown>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
type Shell = {
  installed: boolean
  canInstall: boolean
  updateAvailable: boolean
  workerState: 'unsupported' | 'starting' | 'ready' | 'failed'
}

const supported = window.isSecureContext && 'serviceWorker' in navigator
const standalone = window.matchMedia('(display-mode: standalone)')
const isInstalled = () =>
  standalone.matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
let state: Shell = {
  installed: isInstalled(),
  canInstall: false,
  updateAvailable: false,
  workerState: supported ? 'starting' : 'unsupported',
}
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const getSnapshot = () => state
function publish(patch: Partial<Shell>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

let installPrompt: InstallPrompt | undefined
let activeRegistration: ServiceWorkerRegistration | undefined
let registrationPromise: Promise<ServiceWorkerRegistration> | undefined
let initialized = false
let viewer: string | null = null
let reloadRequested = false

export function setPwaViewer(userId: string | null) {
  viewer = userId?.replaceAll('-', '').toLowerCase() || null
}

function watchUpdate(registration: ServiceWorkerRegistration) {
  function check() {
    publish({
      updateAvailable: Boolean(
        registration.waiting && navigator.serviceWorker.controller,
      ),
    })
  }
  const watchInstalling = () => {
    const installing = registration.installing
    if (!installing) return
    const onChange = () => {
      check()
      if (installing.state === 'activated' || installing.state === 'redundant')
        installing.removeEventListener('statechange', onChange)
    }
    installing.addEventListener('statechange', onChange)
  }
  watchInstalling()
  registration.addEventListener('updatefound', watchInstalling)
  check()
}

async function register() {
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  })
  if (registration !== activeRegistration) {
    activeRegistration = registration
    watchUpdate(registration)
  }
  if (!registration.active) {
    const firstWorker = registration.installing ?? registration.waiting
    if (!firstWorker) throw new Error('Service worker unavailable')
    await new Promise<void>((resolve, reject) => {
      const changed = () => {
        if (
          firstWorker.state !== 'activated' &&
          firstWorker.state !== 'redundant'
        )
          return
        firstWorker.removeEventListener('statechange', changed)
        if (firstWorker.state === 'activated') resolve()
        else reject(new Error('Service worker installation failed'))
      }
      firstWorker.addEventListener('statechange', changed)
      changed()
    })
  }
  publish({ workerState: 'ready' })
  return registration
}

export function getPwaRegistration(): Promise<ServiceWorkerRegistration> {
  if (!supported)
    return Promise.reject(new Error('Service workers require a secure context'))
  if (!registrationPromise) {
    publish({ workerState: 'starting' })
    registrationPromise = register().catch((error: unknown) => {
      registrationPromise = undefined
      publish({ workerState: 'failed' })
      throw error
    })
  }
  return registrationPromise
}

export function initializePwa() {
  if (initialized) return
  initialized = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt = event as InstallPrompt
    publish({ canInstall: !state.installed })
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = undefined
    publish({ installed: true, canInstall: false })
  })
  standalone.addEventListener('change', () =>
    publish({
      installed: isInstalled(),
      canInstall: !isInstalled() && Boolean(installPrompt),
    }),
  )
  if (!supported) return
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'HOLLYFILMS_MATCH_VIEWER') return
    event.ports[0]?.postMessage(
      viewer !== null &&
        viewer === event.data.userId &&
        !new URL(location.href).searchParams.has('play'),
    )
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    publish({ updateAvailable: false })
    if (reloadRequested) {
      reloadRequested = false
      window.location.reload()
    }
  })
  const start = () => {
    void getPwaRegistration().catch(() => {})
  }
  start()
  window.addEventListener('online', () => {
    if (state.workerState === 'failed') start()
  })
  let lastCheck = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (
      document.hidden ||
      !navigator.onLine ||
      Date.now() - lastCheck < 60 * 60_000
    )
      return
    lastCheck = Date.now()
    if (activeRegistration && state.workerState === 'ready')
      void activeRegistration.update().catch(() => {})
    else start()
  })
}

async function install(): Promise<InstallResult> {
  const event = installPrompt
  if (!event || state.installed) return 'unavailable'
  installPrompt = undefined
  publish({ canInstall: false })
  try {
    await event.prompt()
    return (await event.userChoice).outcome
  } catch {
    return 'unavailable'
  }
}

function applyUpdate() {
  const waiting = activeRegistration?.waiting
  if (!waiting) {
    publish({ updateAvailable: false })
    return
  }
  reloadRequested = true
  waiting.postMessage({ type: 'HOLLYFILMS_ACTIVATE_UPDATE' })
}

export function usePwaShell() {
  const shell = useSyncExternalStore(subscribe, getSnapshot)
  return { ...shell, install, applyUpdate }
}
