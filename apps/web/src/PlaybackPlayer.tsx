import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, Play, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { toMediaItem, type MediaItem } from '@hollyfilms/shared/library'
import { PlayerShell } from './ui/PlayerShell.tsx'
import { PlayerControls } from './ui/PlayerControls.tsx'
import { timelinePreview } from './playback/timeline-preview.ts'
import { formatTime } from './playback/format-time.ts'
import { PlayerArtwork } from './ui/PlayerArtwork.tsx'
import {
  createPlaybackApi,
  itemTarget,
  ticksPerSecond,
  trackName,
} from './playback/playback-api.ts'
import { usePlayback } from './playback/use-playback.ts'
import { usePlayerSubtitles } from './playback/use-player-subtitles.ts'
import { useSyncPlay } from './playback/use-sync-play.ts'
import { usePlaybackDevices } from './playback/use-playback-devices.ts'
import { useMediaSession } from './playback/use-media-session.ts'
import type { PlaybackTarget, StreamOptions } from './playback/playback-api.ts'
import type { RemoteControlMessage } from './playback/remote-commands.ts'
import {
  readPlaybackPreferences,
  savePlaybackPreferences,
} from './playback/preferences.ts'

const segmentLabels: Record<string, string> = {
  Intro: 'Passer l’introduction',
  Outro: 'Passer le générique',
  Recap: 'Passer le résumé',
  Preview: 'Passer l’aperçu',
  Commercial: 'Passer la publicité',
}

const qualities = [
  [0, 'Automatique'],
  [40_000_000, '40 Mb/s'],
  [20_000_000, '20 Mb/s'],
  [10_000_000, '10 Mb/s'],
  [6_000_000, '6 Mb/s'],
  [3_000_000, '3 Mb/s'],
  [1_500_000, '1,5 Mb/s'],
  [720_000, '720 kb/s'],
  [420_000, '420 kb/s'],
] as const

