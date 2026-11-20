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

const waiting = new Map<Element, () => void>()
let observer: IntersectionObserver | undefined

export function whenArtworkIsNear(element: Element, load: () => void) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) waiting.get(entry.target)?.()
      }
    },
    { rootMargin: '200px' },
  )
  waiting.set(element, () => {
    stop()
    load()
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
