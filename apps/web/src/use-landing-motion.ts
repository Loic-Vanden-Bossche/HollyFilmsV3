import { usePerformanceReducedMotion } from './performance/PerformanceProvider.tsx'
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { useAnimate, useMotionValue } from 'motion/react'
import { duration, ease, distance, staggerDelay } from './motion/tokens.ts'

const subscribeVisibility = (callback: () => void) => {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}

function useMotionClock(stopped: boolean) {
  const clock = useMotionValue(0)
  useEffect(() => {
    if (stopped) return
    let frame = 0,
      previous = performance.now()
    const tick = (time: number) => {
      clock.set(clock.get() + Math.min(time - previous, 64) / 1000)
      previous = time
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [stopped, clock])
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
    const reveal = animate([
      [
        '.eyebrow-line',
        { scaleX: [0, 1] },
        { at: 0, duration: duration.scene, ease: ease.out },
      ],
      [
        '.title-brand',
        { y: [distance.scene, 0], opacity: [0.35, 1] },
        { at: 0, duration: duration.feature, ease: ease.out },
      ],
      [
        '.feature-reel',
        { y: [distance.panel, 0], opacity: [0.65, 1] },
        { at: staggerDelay(3), duration: duration.scene, ease: ease.out },
      ],
      [
        '.hero-actions',
        { y: [distance.control, 0], opacity: [0.85, 1] },
        { at: staggerDelay(4), duration: duration.panel, ease: ease.out },
      ],
    ])
    intro.current = reveal
    return () => reveal.stop()
  }, [animate])
  useLayoutEffect(() => {
    if (stopped) intro.current?.complete()
  }, [stopped])

  return { scope, clock, stopped, reduced }
}
