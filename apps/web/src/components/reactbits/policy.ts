import { createContext, useContext, useRef, useSyncExternalStore } from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import { usePerformanceProfile } from '../../performance/PerformanceProvider.tsx'

export const cinemaMotion = {
  ease: [0.22, 1, 0.36, 1] as const,
  interaction: 0.18,
  depth: { tiltX: 6, tiltY: 7, lift: 5, scale: 1.025 },
  reveal: 0.45,
  spring: { stiffness: 190, damping: 25, mass: 0.65 },
  colors: ['#4ade80', '#7dded8', '#3b82f6'],
  atmosphereColors: ['#176b50', '#12516b', '#254c91'],
}
export const Paused = createContext(false)
// Share browser subscriptions across all cards/effects instead of registering
// visibility and media-query listeners for every decorative child.
function sharedSubscription(attach: (notify: () => void) => () => void) {
  const listeners = new Set<() => void>()
  let detach: (() => void) | undefined
  return (notify: () => void) => {
    listeners.add(notify)
    if (listeners.size === 1)
      detach = attach(() => listeners.forEach((listener) => listener()))
    return () => {
      listeners.delete(notify)
      if (!listeners.size) {
        detach?.()
        detach = undefined
      }
    }
  }
}
const subscribe = sharedSubscription((notify) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
})
const visible = () => !document.hidden
let pointerQuery: MediaQueryList | undefined
const fineQuery = () =>
  (pointerQuery ??= window.matchMedia('(hover: hover) and (pointer: fine)'))
const fineSubscribe = sharedSubscription((notify) => {
  const media = fineQuery()
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
})
const finePointer = () => fineQuery().matches
export function useMotionPolicy(localPaused = false) {
  const parentPaused = useContext(Paused)
  const profile = usePerformanceProfile()
  const reduced = Boolean(useReducedMotion()) || profile.id === 'essential'
  const pageVisible = useSyncExternalStore(subscribe, visible, () => false)
  const fine = useSyncExternalStore(fineSubscribe, finePointer, () => false)
  return {
    reduced,
    fine: fine && profile.pointer,
    profile,
    pageVisible,
    running:
      !parentPaused &&
      !localPaused &&
      !reduced &&
      pageVisible &&
      profile.ambient,
  }
}
export function useEffectActivity(paused = false) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '40px' })
  const policy = useMotionPolicy(paused)
  return { ref, ...policy, running: policy.running && inView }
}
