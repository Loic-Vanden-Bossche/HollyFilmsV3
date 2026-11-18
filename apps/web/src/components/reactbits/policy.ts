import { createContext, useContext, useRef, useSyncExternalStore } from 'react'
import { useInView } from 'motion/react'
import { usePerformanceProfile } from '../../performance/PerformanceProvider.tsx'
import { useSystemReducedMotion } from '../../motion/use-system-reduced-motion.ts'
import { duration, ease, scale, spring } from '../../motion/tokens.ts'

export const cinemaMotion = {
  ease: ease.out,
  interaction: duration.micro,
  depth: { tiltX: 4, tiltY: 5, lift: 4, scale: scale.card },
  reveal: duration.scene,
  spring: spring.card,
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
  const reduced = useSystemReducedMotion() || !profile.ambient
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
