import { useSyncExternalStore } from 'react'

let media: MediaQueryList | undefined
const query = () =>
  (media ??= window.matchMedia('(prefers-reduced-motion: reduce)'))
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (listeners.size === 1) query().addEventListener('change', notify)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) query().removeEventListener('change', notify)
  }
}
const snapshot = () => query().matches
export function useSystemReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => true)
}
