import { useEffect, useLayoutEffect, useRef } from 'react'

export function useMediaSession(
  title: string | undefined,
  controls: {
    position: number
    duration: number
    rate: number
    paused: boolean
    setPaused: (paused: boolean) => void
    seek: (position: number) => void
    step: (direction: -1 | 1) => void
    stop: () => void
  },
) {
  const current = useRef(controls)
  useLayoutEffect(() => {
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
      ['play', () => current.current.setPaused(false)],
      ['pause', () => current.current.setPaused(true)],
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
  }, [title, paused])

  const lastPosition = useRef<
    | {
        position: number
        at: number
        duration: number
        rate: number
        paused: boolean
      }
    | undefined
  >(undefined)
  useEffect(() => {
    lastPosition.current = undefined
  }, [title])
  useEffect(() => {
    if (
      !title ||
      !navigator.mediaSession ||
      !Number.isFinite(duration) ||
      duration <= 0
    )
      return
    // The OS advances its own clock between updates. Re-anchor on seeks,
    // pauses, speed changes and drift instead of republishing every video tick.
    const at = performance.now()
    const last = lastPosition.current
    if (
      last &&
      last.duration === duration &&
      last.paused === paused &&
      last.rate === rate
    ) {
      const expected =
        last.position + (paused ? 0 : ((at - last.at) / 1000) * rate)
      if (Math.abs(position - expected) < 1) return
    }
    navigator.mediaSession.setPositionState?.({
      duration,
      position: Math.max(0, Math.min(duration, position)),
      playbackRate: rate,
    })
    lastPosition.current = { position, at, duration, rate, paused }
  }, [title, position, duration, rate, paused])
}
