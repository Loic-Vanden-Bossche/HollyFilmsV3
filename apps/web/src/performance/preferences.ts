import type { PerformanceController, ProfileId } from './profiles.ts'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

function readProfile(saved: string | null): ProfileId {
  // The old automatic, balanced, high and ultra settings all use Cinéma.
  return saved === 'light' || saved === 'essential' ? 'light' : 'cinema'
}

export function bindPerformancePreference(
  controller: PerformanceController,
  server: string,
  userId: string | null,
  isAdministrator: boolean,
  getStorage: () => PreferenceStorage = () => window.localStorage,
) {
  if (!userId) {
    controller.startSession('cinema', false)
    return () => {}
  }
  const key = `hollyfilms:performance:v1:${encodeURIComponent(server)}:${encodeURIComponent(userId)}`
  let selection: ProfileId = 'cinema'
  function readSavedSelection() {
    try {
      const storage = getStorage()
      const saved = storage.getItem(key)
      selection = readProfile(saved)
      if (saved !== null && saved !== selection) storage.setItem(key, selection)
    } catch {
      // Keep the in-memory choice when persistent storage is unavailable.
    }
  }
  readSavedSelection()
  controller.startSession(selection, isAdministrator)
  const unsubscribe = controller.subscribeSettings(() => {
    const next = controller.getSettings().selection
    if (selection === next) return
    selection = next
    try {
      getStorage().setItem(key, selection)
    } catch {
      // Changes still apply for the current session.
    }
  })
  // Profile and catalogue are separate documents. Back can restore the old
  // catalogue from the page cache without mounting its React tree again.
  const refresh = () => {
    readSavedSelection()
    controller.select(selection, performance.now())
  }
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) refresh()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) refresh()
  }
  const browser = globalThis.window
  browser?.addEventListener('pageshow', onPageShow)
  browser?.addEventListener('storage', onStorage)
  return () => {
    // Logout and StrictMode cleanup must leave the saved choice intact.
    browser?.removeEventListener('pageshow', onPageShow)
    browser?.removeEventListener('storage', onStorage)
    unsubscribe()
    controller.startSession('cinema', false)
  }
}
