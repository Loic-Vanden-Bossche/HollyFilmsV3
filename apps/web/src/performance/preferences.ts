import {
  performanceProfiles,
  type PerformanceController,
  type PerformanceSelection,
} from './profiles.ts'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Bind only after Jellyfin has verified the current administrator's identity. */
export function bindPerformancePreference(
  controller: PerformanceController,
  server: string,
  administratorId: string | null,
  getStorage: () => PreferenceStorage = () => window.localStorage,
  now: () => number = () => performance.now(),
) {
  controller.setAdmin(Boolean(administratorId))
  if (!administratorId) return () => {}

  const key = `hollyfilms:performance:v1:${encodeURIComponent(server)}:${encodeURIComponent(administratorId)}`
  let selection: PerformanceSelection = 'auto'
  try {
    const saved = getStorage().getItem(key)
    if (
      saved === 'auto' ||
      performanceProfiles.some((entry) => entry.id === saved)
    )
      selection = saved as PerformanceSelection
  } catch {
    // Private browsing or blocked storage must not prevent using the app.
  }
  controller.select(selection, now())

  const unsubscribe = controller.subscribeSettings(() => {
    const settings = controller.getSettings()
    if (!settings.admin || settings.selection === selection) return
    selection = settings.selection
    try {
      getStorage().setItem(key, selection)
    } catch {
      // The runtime selection still works when persistence is unavailable.
    }
  })
  return () => {
    // Unsubscribe first: logout/StrictMode cleanup must not overwrite the choice.
    unsubscribe()
    controller.setAdmin(false)
  }
}
