import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { HeroPreview } from '@hollyfilms/shared/library'
import { loadYouTube } from '../lib/youtube.ts'
import type { YouTubePlayer } from '../lib/youtube.ts'

/** Preview-only playback: never reports progress or opens a full-film session. */
export function HeroVideo({
  source,
  running,
  muted,
  onStatus,
}: {
  source: HeroPreview
  running: boolean
  muted: boolean
  onStatus: (status: 'playing' | 'unavailable') => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const youtube = useRef<YouTubePlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const notify = useEffectEvent(onStatus)
  const start = useEffectEvent((player: YouTubePlayer) => {
    youtube.current = player
    if (muted) player.mute()
    else player.unMute()
    if (running) player.playVideo()
    else player.pauseVideo()
  })

  useEffect(() => {
    if (source.kind !== 'youtube') return
    let disposed = false
    let player: YouTubePlayer | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    function fail() {
      if (disposed) return
      clearTimeout(timeout)
      setFailed(true)
      notify('unavailable')
      player?.destroy()
      player = undefined
      youtube.current = null
    }
    void loadYouTube()
      .then((api) => {
        if (disposed || !host.current) return
        const element = document.createElement('div')
        host.current.replaceChildren(element)
        timeout = setTimeout(fail, 15000)
        player = new api.Player(element, {
          host: 'https://www.youtube-nocookie.com',
          videoId: source.id,
          playerVars: {
            autoplay: 0,
            controls: 0,
            playsinline: 1,
            disablekb: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: ({ target }) => {
              if (disposed) return
              target.getIframe().tabIndex = -1
              target.getIframe().title = 'Bande-annonce en arrière-plan'
              start(target)
            },
            onStateChange: ({ data }) => {
              if (disposed) return
              if (data === 1) {
                clearTimeout(timeout)
                setReady(true)
                notify('playing')
              } else if (data === 0) fail()
            },
            onError: fail,
            onAutoplayBlocked: fail,
          },
        })
      })
      .catch(fail)
    return () => {
      disposed = true
      clearTimeout(timeout)
      youtube.current = null
      player?.destroy()
    }
  }, [source])

  useEffect(() => {
    const player = youtube.current
    if (player) {
      if (muted) player.mute()
      else player.unMute()
      if (running) player.playVideo()
      else player.pauseVideo()
    }
    const element = video.current
    if (!element) return
    let current = true
    if (source.kind === 'video' && element.getAttribute('src') !== source.url)
      element.src = source.url
    element.muted = muted
    if (running)
      void element.play().catch(() => {
        if (!current) return
        setFailed(true)
        notify('unavailable')
      })
    else element.pause()
    return () => {
      current = false
      element.pause()
    }
  }, [running, muted, source])

  useEffect(() => {
    const element = video.current
    return () => {
      if (!element) return
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
  }, [source])

  useEffect(() => {
    if (source.kind !== 'video' || ready || failed || !running) return
    const timeout = setTimeout(() => {
      setFailed(true)
      notify('unavailable')
    }, 15000)
    return () => clearTimeout(timeout)
  }, [source, ready, failed, running])

  return failed ? null : (
    <motion.div
      className="hero-video"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: ready ? 1 : 0 }}
      transition={{ duration: 0.9 }}
    >
      {source.kind === 'youtube' ? (
        <div ref={host} className="hero-youtube" />
      ) : (
        <video
          ref={video}
          src={source.url}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
          onPlaying={() => {
            setReady(true)
            onStatus('playing')
          }}
          onEnded={() => {
            setFailed(true)
            onStatus('unavailable')
          }}
          onError={() => {
            setFailed(true)
            onStatus('unavailable')
          }}
        />
      )}
    </motion.div>
  )
}
