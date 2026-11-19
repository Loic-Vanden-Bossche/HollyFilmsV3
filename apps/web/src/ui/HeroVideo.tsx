import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { HeroPreview } from '@hollyfilms/shared/library'
import './hero-video.css'

type PreviewStatus = 'playing' | 'unavailable'

/** Decorative inline playback, separate from the full player's session and preferences. */
export function HeroVideo({
  source,
  running,
  muted,
  onStatus,
}: {
  source: HeroPreview
  running: boolean
  muted: boolean
  onStatus: (status: PreviewStatus) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const { url } = source
  const [result, setResult] = useState<{ url: string; status: PreviewStatus }>()
  const status = result?.url === url ? result.status : undefined
  const unavailable = status === 'unavailable'

  function report(next: PreviewStatus) {
    setResult({ url, status: next })
    onStatus(next)
  }
  const fail = useEffectEvent(() => report('unavailable'))

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
  }, [url, unavailable])

  useEffect(() => {
    const element = video.current
    if (!element) return
    let current = true
    if (running) {
      void element.play().catch(() => {
        if (current) fail()
      })
    } else element.pause()
    return () => {
      current = false
    }
  }, [url, running, unavailable])

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
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: status === 'playing' ? 1 : 0 }}
      transition={{ duration: 0.9 }}
    >
      <video
        ref={video}
        muted={muted}
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        loop
        playsInline
        preload="metadata"
        tabIndex={-1}
        onPlaying={() => report('playing')}
        onError={() => report('unavailable')}
      />
    </motion.div>
  )
}
