import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { animate, motion } from 'motion/react'
import type { HeroPreview } from '@hollyfilms/shared/library'
import { duration } from '../motion/tokens.ts'
import './hero-video.css'

type PreviewStatus = 'playing' | 'unavailable'

/** Decorative inline playback, separate from the full player's session and preferences. */
export function HeroVideo({
  source,
  running,
  muted,
  onStatus,
  onFade,
  onExcerptEnd,
}: {
  source: HeroPreview
  running: boolean
  muted: boolean
  onStatus: (status: PreviewStatus) => void
  onFade?: (opacity: number) => void
  /** End an excerpt after its fragment or 15 seconds of active playback. */
  onExcerptEnd?: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const excerptFinished = useRef(false)
  const bounded = Boolean(onExcerptEnd)
  const { url } = source
  const [result, setResult] = useState<{ url: string; status: PreviewStatus }>()
  const status = result?.url === url ? result.status : undefined
  const unavailable = status === 'unavailable'

  function report(next: PreviewStatus) {
    setResult({ url, status: next })
    onStatus(next)
  }
  const fail = useEffectEvent(() => report('unavailable'))
  const excerptEnd = useEffectEvent(() => onExcerptEnd?.())

  useEffect(() => {
    const element = video.current
    if (!element) return
    // Browsers may select a default in-band caption track after playback starts.
    const tracks = element.textTracks
    function hideCaptions() {
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i]
        if (track.mode !== 'disabled') track.mode = 'disabled'
      }
    }
    tracks.addEventListener('addtrack', hideCaptions)
    tracks.addEventListener('change', hideCaptions)
    element.addEventListener('loadedmetadata', hideCaptions)
    element.src = url
    hideCaptions()
    return () => {
      tracks.removeEventListener('addtrack', hideCaptions)
      tracks.removeEventListener('change', hideCaptions)
      element.removeEventListener('loadedmetadata', hideCaptions)
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
  }, [url, unavailable, bounded])

  useEffect(() => {
    const element = video.current
    excerptFinished.current = false
    if (!element || !bounded) return
    const fragment = new URL(url, document.baseURI).hash.slice(1)
    const end = Number(new URLSearchParams(fragment).get('t')?.split(',')[1])
    let remaining = 15_000
    let started: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let fade: ReturnType<typeof animate> | undefined
    const lifetime = new AbortController()
    function stopClock() {
      clearTimeout(timer)
      if (started !== undefined) remaining -= performance.now() - started
      started = undefined
    }
    const finish = () => {
      if (excerptFinished.current) return
      excerptFinished.current = true
      stopClock()
      element.pause()
      fade = animate(element, { opacity: 0 }, { duration: duration.press })
      void fade.then(() => {
        if (lifetime.signal.aborted) return
        element.removeAttribute('src')
        element.load()
        excerptEnd()
      })
    }
    function play() {
      if (started !== undefined || excerptFinished.current) return
      started = performance.now()
      timer = setTimeout(finish, Math.max(0, remaining))
    }
    const checkFragment = () => {
      if (element.currentTime >= end) finish()
    }
    const options = { signal: lifetime.signal }
    element.addEventListener('playing', play, options)
    element.addEventListener('waiting', stopClock, options)
    element.addEventListener('seeking', stopClock, options)
    element.addEventListener('pause', stopClock, options)
    element.addEventListener('timeupdate', checkFragment, options)
    element.addEventListener('ended', finish, options)
    return () => {
      lifetime.abort()
      stopClock()
      fade?.stop()
      element.style.removeProperty('opacity')
    }
  }, [url, unavailable, bounded])

  useEffect(() => {
    const element = video.current
    if (!element) return
    let current = true
    if (running && !excerptFinished.current) {
      void element.play().catch(() => {
        if (current && !excerptFinished.current) fail()
      })
    } else element.pause()
    return () => {
      current = false
    }
  }, [url, running, unavailable, bounded])

  useEffect(() => {
    if (!running || status) return
    const timeout = setTimeout(fail, 15_000)
    return () => clearTimeout(timeout)
  }, [url, running, status])

  if (unavailable) return null
  return (
    <motion.div
      key={url}
      className="hero-video"
      data-playing={status === 'playing' || undefined}
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: status === 'playing' ? 1 : 0 }}
      transition={{ duration: 0.9 }}
      onUpdate={onFade && ((values) => onFade(Number(values.opacity)))}
    >
      <video
        ref={video}
        muted={muted}
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        loop={!bounded}
        playsInline
        preload="metadata"
        tabIndex={-1}
        onPlaying={() => report('playing')}
        onError={() => report('unavailable')}
      />
    </motion.div>
  )
}
