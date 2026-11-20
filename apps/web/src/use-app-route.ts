import { useEffect, useState } from 'react'
import { appRouteUrl, readAppRoute, type AppRoute } from './app-route.ts'

const routeEvent = 'hollyfilms:navigate'
const authReturnKey = 'hollyfilms-auth-return'
const deferredHistory = new WeakSet<Event>()

/** Let the browser capture the outgoing dialog before route subscribers render Back. */
export function deferHistoryRender(
  event: PopStateEvent,
  transition: (render: () => void) => void,
) {
  deferredHistory.add(event)
  transition(() => window.dispatchEvent(new Event(routeEvent)))
}

export function rememberAppReturn() {
  try {
    if (
      /^\/(app(?:\/(favorites|movies|series|collections))?|profile|notifications|requests|admin\/requests)\/?$/.test(
        window.location.pathname,
      )
    )
      sessionStorage.setItem(
        authReturnKey,
        location.pathname + location.search + location.hash,
      )
    else sessionStorage.removeItem(authReturnKey)
  } catch {
    /* The URL still survives password authentication without storage. */
  }
}

export function takeAppReturn() {
  try {
    const saved = sessionStorage.getItem(authReturnKey)
    sessionStorage.removeItem(authReturnKey)
    const url = new URL(saved ?? '/app', window.location.origin)
    if (
      url.origin === location.origin &&
      /^\/(app(?:\/(favorites|movies|series|collections))?|profile|notifications|requests|admin\/requests)\/?$/.test(
        url.pathname,
      )
    )
      return url.pathname + url.search + url.hash
  } catch {
    /* Fall back to the signed-in home when storage is unavailable. */
  }
  return '/app'
}

/** Progress replaces the address silently; navigation alone updates the screen. */
export function navigateApp(
  patch: Partial<AppRoute>,
  mode: 'push' | 'replace' | 'progress' = 'push',
) {
  const next = appRouteUrl(window.location.href, patch)
  const current = location.pathname + location.search + location.hash
  if (next === current) return
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](
    window.history.state,
    '',
    next,
  )
  if (mode !== 'progress') window.dispatchEvent(new Event(routeEvent))
}

function readLocation(
  previous?: AppRoute & { openedAt?: number },
  initialOpenedAt?: number,
) {
  const route = readAppRoute(window.location.search, window.location.pathname)
  const openedAt = route.play
    ? route.play === previous?.play
      ? previous.openedAt
      : (initialOpenedAt ?? Date.now())
    : undefined
  return { ...route, openedAt }
}

export function useAppRoute(initialOpenedAt?: number) {
  const [route, setRoute] = useState(() =>
    readLocation(undefined, initialOpenedAt),
  )
  useEffect(() => {
    const update = (event: Event) => {
      if (!deferredHistory.has(event)) setRoute(readLocation)
    }
    window.addEventListener('popstate', update)
    window.addEventListener(routeEvent, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(routeEvent, update)
    }
  }, [])
  return {
    ...route,
    restartOpening() {
      setRoute((current) => ({ ...current, openedAt: Date.now() }))
    },
  }
}
