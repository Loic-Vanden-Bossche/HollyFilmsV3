import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { MotionConfig, useReducedMotion } from 'motion/react'
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
  const preference = useReducedMotion()
  const profile = usePerformanceProfile()
  return (
    Boolean(preference) || profile.id === 'essential' || profile.id === 'light'
  )
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
  const reduced = useReducedMotion()
  const profile = settings.profile
  useEffect(
    () => (measure ? measurePerformance(controller) : undefined),
    [controller, measure],
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
        reducedMotion={reduced || !profile.ambient ? 'always' : 'user'}
      >
        {children}
      </MotionConfig>
    </Context>
  )
}
