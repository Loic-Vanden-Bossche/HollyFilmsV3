import { useEffect, useRef, useState } from 'react'
import { ticksPerSecond } from './playback-api.ts'
import type {
  PlaybackApi,
  PlaybackStream,
  PlaybackTarget,
  StreamOptions,
} from './playback-api.ts'
import type { PlaybackProgressInfo } from '@jellyfin/sdk/lib/generated-client/index.js'

export type PlayerState = 'loading' | 'ready' | 'playing' | 'error' | 'stopped'

type Request = {
  target: PlaybackTarget
  options: StreamOptions
  paused?: boolean
}

type MediaState = {
  position: number
  duration: number
  buffered: number
  paused: boolean
  muted: boolean
  volume: number
  rate: number
}

export const initialMediaState: MediaState = {
  position: 0,
  duration: 0,
  buffered: 0,
  paused: true,
  muted: false,
  volume: 1,
  rate: 1,
}

export function usePlayback(
  api: PlaybackApi,
  initial: PlaybackTarget,
  initialOptions: StreamOptions = {},
  initialSettings = { volume: 1, muted: false, rate: 1 },
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cleanup = useRef<() => Promise<void>>(async () => {})
  const pendingReports = useRef(Promise.resolve())
  const active = useRef<
    { target: PlaybackTarget; stream: PlaybackStream } | undefined
  >(undefined)
  const versions = useRef<
    { id: string; sources: PlaybackStream['sources'] } | undefined
  >(undefined)
  const preferences = useRef({
    audio: undefined as number | undefined,
    subtitle: undefined as number | undefined,
    repeat: 'RepeatNone' as 'RepeatNone' | 'RepeatOne' | 'RepeatAll',
    queue: [] as PlaybackTarget[],
    shuffle: false,
  })
  const settings = useRef(initialSettings)
  const report = useRef<() => void>(() => {})
  const [request, setRequest] = useState<Request>({
    target: initial,
    options: initialOptions,
  })
  const [playback, setPlayback] = useState<{
    target: PlaybackTarget
    stream: PlaybackStream
  }>()
  const [state, setState] = useState<PlayerState>('loading')
  const [media, setMedia] = useState<MediaState>({
    ...initialMediaState,
    ...initialSettings,
  })
  const [problem, setProblem] = useState('')
  const [ended, setEnded] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [hasFrame, setHasFrame] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const abort = new AbortController()
    let destroyHls: (() => void) | undefined
    let stream: PlaybackStream | undefined
    let target = request.target
    let started = false
    let finished = false
    let failure = false
    let initialSeek = true
    let time = target.start
    let lastUpdate = 0
    let startTime = 0
    let startupTimer: ReturnType<typeof setTimeout>

    // Each load owns its listeners, source, reports and teardown.
    // oxlint-disable-next-line react/set-state-in-effect
    setState('loading')
    setHasFrame(false)
    setBuffering(false)
    setEnded(false)
    setProblem('')
    setPlayback(undefined)

    function queueReport(send: () => Promise<unknown>) {
      pendingReports.current = pendingReports.current.then(async () => {
        try {
          await send()
        } catch {
          /* Session reporting must never stop playback. */
        }
      })
      return pendingReports.current
    }

    function snapshot(): PlaybackProgressInfo {
      const prefs = preferences.current
      return {
        ItemId: target.id,
        MediaSourceId: stream?.source.Id,
        PlaySessionId: stream?.sessionId,
        LiveStreamId: stream?.source.LiveStreamId,
        AudioStreamIndex: prefs.audio ?? stream?.source.DefaultAudioStreamIndex,
        SubtitleStreamIndex:
          prefs.subtitle ?? stream?.source.DefaultSubtitleStreamIndex,
        PositionTicks: Math.round(time * ticksPerSecond),
        PlaybackStartTimeTicks: startTime,
        PlayMethod: stream?.method,
        IsPaused: video!.paused,
        IsMuted: video!.muted,
        VolumeLevel: Math.round(video!.volume * 100),
        CanSeek: Number.isFinite(video!.duration),
        RepeatMode: prefs.repeat,
        PlaybackOrder: prefs.shuffle ? 'Shuffle' : 'Default',
        NowPlayingQueue: prefs.queue.map((item, index) => ({
          Id: item.id,
          PlaylistItemId: String(index),
        })),
      }
    }

    function update(force = false) {
      if (finished || !stream) return
      if (!initialSeek) time = video!.currentTime + stream.offset
      if (!force && performance.now() - lastUpdate < 180) return
      lastUpdate = performance.now()
      const duration = Number.isFinite(video!.duration)
        ? video!.duration + stream.offset
        : (stream.source.RunTimeTicks ?? 0) / ticksPerSecond
      const ranges = video!.buffered
      setMedia({
        position: time,
        duration,
        buffered: ranges.length
          ? ranges.end(ranges.length - 1) + stream.offset
          : 0,
        paused: video!.paused,
        muted: video!.muted,
        volume: video!.volume,
        rate: video!.playbackRate,
      })
    }
    function sendProgress() {
      if (!started || finished) return
      update(true)
      const info = snapshot()
      void queueReport(() => api.progress(info))
    }
    report.current = sendProgress

    function fail(message: string) {
      if (finished || failure) return
      failure = true
      clearTimeout(startupTimer)
      video!.pause()
      setProblem(message)
      setState('error')
    }
    function onMediaError() {
      if (finished || !stream) return
      if (stream.method !== 'Transcode' && !request.options.forceTranscode) {
        setRequest({
          target: { ...target, start: time },
          options: {
            ...request.options,
            sourceId: stream.source.Id,
            forceTranscode: true,
          },
          paused: request.paused,
        })
      } else {
        fail('Le flux vidéo est indisponible ou ne peut pas être décodé.')
      }
    }

    async function play() {
      try {
        await video!.play()
      } catch (error) {
        if (finished) return
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          clearTimeout(startupTimer)
          setState('ready')
        } else if (!(
          error instanceof DOMException && error.name === 'AbortError'
        )) {
          onMediaError()
        }
      }
    }
    function onMetadata() {
      if (!stream || finished) return
      const position = target.start - stream.offset
      if (position > 0 && Number.isFinite(video!.duration)) {
        video!.currentTime = Math.min(
          position,
          Math.max(0, video!.duration - 0.1),
        )
      }
      initialSeek = false
      update(true)
      if (request.paused) {
        clearTimeout(startupTimer)
        setState('ready')
      } else {
        void play()
      }
    }
    function onPlaying() {
      if (finished || failure || !stream) return
      clearTimeout(startupTimer)
      setBuffering(false)
      setEnded(false)
      setState('playing')
      onFrame()
      update(true)
      if (!started) {
        started = true
        startTime = Date.now() * 10_000
        const info = snapshot()
        void queueReport(() => api.start(info))
      }
    }
    function onWaiting() {
      if (started && !video!.paused) setBuffering(true)
    }
    function onFrame() {
      if (!finished && !failure && video!.readyState >= 2) setHasFrame(true)
    }
    function onPause() {
      update(true)
      setBuffering(false)
      sendProgress()
    }
    function onEnded() {
      update(true)
      setEnded(true)
    }
    function onSettings() {
      settings.current = {
        volume: video!.volume,
        muted: video!.muted,
        rate: video!.playbackRate,
      }
      update(true)
    }

    const listeners: [string, EventListener][] = [
      ['loadedmetadata', onMetadata],
      ['loadeddata', onFrame],
      ['playing', onPlaying],
      ['waiting', onWaiting],
      ['pause', onPause],
      ['seeked', sendProgress],
      ['ended', onEnded],
      ['error', onMediaError],
      ['timeupdate', () => update()],
      ['progress', () => update()],
      ['volumechange', onSettings],
      ['ratechange', onSettings],
    ]
    for (const [type, listener] of listeners)
      video.addEventListener(type, listener)
    const interval = setInterval(sendProgress, 10_000)

    function stop(keepalive = false) {
      if (finished) return pendingReports.current
      update(true)
      const info = snapshot()
      finished = true
      abort.abort()
      clearTimeout(startupTimer)
      clearInterval(interval)
      for (const [type, listener] of listeners)
        video!.removeEventListener(type, listener)
      window.removeEventListener('pagehide', onPageHide)
      destroyHls?.()
      video!.pause()
      video!.removeAttribute('src')
      video!.load()
      active.current = undefined
      report.current = () => {}
      if (started && keepalive) {
        void fetch(api.sdk.getUri('/Sessions/Playing/Stopped'), {
          method: 'POST',
          keepalive: true,
          headers: {
            Authorization: api.sdk.authorizationHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...info, Failed: failure }),
        }).catch(() => {})
      } else if (started) {
        void queueReport(() => api.stop({ ...info, Failed: failure }))
      }
      const stopped = pendingReports.current
      if (stream && !keepalive) {
        const released = stream
        void stopped.then(() => api.release(released)).catch(() => {})
      }
      return stopped
    }
    function onPageHide() {
      void stop(true)
    }
    window.addEventListener('pagehide', onPageHide)
    cleanup.current = stop

    void (async () => {
      try {
        target = await api.resolve(target, abort.signal)
        time = target.start
        const negotiated = await api.stream(
          video,
          target,
          request.options,
          abort.signal,
        )
        if (finished) {
          void api.release(negotiated).catch(() => {})
          return
        }
        const prior =
          versions.current?.id === target.id ? versions.current.sources : []
        const sources = [
          ...new Map(
            [...prior, ...negotiated.sources].map((source) => [
              source.Id,
              source,
            ]),
          ).values(),
        ]
        versions.current = { id: target.id, sources }
        stream = { ...negotiated, sources }
        active.current = { target, stream }
        setPlayback(active.current)
        video.volume = settings.current.volume
        video.muted = settings.current.muted
        video.playbackRate = settings.current.rate
        startupTimer = setTimeout(
          () => fail('Le serveur met trop de temps à fournir la vidéo.'),
          30_000,
        )
        if (stream.hls) {
          const { attachHls } = await import('./hls-engine.ts')
          if (!finished)
            destroyHls = attachHls(
              video,
              stream.url,
              target.start,
              onMediaError,
            )
        } else {
          video.src = stream.url
        }
      } catch (error) {
        if (!finished)
          fail(
            error instanceof Error && !('isAxiosError' in error)
              ? error.message
              : 'Le serveur ne peut pas préparer la lecture.',
          )
      }
    })()
    return () => {
      void stop()
    }
  }, [api, request])

  function replaceStream(options: StreamOptions) {
    const video = videoRef.current
    if (!active.current || !video) return
    const { target, stream } = active.current
    setRequest({
      target: { ...target, start: video.currentTime + stream.offset },
      options: { ...request.options, sourceId: stream.source.Id, ...options },
      paused: video.paused,
    })
  }
  function seek(seconds: number) {
    const video = videoRef.current
    if (
      !video ||
      !active.current ||
      !Number.isFinite(video.duration) ||
      !Number.isFinite(seconds)
    )
      return
    const position = Math.max(0, seconds)
    const offset = active.current.stream.offset
    if (position < offset) {
      setRequest({
        ...request,
        target: { ...active.current.target, start: position },
        paused: video.paused,
      })
    } else {
      video.currentTime = Math.min(video.duration, position - offset)
    }
  }
  function toggle() {
    const video = videoRef.current
    if (!video || !active.current) return
    if (video.paused) void video.play().catch(() => setState('ready'))
    else video.pause()
  }

  return {
    videoRef,
    playback,
    state,
    media,
    problem,
    ended,
    buffering,
    hasFrame,
    preferences,
    report,
    options: request.options,
    seek,
    toggle,
    replaceStream,
    open(target: PlaybackTarget, paused = false) {
      setRequest({
        target,
        paused,
        options: { bitrate: request.options.bitrate },
      })
    },
    retry() {
      setRequest({ ...request })
    },
    async close() {
      setState('stopped')
      await cleanup.current()
    },
  }
}
