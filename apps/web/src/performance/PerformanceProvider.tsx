import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { MotionConfig } from 'motion/react'
import { useSystemReducedMotion } from '../motion/use-system-reduced-motion.ts'
import { duration, ease } from '../motion/tokens.ts'
import { PerformanceController, performanceController } from './profiles.ts'
import { measurePerformance } from './measure.ts'
import './performance.css'

const Context = createContext(performanceController)
// oxlint-disable-next-line react/only-export-components -- Hooks share the provider's context.
export function usePerformanceController() {
  return useContext(Context)
}
// oxlint-disable-next-line react/only-export-components -- Hooks share the provider's context.
export function usePerformanceProfile() {
  const controller = usePerformanceController()
  return useSyncExternalStore(
    controller.subscribeSettings,
    controller.getSettings,
    controller.getSettings,
  ).profile
}
// oxlint-disable-next-line react/only-export-components -- Hooks share the provider's context.
export function usePerformanceReducedMotion() {
  const preference = useSystemReducedMotion()
  const profile = usePerformanceProfile()
  return Boolean(preference) || !profile.ambient
}
export function PerformanceProvider({
  children,
  controller = performanceController,
  measure = true,
}: {
  children: ReactNode
  controller?: PerformanceController
  measure?: boolean
}) {
  const settings = useSyncExternalStore(
    controller.subscribeSettings,
    controller.getSettings,
    controller.getSettings,
  )
  const reduced = useSystemReducedMotion()
  const profile = settings.profile
  useEffect(
    () =>
      measure && settings.admin ? measurePerformance(controller) : undefined,
    [controller, measure, settings.admin],
  )
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.performance = profile.id
    root.style.setProperty('--performance-blur', `${profile.blur}px`)
    return () => {
      delete root.dataset.performance
      root.style.removeProperty('--performance-blur')
    }
  }, [profile])
  return (
    <Context value={controller}>
      <MotionConfig
        reducedMotion={reduced || !profile.ambient ? 'always' : 'never'}
        transition={{
          duration:
            reduced || !profile.ambient ? duration.press : duration.micro,
          ease: ease.out,
        }}
      >
        {children}
      </MotionConfig>
    </Context>
  )
}
