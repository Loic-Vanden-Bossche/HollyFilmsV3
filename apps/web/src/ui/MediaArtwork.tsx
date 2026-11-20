import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode, RefObject } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Film } from 'lucide-react'
import { getLibraryImage } from '@hollyfilms/shared/library'
import type { LibraryImage } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { distance, duration, ease } from '../motion/tokens.ts'
import { artworkIdentity } from './artwork-hero-context.ts'
import {
  acquireArtworkUrl,
  artworkPixelWidth,
  cachedArtwork,
  imageQueryKey,
  markArtworkDecoded,
  observeArtworkSize,
  whenArtworkIsNear,
} from './artwork-resources.ts'

type MediaArtworkProps = {
  source?: LibraryImage | string
  session?: JellyfinSession
  width?: number | 'display'
  eager?: boolean
  className?: string
  fallback?: ReactNode
  /** A title logo reserves its space until decoded, using its fallback only on failure. */
  reveal?: 'fade' | 'logo' | 'shared'
  /** Called once this source is decoded, or its fallback is ready. */
  onReady?: () => void
  /** Called when the requested image cannot be fetched or displayed. */
  onUnavailable?: () => void
}

export const MediaArtwork = memo(function MediaArtwork(
  props: MediaArtworkProps,
) {
  // A resolution change keeps the current bitmap, while changing account or title releases it.
  const { session, source } = props
  if (source && typeof source === 'object' && session) {
    return (
      <RemoteArtwork
        key={JSON.stringify([session.deviceId, artworkIdentity(source)])}
        {...props}
        session={session}
        source={source}
      />
    )
  }
  return (
    <ArtworkFrame
      key={artworkIdentity(source)}
      {...props}
      fetchFailed={typeof source === 'object'}
    />
  )
})

function RemoteArtwork({
  source,
  session,
  width: requestedWidth = 400,
  eager = false,
  ...props
}: MediaArtworkProps & { source: LibraryImage; session: JellyfinSession }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const responsive = requestedWidth === 'display'
  useEffect(() => {
    if (!eager && !near && ref.current)
      return whenArtworkIsNear(ref.current, (width) => {
        if (responsive && width > 0) setMeasuredWidth(artworkPixelWidth(width))
        setNear(true)
      })
  }, [eager, near, responsive])
  useEffect(() => {
    if (responsive && (near || eager) && ref.current)
      return observeArtworkSize(ref.current, setMeasuredWidth)
  }, [responsive, near, eager])
  const width = responsive ? measuredWidth : requestedWidth
  const client = useQueryClient()
  const { itemId, type, tag, index } = source
  const key = useMemo(
    () => imageQueryKey(session.deviceId, { itemId, type, tag, index }, width),
    [session.deviceId, itemId, type, tag, index, width],
  )
  const placeholder = useCallback(
    () => (key[5] ? cachedArtwork(client, key, 'placeholder') : undefined),
    [client, key],
  )
  const image = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      cachedArtwork(client, key, 'final') ??
      getLibraryImage(
        new URL('/jellyfin', window.location.origin).href,
        session,
        source,
        width,
        signal,
      ),
    enabled: (eager || near) && width > 0,
    retry: false,
    staleTime: Infinity,
    gcTime: 60_000,
    placeholderData: placeholder,
  })
  return (
    <ArtworkFrame
      {...props}
      source={source}
      eager={eager}
      elementRef={ref}
      blob={image.data}
      fetchFailed={image.isError}
      placeholder={image.isPlaceholderData}
    />
  )
}

function ArtworkFrame({
  source,
  eager = false,
  className = '',
  fallback,
  reveal = 'fade',
  onReady,
  onUnavailable,
  elementRef,
  blob,
  fetchFailed,
  placeholder,
}: MediaArtworkProps & {
  elementRef?: RefObject<HTMLDivElement | null>
  blob?: Blob
  fetchFailed?: boolean
  placeholder?: boolean
}) {
  const reduced = useReducedMotion()
  const [objectUrl, setObjectUrl] = useState<{ blob: Blob; url: string }>()
  const [failedSource, setFailedSource] = useState<string>()
  const [painted, setPainted] = useState<{
    src: string
    sharedReveal: boolean
    blob?: Blob
  }>()
  const loadedSource = painted?.src
  useEffect(() => {
    if (!blob) return
    const lease = acquireArtworkUrl(blob)
    // oxlint-disable-next-line react/set-state-in-effect
    setObjectUrl({ blob, url: lease.url })
    return lease.release
  }, [blob])
  useLayoutEffect(() => {
    if (painted?.blob) return acquireArtworkUrl(painted.blob).release
  }, [painted?.blob])
  const src =
    typeof source === 'string'
      ? source
      : objectUrl?.blob === blob
        ? objectUrl?.url
        : undefined
  const decoded = Boolean(loadedSource)
  const unavailable =
    !decoded &&
    Boolean(fetchFailed || (src && failedSource === src && !placeholder))
  const settled = !source || decoded || unavailable
  useEffect(() => {
    if (settled) onReady?.()
  }, [settled, onReady])
  useEffect(() => {
    if (unavailable) onUnavailable?.()
  }, [unavailable, onUnavailable])

  const showFallback = !decoded && (reveal !== 'logo' || !source || unavailable)
  const logoMotion = reveal === 'logo' && !reduced
  const frames = loadedSource ? [loadedSource] : []
  if (src && src !== loadedSource && src !== failedSource) frames.push(src)
  return (
    <div
      ref={elementRef}
      className={'media-artwork ' + className}
      data-decoded={decoded || undefined}
    >
      {showFallback && (
        <div className="media-artwork-fallback" aria-hidden="true">
          {fallback ?? <Film strokeWidth={1} />}
        </div>
      )}
      {frames.map((frame) => (
        <motion.img
          key={frame}
          src={frame}
          hidden={decoded && frame !== loadedSource}
          alt=""
          loading={eager || decoded ? 'eager' : 'lazy'}
          decoding="async"
          initial={false}
          animate={{
            opacity: decoded ? 1 : 0,
            ...(logoMotion && {
              y: decoded ? 0 : distance.panel,
              scale: decoded ? 1 : 0.96,
            }),
          }}
          transition={
            logoMotion
              ? { duration: duration.scene, ease: ease.out }
              : {
                  duration:
                    reduced || painted?.sharedReveal ? 0 : duration.panel,
                }
          }
          onLoad={(event) => {
            const element = event.currentTarget
            void element.decode().then(
              () => {
                if (!element.isConnected) return
                const sharedReveal =
                  reveal === 'shared' &&
                  element.ownerDocument.documentElement.hasAttribute(
                    'data-artwork-flight',
                  ) &&
                  !element.closest('[data-artwork-endpoint="loading"]')
                const frameBlob = frame === loadedSource ? painted?.blob : blob
                if (frameBlob) markArtworkDecoded(frameBlob)
                setPainted({ src: frame, sharedReveal, blob: frameBlob })
              },
              () => {
                if (element.isConnected) setFailedSource(frame)
              },
            )
          }}
          onError={() => setFailedSource(frame)}
        />
      ))}
    </div>
  )
}
