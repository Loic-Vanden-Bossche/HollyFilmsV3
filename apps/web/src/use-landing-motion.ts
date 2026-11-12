import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import {
  useAnimate,
  useAnimationFrame,
  useMotionValue,
  useTransform,
} from 'motion/react'

function subscribeMotion(callback: () => void) {
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const subscribeVisibility = (callback: () => void) => {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}

export function useMotionClock(stopped: boolean) {
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  )
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  )
  const clock = useMotionValue(0)
  useAnimationFrame((_, delta) => {
    if (!stopped && !reduced && !hidden)
      clock.set(clock.get() + Math.min(delta, 64) / 1000)
  })
  return clock
}

export function useLandingMotion(paused: boolean, modalOpen: boolean) {
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  )
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  )
  const stopped = paused || reduced || hidden || modalOpen
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const intro = useRef<ReturnType<typeof animate> | null>(null)
  const clock = useMotionClock(stopped)
  const featureY = useTransform(clock, (time) => {
    const step = (time % 24) / 6
    const progress = Math.max(0, ((step % 1) - 0.8) / 0.2)
    const ease = progress * progress * (3 - 2 * progress)
    return `${-20 * (Math.floor(step) + ease)}%`
  })

  useLayoutEffect(() => {
    intro.current = animate(
      '.title-line',
      { y: [26, 0], opacity: [0, 1], filter: ['blur(8px)', 'blur(0px)'] },
      { duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : 0.15 },
    )
    if (reduced) intro.current.complete()
    return () => intro.current?.stop()
  }, [animate, reduced])
  useEffect(() => {
    if (stopped) intro.current?.complete()
  }, [stopped])

  return { scope, clock, featureY, stopped, reduced }
}
