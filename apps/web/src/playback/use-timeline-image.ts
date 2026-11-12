import { useEffect, useRef, useState } from 'react'

export type PreviewImageLoader = (
  url: string,
  signal: AbortSignal,
) => Promise<Blob>

export function useTimelineImage(
  url: string | undefined,
  load?: PreviewImageLoader,
) {
  const cache = useRef(new Map<string, string>())
  const [result, setResult] = useState<{
    source: string
    url?: string
    error?: boolean
  }>()
  useEffect(() => {
    if (!url || !load) return
    const controller = new AbortController()
    const cached = cache.current.get(url)
    if (cached) {
      // Cached object URLs are external resources owned by this hook.
      // oxlint-disable-next-line react/set-state-in-effect
      setResult({ source: url, url: cached })
    } else {
      void load(url, controller.signal)
        .then((blob) => {
          if (controller.signal.aborted) return
          const objectUrl = URL.createObjectURL(blob)
          cache.current.set(url, objectUrl)
          // Keep only nearby sheets, rather than retaining an entire movie's sprites.
          if (cache.current.size > 3) {
            const oldest = cache.current.keys().next().value!
            URL.revokeObjectURL(cache.current.get(oldest)!)
            cache.current.delete(oldest)
          }
          setResult({ source: url, url: objectUrl })
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setResult({ source: url, error: true })
        })
    }
    return () => controller.abort()
  }, [url, load])
  useEffect(() => {
    const images = cache.current
    return () => {
      for (const objectUrl of images.values()) URL.revokeObjectURL(objectUrl)
      images.clear()
    }
  }, [])
  return load
    ? result?.source === url
      ? result
      : undefined
    : { url, error: false }
}
