import { useEffect, useRef } from 'react'

export function useMediaSession(
  title: string | undefined,
  controls: {
    position: number
    duration: number
    rate: number
    paused: boolean
    toggle: () => void
    seek: (position: number) => void
    step: (direction: -1 | 1) => void
    stop: () => void
  },
) {
  const current = useRef(controls)
  useEffect(() => {
    current.current = controls
  }, [controls])
  useEffect(() => {
    if (
      !title ||
      !navigator.mediaSession ||
      typeof MediaMetadata === 'undefined'
    )
      return
    const session = navigator.mediaSession
    session.metadata = new MediaMetadata({ title, album: 'HollyFilms' })
    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      [
        'play',
        () => {
          if (current.current.paused) current.current.toggle()
        },
      ],
      [
        'pause',
        () => {
          if (!current.current.paused) current.current.toggle()
        },
      ],
      [
        'seekbackward',
        ({ seekOffset }) =>
          current.current.seek(current.current.position - (seekOffset ?? 10)),
      ],
      [
        'seekforward',
        ({ seekOffset }) =>
          current.current.seek(current.current.position + (seekOffset ?? 30)),
      ],
      [
        'seekto',
        ({ seekTime }) => {
          if (seekTime != null) current.current.seek(seekTime)
        },
      ],
      ['previoustrack', () => current.current.step(-1)],
      ['nexttrack', () => current.current.step(1)],
      ['stop', () => current.current.stop()],
    ]
    const installed: MediaSessionAction[] = []
    for (const [name, handler] of actions) {
      try {
        session.setActionHandler(name, handler)
        installed.push(name)
      } catch {
        /* Some platforms omit individual actions. */
      }
    }
    return () => {
      for (const name of installed) session.setActionHandler(name, null)
      session.metadata = null
      session.playbackState = 'none'
      session.setPositionState?.()
    }
  }, [title])
  const { position, duration, rate, paused } = controls
  useEffect(() => {
    if (!title || !navigator.mediaSession) return
    navigator.mediaSession.playbackState = paused ? 'paused' : 'playing'
    if (Number.isFinite(duration) && duration > 0) {
      navigator.mediaSession.setPositionState?.({
        duration,
        position: Math.max(0, Math.min(duration, position)),
        playbackRate: rate,
      })
    }
  }, [title, position, duration, rate, paused])
}