export function PlaybackPlayer({
  item,
  session,
  userId,
  resume,
  onClose,
  initialOptions,
  initialQueue,
  queuedNext,
  queuedLast,
  remoteCommand,
}: {
  item: MediaItem
  session: JellyfinSession
  userId: string
  resume: boolean
  onClose: () => void
  initialOptions?: StreamOptions
  initialQueue?: PlaybackTarget[]
  queuedNext?: PlaybackTarget[]
  queuedLast?: PlaybackTarget[]
  remoteCommand?: RemoteControlMessage
}) {
  const queryClient = useQueryClient()
  const api = useMemo(
    () => createPlaybackApi(session, userId),
    [session, userId],
  )
  const [saved] = useState(() => readPlaybackPreferences(userId))
  const player = usePlayback(
    api,
    {
      id: item.id,
      title: item.episode ? item.title + ' · ' + item.episode : item.title,
      kind: item.kind,
      seriesId: item.seriesId,
      start: resume ? (item.playbackPosition ?? 0) : 0,
    },
    { bitrate: saved.bitrate || undefined, ...initialOptions },
    {
      volume: saved.volume,
      muted: saved.muted,
      rate: saved.rate,
    },
  )
  const {
    playback,
    videoRef,
    media: localMedia,
    state: localState,
    preferences,
  } = player
  const devices = usePlaybackDevices(api)
  const closing = useRef(false)
  const media = devices.destination ? devices.status : localMedia
  const state = devices.destination ? 'playing' : localState
  const target = devices.target ?? playback?.target
  const source = playback?.stream.source
  const reduced = useReducedMotion()
  const [menu, setMenu] = useState<
    | 'settings'
    | 'subtitles'
    | 'queue'
    | 'stats'
    | 'chapters'
    | 'trailers'
    | 'sync'
    | 'devices'
    | 'lyrics'
  >()
  const [groupName, setGroupName] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [pip, setPip] = useState(false)
  const [fit, setFit] = useState(saved.fit)
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | undefined>(
    initialOptions?.subtitle,
  )
  const [secondarySubtitle, setSecondarySubtitle] = useState(-1)
  const [subtitleDelay, setSubtitleDelay] = useState(0)
  const [subtitleScale, setSubtitleScale] = useState(saved.subtitleScale)
  const [subtitleColor, setSubtitleColor] = useState(saved.subtitleColor)
  const [autoNext, setAutoNext] = useState(saved.autoNext)
  const [askAfterEpisodes, setAskAfterEpisodes] = useState(
    saved.askAfterEpisodes,
  )
  const [continueNext, setContinueNext] = useState<PlaybackTarget>()
  const watched = useRef(0)
  const [repeat, setRepeat] = useState<
    'RepeatNone' | 'RepeatOne' | 'RepeatAll'
  >('RepeatNone')
  const [shuffle, setShuffle] = useState(false)
  const [subtitleProblem, setSubtitleProblem] = useState('')
  const [controlsHovered, setControlsHovered] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const video = videoRef.current
  const targetId = target?.id ?? (item.kind === 'Série' ? undefined : item.id)
  const details = useQuery({
    queryKey: ['playback-details', session.deviceId, targetId],
    queryFn: ({ signal }) => api.details(targetId!, signal),
    enabled: Boolean(targetId),
    retry: false,
    staleTime: 60_000,
  })
  const segments = useQuery({
    queryKey: ['playback-segments', session.deviceId, targetId],
    queryFn: ({ signal }) => api.segments(targetId!, signal),
    enabled: Boolean(targetId),
    retry: false,
    staleTime: 60_000,
  })
  const queue = useQuery({
    queryKey: [
      'playback-queue',
      session.deviceId,
      target?.seriesId ?? target?.id,
    ],
    queryFn: ({ signal }) => api.queue(target!, signal),
    enabled: Boolean(target),
    retry: false,
    staleTime: 60_000,
  })
  const trailers = useQuery({
    queryKey: ['playback-trailers', session.deviceId, item.id],
    queryFn: () => api.trailers(item.id),
    enabled: menu === 'trailers',
    retry: false,
  })
  const lyrics = useQuery({
    queryKey: ['playback-lyrics', session.deviceId, targetId],
    queryFn: ({ signal }) => api.lyrics(targetId!, signal),
    enabled: menu === 'lyrics' && Boolean(targetId),
    retry: false,
  })
  const currentQueue = useMemo(() => {
    const items = initialQueue ?? queue.data ?? (target ? [target] : [])
    const insertion = items.findIndex((entry) => entry.id === target?.id) + 1
    const combined = [
      ...items.slice(0, insertion),
      ...(queuedNext ?? []),
      ...items.slice(insertion),
      ...(queuedLast ?? []),
    ]
    return [...new Map(combined.map((entry) => [entry.id, entry])).values()]
  }, [initialQueue, queue.data, target, queuedNext, queuedLast])
  const sync = useSyncPlay(api, videoRef, {
    target: playback?.target,
    queue: currentQueue,
    position: localMedia.position,
    seek: player.seek,
    open: player.open,
  })
  const index = currentQueue.findIndex((entry) => entry.id === target?.id)
  const previous = index > 0 ? currentQueue[index - 1] : undefined
  const next =
    currentQueue[index + 1] ??
    (repeat === 'RepeatAll' && currentQueue.length > 1
      ? currentQueue[0]
      : undefined)
  const tracks = source?.MediaStreams ?? []
  const audioOnly = Boolean(
    source && !tracks.some((track) => track.Type === 'Video'),
  )
  const audio = tracks.filter(
    (track) => track.Type === 'Audio' && track.Index != null,
  )
  const subtitles = tracks.filter(
    (track) => track.Type === 'Subtitle' && track.Index != null,
  )
  const primary = selectedSubtitle ?? source?.DefaultSubtitleStreamIndex ?? -1
  const primaryTrack = subtitles.find((track) => track.Index === primary)
  const secondaryTrack = subtitles.find(
    (track) => track.Index === secondarySubtitle && track.Index !== primary,
  )
  const captions = usePlayerSubtitles({
    api,
    videoRef,
    playback: devices.destination ? undefined : playback,
    primary: player.options.burnSubtitle ? undefined : primaryTrack,
    secondary: secondaryTrack,
    delay: subtitleDelay,
    onError: setSubtitleProblem,
  })
  const chapters = details.data?.Chapters ?? []
  const activeSegment = segments.data?.find(
    (segment) =>
      segment.Type &&
      segmentLabels[segment.Type] &&
      media.position >= (segment.StartTicks ?? 0) / ticksPerSecond &&
      media.position < (segment.EndTicks ?? 0) / ticksPerSecond,
  )
  const statusVisible = state === 'playing' || state === 'ready'
  const showControls =
    statusVisible &&
    (controlsVisible || controlsHovered || media.paused || Boolean(menu))
  const currentLyric = lyrics.data?.findLastIndex(
    (line) =>
      line.Start != null && line.Start / ticksPerSecond <= media.position,
  )

  const scheduleControlsHide = useCallback(() => {
    clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setControlsVisible(false), 3500)
  }, [])

  useEffect(() => {
    if (statusVisible && !media.paused) scheduleControlsHide()
    return () => clearTimeout(controlsTimer.current)
  }, [statusVisible, media.paused, scheduleControlsHide])

  useEffect(() => {
    savePlaybackPreferences(userId, {
      volume: localMedia.volume,
      muted: localMedia.muted,
      rate: localMedia.rate,
      fit,
      subtitleScale,
      subtitleColor,
      autoNext,
      askAfterEpisodes,
      bitrate: player.options.bitrate ?? 0,
    })
  }, [
    userId,
    localMedia.volume,
    localMedia.muted,
    localMedia.rate,
    fit,
    subtitleScale,
    subtitleColor,
    autoNext,
    askAfterEpisodes,
    player.options.bitrate,
  ])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    const syncFullscreen = () =>
      setFullscreen(Boolean(document.fullscreenElement))
    const onEnter = () => setPip(true)
    const onExit = () => setPip(false)
    document.addEventListener('fullscreenchange', syncFullscreen)
    element.addEventListener('enterpictureinpicture', onEnter)
    element.addEventListener('leavepictureinpicture', onExit)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen)
      element.removeEventListener('enterpictureinpicture', onEnter)
      element.removeEventListener('leavepictureinpicture', onExit)
    }
  }, [videoRef])

  useEffect(() => {
    preferences.current.queue = currentQueue
    preferences.current.repeat = repeat
    preferences.current.shuffle = shuffle
    preferences.current.audio = player.options.audio
    preferences.current.subtitle = primary
  }, [
    preferences,
    currentQueue,
    repeat,
    shuffle,
    player.options.audio,
    primary,
  ])

  function revealControls() {
    setControlsVisible(true)
    scheduleControlsHide()
  }

  function holdControls(hovered: boolean) {
    setControlsHovered(hovered)
    if (!hovered) revealControls()
  }

  function open(entry: NonNullable<typeof target>, start = entry.start) {
    setSelectedSubtitle(undefined)
    setSecondarySubtitle(-1)
    setSubtitleProblem('')
    setContinueNext(undefined)
    setMenu(undefined)
    player.open({ ...entry, start })
  }

  // Ended is reset when the new load takes ownership of the video element.
  useEffect(() => {
    if (!player.ended || !target || devices.destination) return
    if (sync.group) {
      sync.step(1)
      return
    }
    if (repeat === 'RepeatOne') {
      player.seek(0)
      void videoRef.current?.play().catch(() => {})
    } else if (autoNext && next) {
      const choices = shuffle
        ? currentQueue.filter((entry) => entry.id !== target.id)
        : []
      const following = choices.length
        ? choices[Math.floor(Math.random() * choices.length)]
        : next
      if (target.kind === 'Épisode') watched.current++
      if (askAfterEpisodes && watched.current >= 3) {
        setContinueNext(following)
      } else open(following)
    }
    // Only handle the transition into the ended state.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [player.ended])

  function close() {
    if (closing.current) return
    closing.current = true
    if (document.pictureInPictureElement)
      void document.exitPictureInPicture().catch(() => {})
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {})
    // Stop media synchronously; reports and remote teardown must not block navigation.
    const cleanup = Promise.allSettled([
      sync.leave(),
      devices.disconnect(),
      player.close(),
    ])
    onClose()
    void cleanup.then(() => {
      void queryClient.invalidateQueries({ queryKey: ['library'] })
      void queryClient.invalidateQueries({ queryKey: ['library-resume'] })
    })
  }

  function fullscreenToggle() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      const element = videoRef.current
      const viewport = element?.closest('.player-viewport')
      if (viewport?.requestFullscreen)
        void viewport.requestFullscreen().catch(() => {})
      else
        (
          element as
            (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
        )?.webkitEnterFullscreen?.()
    }
  }

  function toggle() {
    if (devices.destination) devices.toggle()
    else if (sync.group) sync.toggle()
    else player.toggle()
  }
  function seek(seconds: number) {
    if (devices.destination) devices.seek(seconds)
    else if (sync.group) sync.seek(seconds)
    else player.seek(seconds)
  }
  function step(direction: -1 | 1) {
    if (devices.destination) devices.step(direction)
    else if (sync.group) sync.step(direction)
    else {
      const entry = direction > 0 ? next : previous
      if (entry) open(entry)
    }
  }
  function volume(value: number) {
    if (devices.destination) {
      devices.volume(Math.max(0, Math.min(1, value)))
      return
    }
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, value))
      videoRef.current.muted = false
    }
  }
  function mute() {
    if (devices.destination) {
      devices.mute()
      return
    }
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted
  }
  function subtitle(value: number) {
    setSelectedSubtitle(value)
    setSubtitleProblem('')
    preferences.current.subtitle = value
    if (player.options.burnSubtitle) {
      player.replaceStream({
        subtitle: value,
        burnSubtitle: false,
        forceTranscode: Boolean(
          player.options.audio != null || player.options.bitrate,
        ),
      })
    } else {
      player.report.current()
    }
  }
  function audioSelect(value: number) {
    player.replaceStream({
      audio: value,
      subtitle: primary,
      forceTranscode: true,
    })
  }
  function toggleMenu(nextMenu: typeof menu) {
    setMenu(menu === nextMenu ? undefined : nextMenu)
  }

  useMediaSession(statusVisible ? (target?.title ?? item.title) : undefined, {
    position: media.position,
    duration: media.duration,
    rate: media.rate,
    paused: media.paused,
    toggle,
    seek,
    step,
    stop: () => void close(),
  })

  useEffect(() => {
    if (!remoteCommand) return
    if (remoteCommand.MessageType === 'Playstate') {
      const command = remoteCommand.Data
      switch (command?.Command) {
        case 'Pause':
          if (!media.paused) toggle()
          break
        case 'Unpause':
          if (media.paused) toggle()
          break
        case 'PlayPause':
          toggle()
          break
        case 'Stop':
          void close()
          break
        case 'Seek':
          seek((command.SeekPositionTicks ?? 0) / ticksPerSecond)
          break
        case 'PreviousTrack':
          step(-1)
          break
        case 'NextTrack':
          step(1)
          break
        case 'Rewind':
          seek(media.position - 10)
          break
        case 'FastForward':
          seek(media.position + 30)
          break
      }
    } else {
      const command = remoteCommand.Data
      const args = command?.Arguments
      switch (command?.Name) {
        case 'Mute':
          if (!media.muted) mute()
          break
        case 'Unmute':
          if (media.muted) mute()
          break
        case 'ToggleMute':
          mute()
          break
        case 'SetVolume':
          if (Number.isFinite(Number(args?.Volume)))
            volume(Number(args?.Volume) / 100)
          break
        case 'VolumeUp':
          volume(media.volume + 0.05)
          break
        case 'VolumeDown':
          volume(media.volume - 0.05)
          break
        case 'SetAudioStreamIndex':
          if (Number.isInteger(Number(args?.Index)))
            audioSelect(Number(args?.Index))
          break
        case 'SetSubtitleStreamIndex':
          if (Number.isInteger(Number(args?.Index)))
            subtitle(Number(args?.Index))
          break
        case 'ToggleFullscreen':
          fullscreenToggle()
          break
      }
    }
    // Server commands execute once per message, using the current controls.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [remoteCommand])

  function trickplay(position: number) {
    return timelinePreview(details.data, source?.Id, position, api.previewUrl)
  }

  const artworkItem =
    details.data && details.data.Id === targetId
      ? toMediaItem(details.data)
      : item

  return (
    <PlayerShell
      title={target?.title ?? item.title}
      state={state}
      problem={player.problem}
      showHeading={!statusVisible || showControls}
      onInteraction={revealControls}
      onBackHover={holdControls}
      onClose={() => void close()}
      onRetry={player.retry}
    >
      <div
        className="player-stage"
        onKeyDown={(event) => {
          if (
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLSelectElement
          )
            return
          const key = event.key.toLowerCase()
          if (key === 'escape' && menu) {
            event.preventDefault()
            setMenu(undefined)
            return
          }
          if (key === ' ' && event.target instanceof HTMLButtonElement) return
          const actions: Record<string, () => void> = {
            ' ': toggle,
            k: toggle,
            j: () => seek(media.position - 10),
            l: () => seek(media.position + 30),
            arrowleft: () => seek(media.position - 10),
            arrowright: () => seek(media.position + 30),
            arrowup: () => volume(media.volume + 0.05),
            arrowdown: () => volume(media.volume - 0.05),
            m: mute,
            f: fullscreenToggle,
            c: () => subtitle(primary >= 0 ? -1 : (subtitles[0]?.Index ?? -1)),
            pagedown: () =>
              player.seek(
                (chapters.findLast(
                  (chapter) =>
                    (chapter.StartPositionTicks ?? 0) / ticksPerSecond <
                    media.position - 2,
                )?.StartPositionTicks ?? 0) / ticksPerSecond,
              ),
            pageup: () => {
              const next = chapters.find(
                (chapter) =>
                  (chapter.StartPositionTicks ?? 0) / ticksPerSecond >
                  media.position + 1,
              )
              if (next?.StartPositionTicks != null)
                seek(next.StartPositionTicks / ticksPerSecond)
            },
          }
          if (actions[key]) {
            event.preventDefault()
            actions[key]()
            revealControls()
          }
        }}
      >
        <video
          ref={videoRef}
          className="player-video"
          playsInline
          preload="auto"
          tabIndex={0}
          aria-label={'Lecture de ' + (target?.title ?? item.title)}
          style={{ objectFit: fit }}
          onClick={statusVisible ? toggle : undefined}
          onDoubleClick={fullscreenToggle}
        />
        <PlayerArtwork
          source={
            artworkItem?.backdrop ??
            artworkItem?.poster ??
            item.backdrop ??
            item.poster
          }
          session={session}
          visible={!devices.destination && (!player.hasFrame || audioOnly)}
        />
        {(captions.primary || captions.secondary) && (
          <div
            className="player-captions"
            data-controls={showControls}
            style={{
              color: subtitleColor,
              fontSize:
                'calc(clamp(15px, 2.6vw, 34px) * ' + subtitleScale + ')',
            }}
          >
            {captions.secondary && <p>{captions.secondary}</p>}
            {captions.primary && <p>{captions.primary}</p>}
          </div>
        )}
        {state === 'ready' && media.paused && (
          <motion.button
            type="button"
            className="player-big-play"
            aria-label="Démarrer la lecture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={toggle}
          >
            <Play fill="currentColor" />
          </motion.button>
        )}
        {devices.destination && (
          <div className="player-remote-status">
            <p>Diffusion sur {devices.destination.label}</p>
          </div>
        )}
        {(player.buffering || state === 'loading') && !devices.destination && (
          <div
            className="player-buffer-indicator"
            role="status"
            aria-label="Mise en mémoire tampon"
          >
            <LoaderCircle className="player-spinner" />
          </div>
        )}
        {statusVisible && activeSegment?.Type && (
          <motion.button
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="player-skip glass-control"
            type="button"
            onClick={() =>
              player.seek((activeSegment.EndTicks ?? 0) / ticksPerSecond)
            }
          >
            {segmentLabels[activeSegment.Type]}
          </motion.button>
        )}
        {statusVisible && player.ended && !autoNext && next && (
          <motion.button
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="player-skip glass-control"
            type="button"
            onClick={() => open(next)}
          >
            Lire l’épisode suivant
          </motion.button>
        )}
        {continueNext && (
          <motion.button
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="player-skip glass-control"
            type="button"
            onClick={() => {
              watched.current = 0
              open(continueNext)
            }}
          >
            Toujours là ? Continuer
          </motion.button>
        )}
        {statusVisible && (
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 28 }}
            animate={{
              opacity: showControls ? 1 : 0,
              y: reduced || showControls ? 0 : 14,
            }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 36,
              opacity: { duration: reduced ? 0 : 0.16 },
            }}
            className="player-controls-layer"
            onPointerEnter={() => holdControls(true)}
            onPointerLeave={() => holdControls(false)}
            data-visible={showControls}
            inert={!showControls}
          >
            <PlayerControls
              media={media}
              fullscreen={fullscreen}
              pip={pip}
              hasPrevious={Boolean(previous)}
              hasNext={Boolean(next)}
              subtitles={primary >= 0}
              onToggle={toggle}
              onSeek={seek}
              onVolume={volume}
              onMute={mute}
              onPrevious={() => step(-1)}
              onNext={() => step(1)}
              onFullscreen={fullscreenToggle}
              onPip={
                !devices.destination &&
                document.pictureInPictureEnabled &&
                video?.requestPictureInPicture
                  ? () => {
                      if (document.pictureInPictureElement)
                        void document.exitPictureInPicture().catch(() => {})
                      else void video.requestPictureInPicture().catch(() => {})
                    }
                  : undefined
              }
              onSubtitles={
                !devices.destination && subtitles.length
                  ? () => toggleMenu('subtitles')
                  : undefined
              }
              onSettings={() => toggleMenu('settings')}
              onPreview={trickplay}
              loadPreview={api.previewImage}
              markers={chapters.map((chapter) => ({
                position: (chapter.StartPositionTicks ?? 0) / ticksPerSecond,
                label: chapter.Name ?? 'Chapitre',
              }))}
            />
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {menu && statusVisible && (
            <motion.section
              key={menu}
              className="player-menu glass-panel"
              aria-label="Options du lecteur"
              initial={{
                opacity: 0,
                y: reduced ? 0 : 12,
                scale: reduced ? 1 : 0.97,
              }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: reduced ? 0 : 8,
                transition: { duration: reduced ? 0 : 0.1 },
              }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 36,
                opacity: { duration: reduced ? 0 : 0.14 },
              }}
            >
              <header>
                <h2>
                  {
                    {
                      settings: 'Lecture',
                      subtitles: 'Sous-titres',
                      queue: 'File de lecture',
                      stats: 'Statistiques',
                      chapters: 'Chapitres',
                      trailers: 'Bandes-annonces',
                      sync: 'SyncPlay',
                      devices: 'Diffusion',
                      lyrics: 'Paroles',
                    }[menu]
                  }
                </h2>
                <button
                  className="player-icon"
                  type="button"
                  aria-label="Fermer les options"
                  onClick={() => setMenu(undefined)}
                >
                  <X size={18} />
                </button>
              </header>
              {menu === 'settings' && devices.destination && (
                <div className="player-menu-actions">
                  <button type="button" onClick={() => setMenu('devices')}>
                    Diffusion
                  </button>
                </div>
              )}
              {menu === 'settings' && !devices.destination && (
                <>
                  <label>
                    Qualité
                    <select
                      aria-label="Qualité"
                      value={player.options.bitrate ?? 0}
                      onChange={(event) => {
                        const bitrate = Number(event.target.value)
                        player.replaceStream({
                          bitrate: bitrate || undefined,
                          forceTranscode: Boolean(
                            bitrate ||
                            player.options.audio != null ||
                            player.options.burnSubtitle,
                          ),
                          subtitle: primary,
                        })
                      }}
                    >
                      {qualities.map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </label>
                  {audio.length > 0 && (
                    <label>
                      Audio
                      <select
                        aria-label="Audio"
                        value={
                          player.options.audio ??
                          source?.DefaultAudioStreamIndex ??
                          audio[0].Index
                        }
                        onChange={(event) =>
                          audioSelect(Number(event.target.value))
                        }
                      >
                        {audio.map((track) => (
                          <option key={track.Index} value={track.Index}>
                            {trackName(track)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {playback && playback.stream.sources.length > 1 && (
                    <label>
                      Version
                      <select
                        value={source?.Id}
                        onChange={(event) => {
                          setSelectedSubtitle(undefined)
                          setSecondarySubtitle(-1)
                          player.replaceStream({
                            sourceId: event.target.value,
                            audio: undefined,
                            subtitle: undefined,
                            burnSubtitle: false,
                            forceTranscode: Boolean(player.options.bitrate),
                          })
                        }}
                      >
                        {playback.stream.sources
                          .filter((version) => version.Id)
                          .map((version) => (
                            <option key={version.Id} value={version.Id!}>
                              {version.Name ?? version.Container}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Vitesse
                    <select
                      value={media.rate}
                      onChange={(event) => {
                        if (videoRef.current)
                          videoRef.current.playbackRate = Number(
                            event.target.value,
                          )
                      }}
                    >
                      {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}×
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Image
                    <select
                      value={fit}
                      onChange={(event) =>
                        setFit(event.target.value as typeof fit)
                      }
                    >
                      <option value="contain">Originale</option>
                      <option value="cover">Remplir</option>
                      <option value="fill">Étirer</option>
                    </select>
                  </label>
                  <label>
                    Répéter
                    <select
                      value={repeat}
                      onChange={(event) =>
                        setRepeat(event.target.value as typeof repeat)
                      }
                    >
                      <option value="RepeatNone">Désactivé</option>
                      <option value="RepeatOne">Titre actuel</option>
                      <option value="RepeatAll">Toute la file</option>
                    </select>
                  </label>
                  <label>
                    Lecture automatique
                    <input
                      type="checkbox"
                      checked={autoNext}
                      onChange={(event) => setAutoNext(event.target.checked)}
                    />
                  </label>
                  <label>
                    Confirmer après 3 épisodes
                    <input
                      type="checkbox"
                      checked={askAfterEpisodes}
                      onChange={(event) =>
                        setAskAfterEpisodes(event.target.checked)
                      }
                    />
                  </label>
                  {currentQueue.length > 1 && (
                    <label>
                      Lecture aléatoire
                      <input
                        type="checkbox"
                        checked={shuffle}
                        onChange={(event) => setShuffle(event.target.checked)}
                      />
                    </label>
                  )}
                  <div className="player-menu-actions">
                    {subtitles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMenu('subtitles')}
                      >
                        Sous-titres
                      </button>
                    )}
                    {currentQueue.length > 1 && !sync.group && (
                      <button type="button" onClick={() => setMenu('queue')}>
                        File de lecture
                      </button>
                    )}
                    {chapters.length > 0 && (
                      <button type="button" onClick={() => setMenu('chapters')}>
                        Chapitres
                      </button>
                    )}
                    <button type="button" onClick={() => setMenu('trailers')}>
                      Bandes-annonces
                    </button>
                    <button type="button" onClick={() => setMenu('stats')}>
                      Statistiques
                    </button>
                    {audioOnly && (
                      <button type="button" onClick={() => setMenu('lyrics')}>
                        Paroles
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMenu('sync')
                        void sync.list()
                      }}
                    >
                      SyncPlay
                    </button>
                    {!sync.group && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenu('devices')
                          void devices.list()
                        }}
                      >
                        Diffusion
                      </button>
                    )}
                    {video && 'webkitShowPlaybackTargetPicker' in video && (
                      <button
                        type="button"
                        onClick={() =>
                          (
                            video as HTMLVideoElement & {
                              webkitShowPlaybackTargetPicker: () => void
                            }
                          ).webkitShowPlaybackTargetPicker()
                        }
                      >
                        AirPlay
                      </button>
                    )}
                  </div>
                </>
              )}
              {menu === 'subtitles' && (
                <>
                  <label>
                    Langue
                    <select
                      aria-label="Langue"
                      value={primary}
                      onChange={(event) => subtitle(Number(event.target.value))}
                    >
                      <option value={-1}>Désactivés</option>
                      {subtitles.map((track) => (
                        <option key={track.Index} value={track.Index}>
                          {trackName(track)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Deuxième piste
                    <select
                      value={secondarySubtitle}
                      onChange={(event) =>
                        setSecondarySubtitle(Number(event.target.value))
                      }
                    >
                      <option value={-1}>Désactivée</option>
                      {subtitles
                        .filter(
                          (track) =>
                            track.Index !== primary &&
                            track.IsTextSubtitleStream,
                        )
                        .map((track) => (
                          <option key={track.Index} value={track.Index}>
                            {trackName(track)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Décalage (s)
                    <input
                      type="number"
                      step={0.1}
                      min={-120}
                      max={120}
                      value={subtitleDelay}
                      onChange={(event) =>
                        setSubtitleDelay(Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    Taille
                    <input
                      type="range"
                      min={0.7}
                      max={1.8}
                      step={0.1}
                      value={subtitleScale}
                      onChange={(event) =>
                        setSubtitleScale(Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    Couleur
                    <input
                      type="color"
                      value={subtitleColor}
                      onChange={(event) => setSubtitleColor(event.target.value)}
                    />
                  </label>
                  {subtitleProblem && <p role="alert">{subtitleProblem}</p>}
                  {primary >= 0 &&
                    (subtitleProblem || player.options.burnSubtitle) && (
                      <button
                        type="button"
                        onClick={() => {
                          const burn = !player.options.burnSubtitle
                          setSubtitleProblem('')
                          player.replaceStream({
                            subtitle: primary,
                            burnSubtitle: burn,
                            forceTranscode:
                              burn ||
                              Boolean(
                                player.options.audio != null ||
                                player.options.bitrate,
                              ),
                          })
                        }}
                      >
                        {player.options.burnSubtitle
                          ? 'Afficher dans le navigateur'
                          : 'Incruster dans la vidéo'}
                      </button>
                    )}
                </>
              )}
              {menu === 'queue' &&
                currentQueue.map((entry) => (
                  <button
                    className="player-menu-list"
                    type="button"
                    key={entry.id}
                    aria-current={entry.id === target?.id}
                    onClick={() => open(entry)}
                  >
                    {entry.title}
                  </button>
                ))}
              {menu === 'chapters' &&
                chapters.map((chapter, chapterIndex) => (
                  <button
                    className="player-menu-list"
                    type="button"
                    key={chapterIndex}
                    onClick={() => {
                      player.seek(
                        (chapter.StartPositionTicks ?? 0) / ticksPerSecond,
                      )
                      setMenu(undefined)
                    }}
                  >
                    {formatTime(
                      (chapter.StartPositionTicks ?? 0) / ticksPerSecond,
                    )}{' '}
                    · {chapter.Name ?? 'Chapitre ' + (chapterIndex + 1)}
                  </button>
                ))}
              {menu === 'trailers' && (
                <>
                  {trailers.isPending && <p>Chargement…</p>}
                  {trailers.isError && (
                    <p>Impossible de charger les bandes-annonces.</p>
                  )}
                  {trailers.data?.map((entry) => {
                    const preview = itemTarget(entry)
                    return (
                      preview && (
                        <button
                          className="player-menu-list"
                          type="button"
                          key={preview.id}
                          onClick={() => open(preview, 0)}
                        >
                          {preview.title}
                        </button>
                      )
                    )
                  })}
                  {details.data?.RemoteTrailers?.filter(
                    (entry) => entry.Url && /^https:\/\//i.test(entry.Url),
                  ).map((entry) => (
                    <a
                      className="player-menu-list"
                      key={entry.Url}
                      href={entry.Url!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {entry.Name ?? 'Bande-annonce'}
                    </a>
                  ))}
                  {!trailers.isPending &&
                    !trailers.isError &&
                    !trailers.data?.length &&
                    !details.data?.RemoteTrailers?.length && (
                      <p>Aucune bande-annonce disponible.</p>
                    )}
                </>
              )}
              {menu === 'sync' && (
                <>
                  {sync.group ? (
                    <>
                      <p>
                        {sync.group.GroupName} ·{' '}
                        {sync.group.Participants?.length ?? 1} participant(s)
                      </p>
                      <button type="button" onClick={() => void sync.leave()}>
                        Quitter le groupe
                      </button>
                    </>
                  ) : (
                    <>
                      <label>
                        Nom du groupe
                        <input
                          type="text"
                          value={groupName}
                          onChange={(event) => setGroupName(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void sync.create(groupName)}
                      >
                        Créer un groupe
                      </button>
                      {sync.groups
                        .filter((group) => group.GroupId)
                        .map((group) => (
                          <button
                            className="player-menu-list"
                            type="button"
                            key={group.GroupId}
                            onClick={() => void sync.join(group.GroupId!)}
                          >
                            {group.GroupName}
                          </button>
                        ))}
                      <button type="button" onClick={() => void sync.list()}>
                        Actualiser
                      </button>
                    </>
                  )}
                  {sync.error && <p role="alert">{sync.error}</p>}
                </>
              )}
              {menu === 'devices' && (
                <>
                  {devices.destination ? (
                    <>
                      <p>{devices.destination.label}</p>
                      <button
                        type="button"
                        onClick={() => {
                          const resume = devices.target
                          const position = devices.status.position
                          void devices.disconnect().then(() => {
                            if (resume) open(resume, position)
                          })
                        }}
                      >
                        Reprendre ici
                      </button>
                    </>
                  ) : (
                    <>
                      {devices.devices.map((device) => (
                        <button
                          className="player-menu-list"
                          type="button"
                          key={device.Id}
                          disabled={devices.pending || !target}
                          onClick={() =>
                            target &&
                            devices.connect(
                              device,
                              { ...target, start: media.position },
                              currentQueue,
                              player.close,
                            )
                          }
                        >
                          {device.DeviceName ?? device.Client}
                        </button>
                      ))}
                      {devices.canCast && (
                        <button
                          type="button"
                          disabled={devices.pending || !target}
                          onClick={() =>
                            target &&
                            videoRef.current &&
                            devices.cast(
                              videoRef.current,
                              { ...target, start: media.position },
                              player.close,
                            )
                          }
                        >
                          Google Cast
                        </button>
                      )}
                      {!devices.devices.length && (
                        <p>Aucun autre appareil connecté.</p>
                      )}
                      <button type="button" onClick={() => void devices.list()}>
                        Actualiser
                      </button>
                    </>
                  )}
                  {devices.error && <p role="alert">{devices.error}</p>}
                </>
              )}
              {menu === 'stats' && playback && (
                <dl className="player-stats">
                  <div>
                    <dt>Lecture</dt>
                    <dd>
                      {
                        {
                          DirectPlay: 'Directe',
                          DirectStream: 'Remux',
                          Transcode: 'Transcodage',
                        }[playback.stream.method]
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>Flux</dt>
                    <dd>{playback.stream.hls ? 'HLS' : source?.Container}</dd>
                  </div>
                  <div>
                    <dt>Résolution</dt>
                    <dd>
                      {video?.videoWidth} × {video?.videoHeight}
                    </dd>
                  </div>
                  <div>
                    <dt>Images perdues</dt>
                    <dd>
                      {video?.getVideoPlaybackQuality?.().droppedVideoFrames ??
                        0}
                    </dd>
                  </div>
                  <div>
                    <dt>Tampon</dt>
                    <dd>
                      {Math.max(0, media.buffered - media.position).toFixed(1)}{' '}
                      s
                    </dd>
                  </div>
                  {source?.Bitrate && (
                    <div>
                      <dt>Débit source</dt>
                      <dd>{(source.Bitrate / 1_000_000).toFixed(1)} Mb/s</dd>
                    </div>
                  )}
                </dl>
              )}
              {menu === 'lyrics' && (
                <>
                  {lyrics.isPending && <p>Chargement…</p>}
                  {(lyrics.isError || lyrics.data?.length === 0) && (
                    <p>Paroles indisponibles.</p>
                  )}
                  {lyrics.data?.map((line, index) =>
                    line.Start != null ? (
                      <button
                        className="player-menu-list"
                        type="button"
                        key={index}
                        aria-current={index === currentLyric}
                        onClick={() => seek(line.Start! / ticksPerSecond)}
                      >
                        {line.Text}
                      </button>
                    ) : (
                      <p key={index}>{line.Text}</p>
                    ),
                  )}
                </>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </PlayerShell>
  )
}
