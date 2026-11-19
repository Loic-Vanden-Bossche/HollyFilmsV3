import { useSyncExternalStore } from 'react'

// The banner and hovered card can both be visible in the same viewport.
const listeners = new Set<() => void>()
let previews = 0
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function useCardVideoActive() {
  return useSyncExternalStore(
    subscribe,
    () => previews > 0,
    () => false,
  )
}
export function holdBannerVideo() {
  previews++
  listeners.forEach((listener) => listener())
  return () => {
    previews--
    listeners.forEach((listener) => listener())
  }
}
