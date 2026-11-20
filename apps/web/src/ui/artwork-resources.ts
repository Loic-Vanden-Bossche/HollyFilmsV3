import type { QueryClient } from '@tanstack/react-query'
import type { LibraryImage } from '@hollyfilms/shared/library'

const widthsByClient = new WeakMap<QueryClient, Set<number>>()
const decoded = new WeakSet<Blob>()
const urls = new WeakMap<Blob, { url: string; owners: number }>()

export function imageQueryKey(
  deviceId: string,
  image: LibraryImage,
  width: number,
) {
  return [
    'library-image',
    deviceId,
    image.itemId,
    image.type,
    image.tag,
    width,
    image.index,
  ] as const
}

// Look up just the few requested sizes, irrespective of how many titles are cached.
// Keep the blobs in TanStack Query so its normal expiry and account scoping apply.
export function cachedArtwork(
  client: QueryClient,
  key: ReturnType<typeof imageQueryKey>,
  usage: 'final' | 'placeholder',
) {
  const [kind, device, item, type, tag, width, index] = key
  let widths = widthsByClient.get(client)
  if (!widths) {
    widths = new Set<number>()
    for (const { queryKey } of client.getQueryCache().getAll()) {
      if (queryKey[0] === kind && typeof queryKey[5] === 'number')
        widths.add(queryKey[5])
    }
    widthsByClient.set(client, widths)
  }
  widths.add(width)
  let larger: { width: number; blob: Blob } | undefined
  let smaller: { width: number; blob: Blob } | undefined
  for (const candidate of widths) {
    if (candidate === width || (usage === 'final' && candidate < width))
      continue
    const blob = client.getQueryData<Blob>([
      kind,
      device,
      item,
      type,
      tag,
      candidate,
      index,
    ])
    if (!(blob instanceof Blob) || (usage === 'final' && !decoded.has(blob)))
      continue
    if (candidate > width && (!larger || candidate < larger.width))
      larger = { width: candidate, blob }
    if (candidate < width && (!smaller || candidate > smaller.width))
      smaller = { width: candidate, blob }
  }
  return larger?.blob ?? smaller?.blob
}

export function markArtworkDecoded(blob: Blob) {
  decoded.add(blob)
}

// Mounts showing the same immutable blob share the browser's image resource.
// A frame keeps its own lease while a different resolution is downloading.
export function acquireArtworkUrl(blob: Blob) {
  let entry = urls.get(blob)
  if (!entry) {
    entry = { url: URL.createObjectURL(blob), owners: 0 }
    urls.set(blob, entry)
  }
  entry.owners++
  return {
    url: entry.url,
    release() {
      if (--entry.owners === 0) {
        urls.delete(blob)
        URL.revokeObjectURL(entry.url)
      }
    },
  }
}

const waiting = new Map<Element, (width: number) => void>()
let observer: IntersectionObserver | undefined

export function whenArtworkIsNear(
  element: Element,
  load: (width: number) => void,
) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting)
          waiting.get(entry.target)?.(entry.boundingClientRect.width)
      }
    },
    { rootMargin: '200px' },
  )
  waiting.set(element, (width) => {
    stop()
    load(width)
  })
  observer.observe(element)
  function stop() {
    if (!waiting.delete(element)) return
    observer?.unobserve(element)
    if (!waiting.size) {
      observer?.disconnect()
      observer = undefined
    }
  }
  return stop
}

const coverWidths = [
  160, 240, 320, 400, 480, 640, 800, 960, 1280, 1600, 1920, 2560, 3200, 3840,
]

export function artworkPixelWidth(cssWidth: number) {
  const pixels = Math.ceil(cssWidth * (window.devicePixelRatio || 1))
  return (
    coverWidths.find((width) => width >= pixels) ??
    coverWidths[coverWidths.length - 1]
  )
}

const densityListeners = new Set<() => void>()
let densityQuery: MediaQueryList | undefined

function watchDensity() {
  densityQuery = window.matchMedia(
    `(resolution: ${window.devicePixelRatio || 1}dppx)`,
  )
  densityQuery.addEventListener('change', onDensityChange, { once: true })
}

function onDensityChange() {
  watchDensity()
  for (const notify of densityListeners) notify()
}

export function subscribeArtworkDensity(notify: () => void) {
  densityListeners.add(notify)
  if (!densityQuery) watchDensity()
  return () => {
    densityListeners.delete(notify)
    if (!densityListeners.size) {
      densityQuery?.removeEventListener('change', onDensityChange)
      densityQuery = undefined
    }
  }
}

type ArtworkSize = {
  css: number
  pixels: number
  notify: (pixels: number) => void
}
const resizeListeners = new Map<Element, ArtworkSize>()
let resizeObserver: ResizeObserver | undefined
let stopDensity: (() => void) | undefined

function updateArtworkSize(size: ArtworkSize) {
  if (size.css <= 0) return
  const pixels = artworkPixelWidth(size.css)
  if (pixels !== size.pixels) {
    size.pixels = pixels
    size.notify(pixels)
  }
}

export function observeArtworkSize(
  element: Element,
  notify: (pixels: number) => void,
) {
  resizeObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const size = resizeListeners.get(entry.target)
      if (size) {
        size.css = entry.contentRect.width
        updateArtworkSize(size)
      }
    }
  })
  // Screen changes need no layout reads: reuse widths delivered by ResizeObserver.
  stopDensity ??= subscribeArtworkDensity(() =>
    resizeListeners.forEach(updateArtworkSize),
  )
  resizeListeners.set(element, { css: 0, pixels: 0, notify })
  resizeObserver.observe(element)
  return () => {
    resizeListeners.delete(element)
    resizeObserver?.unobserve(element)
    if (!resizeListeners.size) {
      resizeObserver?.disconnect()
      resizeObserver = undefined
      stopDensity?.()
      stopDensity = undefined
    }
  }
}
