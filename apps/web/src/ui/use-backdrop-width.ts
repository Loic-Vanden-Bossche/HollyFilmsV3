import { useSyncExternalStore } from 'react'

function subscribeViewport(notify: () => void) {
  window.addEventListener('resize', notify)
  return () => window.removeEventListener('resize', notify)
}

function backdropResolution() {
  // Cover the zoomed hero at native display density, without decoding a 4K
  // image on every small screen. Buckets keep resized images in the same cache.
  return Math.min(
    3840,
    Math.max(
      1280,
      Math.ceil((window.innerWidth * window.devicePixelRatio * 1.08) / 640) *
        640,
    ),
  )
}

export function useBackdropWidth() {
  return useSyncExternalStore(subscribeViewport, backdropResolution, () => 1920)
}
