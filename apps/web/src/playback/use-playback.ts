import { useCallback, useEffect, useRef, useState } from 'react'
import { refreshSubtitleSource } from './subtitle-tracks.ts'
import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/index.js'
import { ticksPerSecond } from './playback-api.ts'
import {
  bufferedAhead,
  PlaybackInactivity,
  type PlaybackWait,
} from './loading-progress.ts'
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
  since: number
  operation: 'opening' | 'seeking' | 'preparing'
  preferredBitrate?: number
}

type MediaState = {
  position: number
  seeking?: boolean
  duration: number
  buffered: number
  bufferedAhead?: number
  paused: boolean
  muted: boolean
  volume: number
  rate: number
}

export const initialMediaState: MediaState = {
  position: 0,
  seeking: false,
  duration: 0,
  buffered: 0,
  bufferedAhead: 0,
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
  initialPaused = false,
  openedAt?: number,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cleanup = useRef<() => Promise<void>>(async () => {})
  const readPaused = useRef(() => initialPaused)
  const applyPaused = useRef<(paused: boolean) => void>(() => {})
  const requestSeek = useRef<(position: number) => void>(() => {})
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
  // Keep the requested position visible while a seek or a new stream is pending.
  // Reports still use the media element's actual position.
  const pendingSeek = useRef<
    { request: Request; position: number } | undefined
  >(undefined)
  const [request, setRequest] = useState<Request>(() => ({
    target: initial,
    options: initialOptions,
    paused: initialPaused,
    since: openedAt ?? Date.now(),
    operation: 'opening',
    preferredBitrate: initialOptions.bitrate,
  }))
  const [playback, setPlayback] = useState<{
    target: PlaybackTarget
    stream: PlaybackStream
    request: Request
  }>()
  const recovery = useRef<() => Request>(() => request)
  const [state, setState] = useState<PlayerState>('loading')
  const [media, setMedia] = useState<MediaState>({
    ...initialMediaState,
    ...initialSettings,
    position: initial.start,
    paused: initialPaused,
  })
  const [problem, setProblem] = useState('')
  const [ended, setEnded] = useState(false)
  const [hasFrame, setHasFrame] = useState(false)
  const [wait, setWait] = useState<PlaybackWait | null>(() => ({
    operation: request.operation,
    since: request.since,
    position: request.target.start,
  }))

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const abort = new AbortController()
    let destroyHls: (() => void) | undefined
    let stream: PlaybackStream | undefined
    let attached = false
    let target = request.target
    let started = false
    let finished = false
    let failure = false
    let initialSeek = true
    let startPaused = request.paused ?? false
    let time = target.start
    let lastUpdate = 0
    let startTime = 0
    let currentWait: PlaybackWait | null = {
      operation: request.operation,
      since: request.since,
      position: target.start,
    }
    let inactivity = new PlaybackInactivity(Date.now())
    let timer: ReturnType<typeof setTimeout>
    let clockAtWait = 0
    let failureRequest: Request | undefined

    // Each load owns its listeners, source, reports and teardown.
    // oxlint-disable-next-line react/set-state-in-effect
    setState('loading')
    setWait(currentWait)
    setMedia((current) => ({
      ...current,
      position: target.start,
      paused: startPaused,
      bufferedAhead: 0,
    }))
    setHasFrame(false)
    setEnded(false)
    setProblem('')
    setPlayback(undefined)

    function recoverRequest(): Request {
      if (failureRequest) return failureRequest
      const pending = pendingSeek.current
      if (pending && pending.request !== request) return pending.request
      const position =
        pending?.position ??
        (initialSeek || !stream || (!started && video!.currentTime === 0)
          ? target.start
          : video!.currentTime + stream.offset)
      return {
        ...request,
        target: { ...target, start: position },
        paused: started ? video!.paused : startPaused,
        options: {
          ...request.options,
          sourceId: stream?.source.Id ?? request.options.sourceId,
          subtitle: stream
            ? (preferences.current.subtitle ?? request.options.subtitle)
            : request.options.subtitle,
        },
      }
    }
    recovery.current = recoverRequest
    readPaused.current = () => {
      const pending = pendingSeek.current
      if (pending && pending.request !== request)
        return pending.request.paused ?? false
      return initialSeek ? startPaused : video.paused
    }

    function endWait() {
      clearTimeout(timer)
      if (currentWait) {
        currentWait = null
        setWait(null)
      }
    }

    function beginWait(operation: PlaybackWait['operation'], position: number) {
      if (finished || failure) return
      if (
        currentWait?.operation === operation &&
        currentWait.position === position
      )
        return
      const since = currentWait?.since ?? Date.now()
      currentWait = { operation, position, since }
      setWait(currentWait)
      inactivity = new PlaybackInactivity(Date.now())
      clockAtWait = stream ? Math.max(0, position - stream.offset) : 0
      scheduleCheck()
    }
    requestSeek.current = (position) => beginWait('seeking', position)

    function scheduleCheck() {
      clearTimeout(timer)
      if (currentWait && !document.hidden)
        timer = setTimeout(checkInactivity, inactivity.remaining(Date.now()))
    }
    function checkInactivity() {
      if (!currentWait || failure || finished || document.hidden) return
      // Events may have been coalesced while the tab was in the background.
      if (attached && video!.ended) {
        onEnded()
        return
      }
      onDataAvailable()
      if (
        currentWait?.operation === 'seeking' &&
        !video!.seeking &&
        stream &&
        video!.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        Math.abs(video!.currentTime + stream.offset - currentWait.position) <
          0.25
      )
        onSeeked()
      onTimeUpdate()
      update(true)
      if (!currentWait) return
      if (inactivity.remaining(Date.now()) > 0) scheduleCheck()
      else fail('Le serveur met trop de temps à fournir la vidéo.')
    }

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
      if (finished || !stream || !attached) return
      if (!initialSeek) time = video!.currentTime + stream.offset
      const pending = pendingSeek.current
      // An outgoing stream must not overwrite the next request's timeline.
      if (pending && pending.request !== request) return
      const ranges = video!.buffered
      const position = pending?.position ?? time
      const ahead = bufferedAhead(
        ranges,
        (currentWait?.position ?? position) - stream.offset,
      )
      if (currentWait) inactivity.observe(Date.now(), video!.readyState, ahead)
      if (!force && performance.now() - lastUpdate < 180) return
      lastUpdate = performance.now()
      const duration = Number.isFinite(video!.duration)
        ? video!.duration + stream.offset
        : (stream.source.RunTimeTicks ?? 0) / ticksPerSecond
      setMedia({
        position,
        seeking: Boolean(pending || video!.seeking),
        duration,
        buffered: ranges.length
          ? ranges.end(ranges.length - 1) + stream.offset
          : 0,
        bufferedAhead: ahead,
        paused: video!.paused,
        muted: video!.muted,
        volume: video!.volume,
        rate: video!.playbackRate,
      })
    }
    function sendProgress() {
      if (!started || finished || failure) return
      update(true)
      const info = snapshot()
      void queueReport(() => api.progress(info))
    }
    report.current = sendProgress

    function fail(message: string) {
      if (finished || failure) return
      failureRequest = recoverRequest()
      failure = true
      abort.abort()
      endWait()
      if (pendingSeek.current?.request === request)
        pendingSeek.current = undefined
      update(true)
      setMedia((current) => ({ ...current, seeking: false }))
      video!.pause()
      setProblem(message)
      setState('error')
    }
    function onMediaError() {
      if (finished || failure || !stream || !attached) return
      if (stream.method !== 'Transcode' && !request.options.forceTranscode) {
        const resume = recoverRequest()
        const next: Request = {
          ...resume,
          operation:
            currentWait?.operation === 'seeking' ? 'seeking' : 'preparing',
          since: currentWait?.since ?? Date.now(),
          options: {
            ...resume.options,
            forceTranscode: true,
          },
        }
        if (pendingSeek.current)
          pendingSeek.current = { request: next, position: next.target.start }
        setRequest(next)
      } else {
        fail('Le flux vidéo est indisponible ou ne peut pas être décodé.')
      }
    }

    async function play() {
      try {
        await video!.play()
        if (!started || currentWait) onPlaying()
      } catch (error) {
        if (finished || failure) return
        if (
          error instanceof DOMException &&
          (error.name === 'NotAllowedError' || error.name === 'AbortError')
        ) {
          if (video!.paused) {
            startPaused = true
            endWait()
            update(true)
            if (!started) setState('ready')
          }
        } else {
          onMediaError()
        }
      }
    }
    applyPaused.current = (paused) => {
      if (finished || failure) return
      const pending = pendingSeek.current
      if (pending && pending.request !== request) {
        const next = { ...pending.request, paused }
        pendingSeek.current = { ...pending, request: next }
        setRequest(next)
        return
      }
      startPaused = paused
      if (initialSeek) {
        setMedia((current) => ({ ...current, paused }))
        return
      }
      if (paused) {
        if (!video!.paused) video!.pause()
        // A seek may already have landed while playback was waiting to resume.
        if (!video!.seeking && !pendingSeek.current && !initialSeek) endWait()
        if (!started) {
          if (currentWait?.operation !== 'seeking') endWait()
          setState('ready')
        }
      } else if (video!.paused) {
        if (!currentWait) beginWait(started ? 'buffering' : 'preparing', time)
        void play()
      }
    }
    function onMetadata() {
      if (
        !initialSeek ||
        !stream ||
        !attached ||
        finished ||
        failure ||
        video!.readyState < HTMLMediaElement.HAVE_METADATA
      )
        return
      const position = target.start - stream.offset
      if (position > 0 && Number.isFinite(video!.duration)) {
        video!.currentTime = Math.min(
          position,
          Math.max(0, video!.duration - 0.1),
        )
      }
      initialSeek = false
      clockAtWait = video!.currentTime
      if (!video!.seeking && pendingSeek.current?.request === request)
        pendingSeek.current = undefined
      update(true)
      if (startPaused) {
        if (currentWait?.operation !== 'seeking' || !video!.seeking) endWait()
        setState('ready')
      } else {
        void play()
      }
    }
    function onPlaying() {
      if (
        finished ||
        failure ||
        !stream ||
        !attached ||
        initialSeek ||
        video!.paused ||
        video!.ended ||
        video!.seeking ||
        video!.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      )
        return
      startPaused = false
      if (pendingSeek.current?.request === request)
        pendingSeek.current = undefined
      endWait()
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
      if (
        !attached ||
        finished ||
        failure ||
        video!.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
      )
        return
      if (started && !video!.paused && !video!.ended && !currentWait)
        beginWait('buffering', video!.currentTime + (stream?.offset ?? 0))
      update(true)
    }
    function onFrame() {
      if (
        attached &&
        !finished &&
        !failure &&
        video!.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      )
        setHasFrame(true)
    }
    function onDataAvailable() {
      onMetadata()
      onFrame()
      if (currentWait) update(true)
    }
    function onTimeUpdate() {
      if (
        currentWait &&
        stream &&
        !finished &&
        !failure &&
        !initialSeek &&
        !video!.paused &&
        !video!.seeking &&
        !video!.ended &&
        video!.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video!.currentTime > clockAtWait
      ) {
        onPlaying()
      }
      update()
    }
    function onPause() {
      if (finished || failure || !attached || !video!.paused) return
      update(true)
      if (
        !initialSeek &&
        (currentWait?.operation !== 'seeking' ||
          (!video!.seeking && !pendingSeek.current))
      ) {
        startPaused = true
        endWait()
        if (!started) setState('ready')
      }
      sendProgress()
    }
    function onSeeked() {
      if (initialSeek || video!.seeking || finished || failure) return
      if (pendingSeek.current?.request === request)
        pendingSeek.current = undefined
      if (currentWait?.operation === 'seeking' && video!.paused) endWait()
      update(true)
      sendProgress()
    }
    function onEnded() {
      if (finished || failure || !attached || !video!.ended) return
      endWait()
      update(true)
      setEnded(true)
    }
    function onSettings() {
      settings.current = {
        volume: video!.volume,
        muted: video!.muted,
        rate: video!.playbackRate,
      }
      if (attached) update(true)
      else {
        const changed = settings.current
        setMedia((current) => ({ ...current, ...changed }))
      }
    }

    video.volume = settings.current.volume
    video.muted = settings.current.muted
    video.playbackRate = settings.current.rate
    const listeners: [string, EventListener][] = [
      ['loadedmetadata', onMetadata],
      ['loadeddata', onDataAvailable],
      ['canplay', onDataAvailable],
      ['playing', onPlaying],
      ['waiting', onWaiting],
      ['pause', onPause],
      [
        'seeking',
        () => {
          if (
            stream &&
            attached &&
            video!.seeking &&
            (started || pendingSeek.current?.request === request)
          ) {
            beginWait(
              'seeking',
              pendingSeek.current?.position ??
                video!.currentTime + stream.offset,
            )
          }
          update(true)
        },
      ],
      ['seeked', onSeeked],
      ['ended', onEnded],
      ['error', onMediaError],
      ['timeupdate', onTimeUpdate],
      ['progress', () => update()],
      ['volumechange', onSettings],
      ['ratechange', onSettings],
    ]
    for (const [type, listener] of listeners)
      video.addEventListener(type, listener)
    document.addEventListener('visibilitychange', checkInactivity)
    scheduleCheck()
    const interval = setInterval(sendProgress, 10_000)

    function stop(keepalive = false) {
      if (finished) return pendingReports.current
      update(true)
      const info = snapshot()
      finished = true
      abort.abort()
      clearTimeout(timer)
      clearInterval(interval)
      for (const [type, listener] of listeners)
        video!.removeEventListener(type, listener)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', checkInactivity)
      destroyHls?.()
      video!.pause()
      video!.removeAttribute('src')
      video!.load()
      active.current = undefined
      applyPaused.current = () => {}
      requestSeek.current = () => {}
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
        if (finished || failure) return
        if (pendingSeek.current?.request === request)
          target = { ...target, start: pendingSeek.current.position }
        if (target.start !== request.target.start)
          setMedia((current) => ({ ...current, position: target.start }))
        beginWait(
          request.operation === 'seeking' ? 'seeking' : 'preparing',
          target.start,
        )
        time = target.start
        const negotiated = await api.stream(
          video,
          target,
          request.options,
          abort.signal,
        )
        if (finished || failure) {
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
        inactivity = new PlaybackInactivity(Date.now())
        active.current = { target, stream }
        setPlayback({ ...active.current, request })
        if (stream.hls) {
          const { attachHls } = await import('./hls-engine.ts')
          if (!finished && !failure) {
            attached = true
            destroyHls = attachHls(
              video,
              stream.url,
              target.start,
              onMediaError,
            )
          }
        } else {
          attached = true
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

  const refreshSubtitles = useCallback(
    (itemId: string, fresh: MediaSourceInfo[]) => {
      const current = active.current
      if (!current || current.target.id !== itemId) return
      const latest = fresh.find(
        (source) => source.Id === current.stream.source.Id,
      )
      if (!latest) return
      const previous = current.stream
      const stream = {
        ...previous,
        source: refreshSubtitleSource(previous.source, latest),
        sources: previous.sources.map((source) => {
          const replacement = fresh.find((entry) => entry.Id === source.Id)
          return replacement
            ? refreshSubtitleSource(source, replacement)
            : source
        }),
      }
      active.current = { ...current, stream }
      if (versions.current?.id === itemId)
        versions.current = { id: itemId, sources: stream.sources }
      setPlayback((value) =>
        value?.stream === previous ? { ...value, stream } : value,
      )
      // The active video element, stream URL, playback request and session stay intact.
    },
    [],
  )
  function restart(options: StreamOptions, saveQuality = false) {
    const resume = recovery.current()
    const next: Request = {
      ...resume,
      since: Date.now(),
      operation: 'preparing',
      options: { ...resume.options, ...options },
      preferredBitrate: saveQuality ? options.bitrate : resume.preferredBitrate,
    }
    if (pendingSeek.current)
      pendingSeek.current = { request: next, position: next.target.start }
    setRequest(next)
  }
  function seek(seconds: number) {
    const video = videoRef.current
    if (
      !video ||
      state === 'error' ||
      state === 'stopped' ||
      !Number.isFinite(seconds)
    )
      return
    const duration = active.current ? media.duration : 0
    const position = Math.max(0, Math.min(duration || Infinity, seconds))
    const offset = active.current?.stream.offset ?? 0
    if (
      !active.current ||
      !Number.isFinite(video.duration) ||
      position < offset ||
      (pendingSeek.current && pendingSeek.current.request !== request)
    ) {
      const current = pendingSeek.current?.request ?? request
      const next: Request = {
        ...current,
        operation: 'seeking',
        since: wait?.operation === 'seeking' ? wait.since : Date.now(),
        target: {
          ...(active.current?.target ?? current.target),
          start: position,
        },
        paused: recovery.current().paused,
      }
      pendingSeek.current = { request: next, position }
      setRequest(next)
    } else {
      pendingSeek.current = { request, position }
      video.currentTime = Math.min(video.duration, position - offset)
      // Browsers need not emit seeked when seeking to the current position.
      if (!video.seeking) pendingSeek.current = undefined
      else requestSeek.current(position)
    }
    setMedia((current) => ({
      ...current,
      position,
      seeking: Boolean(pendingSeek.current),
      bufferedAhead: 0,
    }))
    setEnded(false)
  }
  return {
    videoRef,
    playback,
    state,
    media,
    problem,
    ended,
    hasFrame,
    wait,
    preferences,
    report,
    options: request.options,
    preferredBitrate: request.preferredBitrate,
    requestedTarget:
      playback?.request === request ? playback.target : request.target,
    requestIsActive: playback?.request === request,
    requestedPaused: request.paused,
    seek,
    isPaused: () => readPaused.current(),
    setPaused: (paused: boolean) => applyPaused.current(paused),
    replaceStream(options: StreamOptions) {
      restart(options, 'bitrate' in options)
    },
    recoverAtBitrate(bitrate: number) {
      restart({ bitrate, forceTranscode: true })
    },
    refreshSubtitles,
    open(target: PlaybackTarget, paused = false) {
      pendingSeek.current = undefined
      setRequest({
        target,
        paused,
        operation: 'opening',
        since: Date.now(),
        preferredBitrate: request.preferredBitrate,
        options: { bitrate: request.options.bitrate },
      })
    },
    retry() {
      restart({})
    },
    async close() {
      setState('stopped')
      await cleanup.current()
    },
  }
}
