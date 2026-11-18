import { useCallback, useSyncExternalStore } from 'react'

export const loadingRevealDelay = 400
const thresholds = [loadingRevealDelay, 4000, 8000] as const

// A route handoff carries the original timestamp. Subscribe only to the
// remaining thresholds, so displaying a wait needs no animation clock.
export function useLoadingStage(since?: number) {
  const snapshot = useCallback(
    () =>
      since === undefined
        ? 0
        : thresholds.filter((delay) => Date.now() >= since + delay).length,
    [since],
  )
  const subscribe = useCallback(
    (notify: () => void) => {
      if (since === undefined) return () => {}
      const elapsed = Date.now() - since
      const timers = thresholds
        .filter((delay) => delay > elapsed)
        .map((delay) => window.setTimeout(notify, delay - elapsed))
      document.addEventListener('visibilitychange', notify)
      return () => {
        timers.forEach((timer) => window.clearTimeout(timer))
        document.removeEventListener('visibilitychange', notify)
      }
    },
    [since],
  )
  return useSyncExternalStore(subscribe, snapshot, () => 0)
}
