import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Film } from 'lucide-react'
import { getLibraryImage } from '@hollyfilms/shared/library'
import type { LibraryImage } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { useArtworkHero } from './artwork-hero-context.ts'

export function MediaArtwork({
  source,
  session,
  width = 400,
  eager = false,
  className = '',
  fallback,
}: {
  source?: LibraryImage | string
  session?: JellyfinSession
  width?: number
  eager?: boolean
  className?: string
  fallback?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const inView = useInView(ref, { once: true, margin: '200px' })
  const remote = typeof source === 'object' ? source : undefined
  const client = useQueryClient()
  const image = useQuery({
    queryKey: [
      'library-image',
      session?.deviceId,
      remote?.itemId,
      remote?.type,
      remote?.tag,
      width,
    ],
    queryFn: ({ signal }) =>
      getLibraryImage(
        new URL('/jellyfin', window.location.origin).href,
        session!,
        remote!,
        width,
        signal,
      ),
    enabled: Boolean(remote && session && (eager || inView)),
    retry: false,
    staleTime: Infinity,
    gcTime: 60_000,
    placeholderData: () =>
      remote && session
        ? client
            .getQueriesData<Blob>({
              queryKey: [
                'library-image',
                session.deviceId,
                remote.itemId,
                remote.type,
                remote.tag,
              ],
            })
            .filter((entry) => entry[1] instanceof Blob)
            .sort((a, b) => Number(b[0][5]) - Number(a[0][5]))[0]?.[1]
        : undefined,
  })
  useArtworkHero(ref, source, image.data)
  const [objectUrl, setObjectUrl] = useState<{ blob: Blob; url: string }>()
  const [failedSource, setFailedSource] = useState<string>()
  const [loadedSource, setLoadedSource] = useState<string>()
  useEffect(() => {
    if (!image.data) return
    const url = URL.createObjectURL(image.data)
    // Object URLs are external browser resources, created and revoked with the effect.
    // oxlint-disable-next-line react/set-state-in-effect
    setObjectUrl({ blob: image.data, url })
    return () => URL.revokeObjectURL(url)
  }, [image.data])
  const src =
    typeof source === 'string'
      ? source
      : objectUrl?.blob === image.data
        ? objectUrl?.url
        : undefined
  return (
    <motion.div
      ref={ref}
      className={'media-artwork ' + className}
      layout={!reduced}
      transition={{ layout: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
    >
      {(!src || loadedSource !== src || failedSource === src) && (
        <div className="media-artwork-fallback" aria-hidden="true">
          {fallback ?? <Film strokeWidth={1} />}
        </div>
      )}
      {src && failedSource !== src && (
        <motion.img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          initial={{ opacity: 0 }}
          animate={{ opacity: loadedSource === src ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.4 }}
          onLoad={() => setLoadedSource(src)}
          onError={() => setFailedSource(src)}
        />
      )}
    </motion.div>
  )
}
