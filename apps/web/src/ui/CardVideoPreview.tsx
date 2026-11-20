import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import {
  getHeroPreview,
  getItemPreviewClip,
  type MediaItem,
} from '@hollyfilms/shared/library'
import { HeroVideo } from './HeroVideo.tsx'
import { holdBannerVideo } from './card-video-activity.ts'

export function CardVideoPreview({
  item,
  session,
  userId,
  startSeconds,
}: {
  item: MediaItem
  session: JellyfinSession
  userId: string
  startSeconds?: number
}) {
  const base = new URL('/jellyfin', window.location.origin).href
  const resume = item.progress > 0 && !item.watched
  const clip = getItemPreviewClip(base, session, item, startSeconds)
  const [clipFailed, setClipFailed] = useState(false)
  const [trailerFailed, setTrailerFailed] = useState(false)
  const [finished, setFinished] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const titledArt = useRef<HTMLElement | null>(null)
  const deadline = useRef<ReturnType<typeof setTimeout>>(undefined)
  const preferClip = !!clip && !clipFailed && (resume || startSeconds != null)
  const trailer = useQuery({
    queryKey: ['native-preview', session.deviceId, userId, item.id],
    queryFn: ({ signal }) =>
      getHeroPreview(base, session, userId, item, signal),
    enabled: !preferClip && !trailerFailed && !finished,
    staleTime: 300_000,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const availableTrailer = !trailerFailed && trailer.data
  const source = preferClip
    ? clip
    : availableTrailer || (!trailer.isPending && !clipFailed ? clip : null)
  const active = !!source && !finished
  useLayoutEffect(() => {
    const hero = frame.current?.closest<HTMLElement>(
      '.artwork-preview-hero[data-titled-image]',
    )
    titledArt.current = hero ?? null
    return () => {
      hero?.style.removeProperty('--preview-video-opacity')
      titledArt.current = null
    }
  }, [source?.url, active])
  useEffect(() => (active ? holdBannerVideo() : undefined), [active])
  useEffect(() => () => clearTimeout(deadline.current), [])
  if (!source || finished) return null
  const excerpt = source === clip
  return (
    <div className="card-video-preview" ref={frame}>
      <HeroVideo
        key={excerpt ? 'clip' : 'trailer'}
        source={source}
        running
        muted
        onFade={(opacity) =>
          titledArt.current?.style.setProperty(
            '--preview-video-opacity',
            String(opacity),
          )
        }
        onStatus={(status) => {
          if (status === 'unavailable') {
            if (excerpt) setClipFailed(true)
            else setTrailerFailed(true)
          } else {
            // Browsers vary in how they honor a media fragment's end time.
            deadline.current ??= setTimeout(() => setFinished(true), 15_000)
          }
        }}
      />
    </div>
  )
}
