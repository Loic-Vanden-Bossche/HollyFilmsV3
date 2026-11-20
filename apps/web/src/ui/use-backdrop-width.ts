import { useSyncExternalStore } from 'react'
import {
  artworkPixelWidth,
  subscribeArtworkDensity,
} from './artwork-resources.ts'

function subscribeViewport(notify: () => void) {
  window.addEventListener('resize', notify)
  const stopDensity = subscribeArtworkDensity(notify)
  return () => {
    window.removeEventListener('resize', notify)
    stopDensity()
  }
}

function backdropResolution() {
  // Cover the zoomed hero at native display density, without decoding a 4K
  // image on every small screen. Buckets keep resized images in the same cache.
  return artworkPixelWidth(window.innerWidth * 1.08)
}

export function useBackdropWidth() {
  return useSyncExternalStore(subscribeViewport, backdropResolution, () => 1920)
}
