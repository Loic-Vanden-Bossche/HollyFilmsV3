import {
  usePerformanceProfile,
  usePerformanceReducedMotion,
} from './performance/PerformanceProvider.tsx'
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { useAnimate, useMotionValue } from 'motion/react'

const subscribeVisibility = (callback: () => void) => {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}

export function useMotionClock(stopped: boolean) {
  const reduced = usePerformanceReducedMotion()
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  )
  const profile = usePerformanceProfile()
  const clock = useMotionValue(0)
  useEffect(() => {
    if (stopped || reduced || hidden || !profile.ambient) return
    let frame = 0,
      previous = performance.now()
    const tick = (time: number) => {
      clock.set(clock.get() + Math.min(time - previous, 64) / 1000)
      previous = time
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [stopped, reduced, hidden, clock, profile.ambient])
  return clock
}

export function useLandingMotion(paused: boolean, modalOpen: boolean) {
  const reduced = usePerformanceReducedMotion()
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  )
  const stopped = paused || reduced || hidden || modalOpen
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const intro = useRef<ReturnType<typeof animate> | null>(null)
  const clock = useMotionClock(stopped)

  useLayoutEffect(() => {
    intro.current = animate(
      '.title-brand',
      { y: [26, 0], opacity: [0, 1], filter: ['blur(8px)', 'blur(0px)'] },
      { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : 0.15 },
    )
    if (reduced) intro.current.complete()
    return () => intro.current?.stop()
  }, [animate, reduced])
  useEffect(() => {
    if (stopped) intro.current?.complete()
  }, [stopped])

  return { scope, clock, stopped, reduced }
}
