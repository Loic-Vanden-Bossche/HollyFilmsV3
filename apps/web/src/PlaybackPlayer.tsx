import { usePerformanceReducedMotion as useReducedMotion } from './performance/PerformanceProvider.tsx'
import { localizeText, type Message } from './i18n/messages.ts'
import { useI18n } from './i18n/I18nProvider.tsx'
import { Tooltip } from './ui/Tooltip.tsx'
import { languageFlag } from './ui/language-flags.ts'
import { PlayerSessionActions } from './ui/PlayerSessionActions.tsx'
import { SubtitleOffset } from './ui/SubtitleOffset.tsx'
import {
  originalTiming,
  type Correction,
  type SyncSnapshot,
} from '@hollyfilms/shared/subtitle-sync'
import {
  subtitleCapabilities,
  useSubtitleTiming,
} from './playback/subtitle-sync.ts'
import { SubtitlePanel } from './ui/SubtitlePanel.tsx'
import { PlayerSubtitleTools } from './ui/PlayerSubtitleTools.tsx'
import { SubtitleSyncActions } from './ui/SubtitleSyncActions.tsx'
import { SubtitleAppearance } from './ui/SubtitleAppearance.tsx'
import {
  remapSubtitleIndex,
  subtitleRevision,
} from './playback/subtitle-tracks.ts'
import { Select } from './ui/Select.tsx'
import {
  PlayerSettingsPanel,
  type PlayerMenu,
} from './ui/PlayerSettingsPanel.tsx'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { toMediaItem, type MediaItem } from '@hollyfilms/shared/library'
import { PlayerShell } from './ui/PlayerShell.tsx'
import { PlayerCaptions } from './ui/PlayerCaptions.tsx'
import { PlayerControls } from './ui/PlayerControls.tsx'
import { PlayerLoading } from './ui/PlayerLoading.tsx'
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
import { useSubtitleClearance } from './playback/use-subtitle-clearance.ts'
import { useSyncPlay } from './playback/use-sync-play.ts'
import { usePlaybackDevices } from './playback/use-playback-devices.ts'
import { useMediaSession } from './playback/use-media-session.ts'
import type { PlaybackTarget, StreamOptions } from './playback/playback-api.ts'
import type { RemoteControlMessage } from './playback/remote-commands.ts'
import type { AppRoute } from './app-route.ts'
import {
  readPlaybackPreferences,
  savePlaybackPreferences,
} from './playback/preferences.ts'

const segmentLabels: Partial<Record<string, Message>> = {
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
  initialPaused,
  initialSecondarySubtitle,
  onLocationChange,
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
  initialPaused?: boolean
  initialSecondarySubtitle?: number
  onLocationChange?: (location: Partial<AppRoute>, previousId: string) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const stageRef = useRef<HTMLDivElement>(null)
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
    initialPaused,
  )
  const {
    playback,
    videoRef,
    media: localMedia,
    state: localState,
    preferences,
    refreshSubtitles,
  } = player
  const devices = usePlaybackDevices(api)
  const closing = useRef(false)
  const media = devices.destination ? devices.status : localMedia
  const state = devices.destination ? 'playing' : localState
  const target = devices.target ?? playback?.target
  const source = playback?.stream.source
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | undefined>(
    initialOptions?.subtitle,
  )
  const [secondarySubtitle, setSecondarySubtitle] = useState(
    initialOptions?.subtitle === -1 ? -1 : (initialSecondarySubtitle ?? -1),
  )
  const tracks = source?.MediaStreams ?? []
  const subtitles = tracks.filter(
    (track) =>
      track.Type === 'Subtitle' && track.Index != null && track.Index >= 0,
  )
  const requestedPrimary =
    selectedSubtitle ?? source?.DefaultSubtitleStreamIndex
  const primaryTrack = subtitles.find(
    (track) => track.Index === requestedPrimary,
  )
  const primary = primaryTrack?.Index ?? -1
  const secondaryTrack =
    primaryTrack &&
    subtitles.find(
      (track) => track.Index === secondarySubtitle && track.Index !== primary,
    )
  const secondary = secondaryTrack?.Index ?? -1
  const tracksReady = player.requestIsActive && source?.MediaStreams != null
  const locationSubtitle =
    selectedSubtitle != null && tracksReady
      ? primary
      : (selectedSubtitle ?? player.options.subtitle)
  const locationSecondary = tracksReady ? secondary : secondarySubtitle
  // Keep the URL choices through negotiation. Once the tracks arrive, discard
  // expired indices so selecting a primary later cannot revive an orphaned track.
  useEffect(() => {
    if (!tracksReady) return
    if (selectedSubtitle != null && selectedSubtitle !== primary)
      setSelectedSubtitle(primary)
    if (secondarySubtitle !== secondary) setSecondarySubtitle(secondary)
  }, [tracksReady, selectedSubtitle, primary, secondarySubtitle, secondary])
  const locationSource = player.requestIsActive
    ? source?.Id
    : player.options.sourceId
  const requested = player.requestedTarget
  const reportedId = useRef(item.id)
  const locationReady =
    (localState === 'ready' || localState === 'playing') &&
    player.requestIsActive
  const locationTime = Math.floor(
    locationReady ? localMedia.position : requested.start,
  )
  const locationPaused = locationReady
    ? localMedia.paused
    : player.requestedPaused
  useEffect(() => {
    if (localState === 'stopped' || closing.current) return
    onLocationChange?.(
      {
        play: requested.id,
        time: locationTime,
        paused: locationPaused,
        source: locationSource,
        audio: player.options.audio,
        subtitle: locationSubtitle,
        secondarySubtitle: locationSecondary,
      },
      reportedId.current,
    )
    reportedId.current = requested.id
  }, [
    onLocationChange,
    requested.id,
    locationTime,
    locationPaused,
    localState,
    locationSource,
    player.options.audio,
    locationSubtitle,
    locationSecondary,
  ])
  const reduced = useReducedMotion()
  const [menu, setMenu] = useState<PlayerMenu>()
  const menuTrigger = useRef<HTMLElement | null>(null)
  const [groupName, setGroupName] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [pip, setPip] = useState(false)
  const [fit, setFit] = useState(saved.fit)
  type Slot = 'primary' | 'secondary'
  const [editor, setEditor] = useState<{
    opening: number
    key: string
    slot: Slot
    initial?: SyncSnapshot
    draft: Correction
  }>()
  const syncOpening = useRef(0)
  const syncTrigger = useRef<HTMLButtonElement | null>(null)
  const closeOffset = useCallback(() => {
    setEditor(undefined)
    if (syncTrigger.current?.isConnected) {
      syncTrigger.current.focus({ preventScroll: true })
      return
    }
    videoRef.current
      ?.closest('.player-viewport')
      ?.querySelector<HTMLButtonElement>(
        '.player-controls [data-subtitles-trigger]',
      )
      ?.focus({ preventScroll: true })
  }, [videoRef])
  const [subtitleStyles, setSubtitleStyles] = useState(saved.subtitleStyles)
  const filterId = useId()
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
    open: (entry, paused) => open(entry, entry.start, paused),
  })
  const index = currentQueue.findIndex((entry) => entry.id === target?.id)
  const previous = index > 0 ? currentQueue[index - 1] : undefined
  const next =
    currentQueue[index + 1] ??
    (repeat === 'RepeatAll' && currentQueue.length > 1
      ? currentQueue[0]
      : undefined)
  const audioOnly = Boolean(
    source && !tracks.some((track) => track.Type === 'Video'),
  )
  const audio = tracks.filter(
    (track) => track.Type === 'Audio' && track.Index != null,
  )
  const subtitlesKey = useMemo(
    () => subtitleRevision(source?.MediaStreams ?? []),
    [source?.MediaStreams],
  )
  const subtitleSelection = useRef({ primary: -1, secondary: -1 })
  const latestSubtitlePlayback = useRef(playback)
  latestSubtitlePlayback.current = playback
  subtitleSelection.current = { primary, secondary }
  const reloadSubtitles = useCallback(async () => {
    if (!playback) return
    const data = await api.details(
      playback.target.id,
      new AbortController().signal,
    )
    if (
      latestSubtitlePlayback.current?.target.id !== playback.target.id ||
      latestSubtitlePlayback.current?.stream.source.Id !==
        playback.stream.source.Id
    )
      return
    const fresh = data.MediaSources?.length
      ? data.MediaSources
      : [{ Id: data.Id, MediaStreams: data.MediaStreams }]
    const updated = fresh.find(
      (entry) => entry.Id === playback.stream.source.Id,
    )
    if (!updated) return
    const selected = subtitleSelection.current
    const previous =
      latestSubtitlePlayback.current.stream.source.MediaStreams ?? []
    if (
      subtitleRevision(previous) ===
      subtitleRevision(updated.MediaStreams ?? [])
    )
      return

    const remappedPrimary = remapSubtitleIndex(
      previous,
      updated.MediaStreams ?? [],
      selected.primary,
    )
    setSelectedSubtitle(remappedPrimary)
    preferences.current.subtitle = remappedPrimary
    setSecondarySubtitle(
      remappedPrimary < 0
        ? -1
        : remapSubtitleIndex(
            previous,
            updated.MediaStreams ?? [],
            selected.secondary,
          ),
    )
    refreshSubtitles(playback.target.id, fresh)
  }, [api, playback, preferences, refreshSubtitles])
  const splitCaptions = Boolean(
    primaryTrack &&
    secondaryTrack &&
    (player.options.burnSubtitle ||
      [primaryTrack, secondaryTrack].some(
        (track) =>
          track.DeliveryMethod === 'Encode' ||
          /pgs|dvd|vobsub/i.test(track.Codec ?? ''),
      )),
  )
  const activeAudio =
    player.options.audio ??
    source?.DefaultAudioStreamIndex ??
    (audio.length === 1
      ? audio[0].Index
      : audio.find((a) => a.IsDefault)?.Index)
  const pathFor = (track?: typeof primaryTrack) =>
    target && source?.Id && activeAudio != null && track?.Index != null
      ? [target.id, source.Id, activeAudio, track.Index]
          .map(String)
          .map(encodeURIComponent)
          .join('/')
      : undefined
  const caps = {
    primary: subtitleCapabilities(
      primaryTrack,
      !!devices.destination,
      !!player.options.burnSubtitle,
      !!sync.group,
    ),
    secondary: subtitleCapabilities(
      secondaryTrack,
      !!devices.destination,
      false,
      !!sync.group,
    ),
  }
  const primaryTiming = useSubtitleTiming(
    session,
    userId,
    caps.primary.adjust ? pathFor(primaryTrack) : undefined,
    subtitlesKey,
  )
  const secondaryTiming = useSubtitleTiming(
    session,
    userId,
    caps.secondary.adjust ? pathFor(secondaryTrack) : undefined,
    subtitlesKey,
  )
  const services = { primary: primaryTiming, secondary: secondaryTiming }
  const editorKey = [
    userId,
    target?.id,
    source?.Id,
    activeAudio,
    primary,
    secondary,
    subtitlesKey,
    !!devices.destination,
    !!sync.group,
    !!player.options.burnSubtitle,
  ].join('|')
  const sameRevision =
    !editor?.initial ||
    editor.initial.fingerprint === services[editor.slot].snapshot?.fingerprint
  const offsetOpen = !!editor && editor.key === editorKey && sameRevision
  useEffect(() => {
    setEditor((current) =>
      current && (current.key !== editorKey || !sameRevision)
        ? undefined
        : current,
    )
  }, [editorKey, sameRevision])
  function openSync(slot: Slot, trigger: HTMLButtonElement) {
    syncTrigger.current = trigger
    const snapshot = services[slot].snapshot
    const initial = snapshot && {
      ...snapshot,
      canAnalyze: caps[slot].analyze && snapshot.canAnalyze,
    }
    setEditor({
      opening: ++syncOpening.current,
      slot,
      key: editorKey,
      initial,
      draft: initial?.correction ?? originalTiming,
    })
    setMenu(undefined)
  }
  const timingFor = (slot: Slot) =>
    offsetOpen && editor.slot === slot
      ? editor.draft
      : (services[slot].snapshot?.correction ?? originalTiming)
  const captions = usePlayerSubtitles({
    api,
    videoRef,
    playback: devices.destination ? undefined : playback,
    primary: player.options.burnSubtitle ? undefined : primaryTrack,
    secondary: secondaryTrack,
    split: splitCaptions,
    styles: subtitleStyles,
    corrections: {
      primary: timingFor('primary'),
      secondary: timingFor('secondary'),
    },
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
    (controlsVisible ||
      controlsHovered ||
      media.paused ||
      Boolean(menu) ||
      offsetOpen)
  const currentLyric = lyrics.data?.findLastIndex(
    (line) =>
      line.Start != null && line.Start / ticksPerSecond <= media.position,
  )
  useSubtitleClearance(stageRef, showControls)

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
      subtitleStyles,
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
    subtitleStyles,
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

  function open(
    entry: NonNullable<typeof target>,
    start = entry.start,
    paused = false,
  ) {
    setSelectedSubtitle(undefined)
    setSecondarySubtitle(-1)
    setSubtitleProblem('')
    setContinueNext(undefined)
    setMenu(undefined)
    player.open({ ...entry, start }, paused)
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
    else if (videoRef.current) setPaused(!videoRef.current.paused)
  }
  function setPaused(paused: boolean) {
    if (devices.destination) {
      devices.setPaused(paused)
      return
    }
    videoRef.current?.dispatchEvent(
      new CustomEvent('subtitle-user-playback', { detail: { paused } }),
    )
    if (sync.group) sync.setPaused(paused)
    else player.setPaused(paused)
  }
  function seek(seconds: number) {
    videoRef.current?.dispatchEvent(new Event('subtitle-user-seek'))
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
    if (value < 0 || value === secondarySubtitle) setSecondarySubtitle(-1)
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
  function openMenu(nextMenu: PlayerMenu) {
    if (document.activeElement instanceof HTMLElement)
      menuTrigger.current = document.activeElement
    setMenu(nextMenu)
  }
  function closeMenu() {
    setMenu(undefined)
    if (menuTrigger.current?.isConnected)
      menuTrigger.current.focus({ preventScroll: true })
  }
  function toggleMenu(nextMenu: PlayerMenu) {
    if (menu === nextMenu) closeMenu()
    else openMenu(nextMenu)
  }

  useMediaSession(statusVisible ? (target?.title ?? item.title) : undefined, {
    position: media.position,
    duration: media.duration,
    rate: media.rate,
    paused: media.paused,
    setPaused,
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
          setPaused(true)
          break
        case 'Unpause':
          setPaused(false)
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
      actions={
        <PlayerSessionActions
          casting={Boolean(devices.destination)}
          syncing={Boolean(sync.group)}
          disabled={!statusVisible}
          onCast={() => {
            setEditor(undefined)
            openMenu('devices')
            void devices.list()
          }}
          onSync={() => {
            setEditor(undefined)
            openMenu('sync')
            void sync.list()
          }}
        />
      }
    >
      <AnimatePresence>
        {offsetOpen && (
          <SubtitleOffset
            key={editor.opening}
            value={editor.draft}
            initial={editor.initial}
            service={services[editor.slot]}
            cues={captions.cues[editor.slot]}
            trackLabel={
              (editor.slot === 'primary' ? primaryTrack : secondaryTrack)
                ?.DisplayTitle ?? t('Sous-titres')
            }
            video={videoRef.current}
            origin={playback?.stream.offset ?? 0}
            canReplay={caps[editor.slot].replay}
            onChange={(draft) =>
              setEditor((current) =>
                current?.opening === editor.opening
                  ? { ...current, draft }
                  : current,
              )
            }
            onTracks={() => {
              closeOffset()
              setMenu('subtitles')
            }}
            onClose={closeOffset}
          />
        )}
      </AnimatePresence>
      <div
        ref={stageRef}
        className="player-stage"
        style={
          {
            '--primary-bitmap-tint': subtitleStyles.primary.customized
              ? `url(#${filterId}primary)`
              : 'none',
            '--secondary-bitmap-tint': subtitleStyles.secondary.customized
              ? `url(#${filterId}secondary)`
              : 'none',
          } as CSSProperties
        }
        onKeyDown={(event) => {
          if (
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLSelectElement ||
            (event.target instanceof HTMLElement &&
              event.target.closest(
                '[role="combobox"], [role="listbox"], [role="option"]',
              ))
          )
            return
          const key = event.key.toLowerCase()
          if (key === 'escape' && menu) {
            event.preventDefault()
            closeMenu()
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
        {(['primary', 'secondary'] as const).map((slot) => {
          const track = slot === 'primary' ? primaryTrack : secondaryTrack
          const { color, customized } = subtitleStyles[slot]
          if (!customized || !/pgs|dvd|vobsub/i.test(track?.Codec ?? ''))
            return null
          const channels = [1, 3, 5].map(
            (start) => parseInt(color.slice(start, start + 2), 16) / 255,
          )
          return (
            <svg
              key={slot}
              width="0"
              height="0"
              aria-hidden="true"
              style={{ position: 'absolute' }}
            >
              <filter id={filterId + slot} colorInterpolationFilters="sRGB">
                <feColorMatrix type="saturate" values="0" />
                <feComponentTransfer>
                  <feFuncR type="linear" slope={channels[0]} />
                  <feFuncG type="linear" slope={channels[1]} />
                  <feFuncB type="linear" slope={channels[2]} />
                </feComponentTransfer>
              </filter>
            </svg>
          )
        })}
        <video
          ref={videoRef}
          className="player-video"
          playsInline
          preload="auto"
          tabIndex={0}
          aria-label={t('Lecture de {title}', {
            title: target?.title ?? item.title,
          })}
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
        <PlayerCaptions
          layout={
            splitCaptions
              ? 'split'
              : primaryTrack && secondaryTrack
                ? 'paired'
                : 'single'
          }
          primary={captions.primary}
          secondary={captions.secondary}
          primaryLanguage={primaryTrack?.Language ?? undefined}
          secondaryLanguage={secondaryTrack?.Language ?? undefined}
          styles={subtitleStyles}
        />
        {state === 'ready' && media.paused && (
          <Tooltip>
            <motion.button
              type="button"
              className="player-big-play"
              aria-label={t('Démarrer la lecture')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              onClick={toggle}
            >
              <Play fill="currentColor" />
            </motion.button>
          </Tooltip>
        )}
        {devices.destination && (
          <div className="player-remote-status">
            <p>
              {t('Diffusion sur {device}', {
                device: devices.destination.label,
              })}
            </p>
          </div>
        )}
        <PlayerLoading
          visible={
            !devices.destination &&
            state !== 'error' &&
            state !== 'stopped' &&
            (player.buffering || state === 'loading' || Boolean(media.seeking))
          }
          phase={player.loadingPhase}
          complete={
            !devices.destination &&
            (state === 'playing' || state === 'ready') &&
            !player.buffering &&
            !media.seeking
          }
        />
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
            {t(segmentLabels[activeSegment.Type]!)}
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
            {t('Lire l’épisode suivant')}
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
            {t('Toujours là ? Continuer')}
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
              subtitles={Boolean(primaryTrack)}
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
                !devices.destination ? () => toggleMenu('subtitles') : undefined
              }
              onSettings={() => toggleMenu('settings')}
              onPreview={trickplay}
              loadPreview={api.previewImage}
              markers={chapters.map((chapter) => ({
                position: (chapter.StartPositionTicks ?? 0) / ticksPerSecond,
                label: chapter.Name ?? t('Chapitre'),
              }))}
            />
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {menu && statusVisible && (
            <PlayerSettingsPanel key={menu} menu={menu} onClose={closeMenu}>
              {menu === 'settings' && devices.destination && (
                <div className="player-menu-actions">
                  <button type="button" onClick={() => setMenu('devices')}>
                    {t('Diffusion')}
                  </button>
                </div>
              )}
              {menu === 'settings' && !devices.destination && (
                <>
                  <label>
                    {t('Qualité')}
                    <Select
                      aria-label={t('Qualité')}
                      value={player.options.bitrate ?? 0}
                      onValueChange={(value) => {
                        const bitrate = Number(value)
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
                          {localizeText(t, text)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  {audio.length > 0 && (
                    <label>
                      {t('Audio')}
                      <Select
                        aria-label={t('Audio')}
                        optionIcon={(value) => {
                          const flag = languageFlag(
                            audio.find((track) => String(track.Index) === value)
                              ?.Language,
                          )
                          return flag ? (
                            <img
                              className="holly-select-flag"
                              src={flag}
                              alt=""
                              width={20}
                              height={15}
                            />
                          ) : null
                        }}
                        value={
                          player.options.audio ??
                          source?.DefaultAudioStreamIndex ??
                          audio[0].Index
                        }
                        onValueChange={(value) => audioSelect(Number(value))}
                      >
                        {audio.map((track) => (
                          <option key={track.Index} value={track.Index}>
                            {trackName(track, t)}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                  {playback && playback.stream.sources.length > 1 && (
                    <label>
                      {t('Version')}
                      <Select
                        aria-label={t('Version')}
                        value={source?.Id}
                        onValueChange={(value) => {
                          setSelectedSubtitle(undefined)
                          setSecondarySubtitle(-1)
                          player.replaceStream({
                            sourceId: value,
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
                      </Select>
                    </label>
                  )}
                  <label>
                    {t('Vitesse')}
                    <Select
                      aria-label={t('Vitesse')}
                      value={media.rate}
                      onValueChange={(value) => {
                        if (videoRef.current)
                          videoRef.current.playbackRate = Number(value)
                      }}
                    >
                      {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}×
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    {t('Image')}
                    <Select
                      aria-label={t('Image')}
                      value={fit}
                      onValueChange={(value) => setFit(value as typeof fit)}
                    >
                      <option value="contain">{t('Originale')}</option>
                      <option value="cover">{t('Remplir')}</option>
                      <option value="fill">{t('Étirer')}</option>
                    </Select>
                  </label>
                  <label>
                    {t('Répéter')}
                    <Select
                      aria-label={t('Répéter')}
                      value={repeat}
                      onValueChange={(value) =>
                        setRepeat(value as typeof repeat)
                      }
                    >
                      <option value="RepeatNone">{t('Désactivé')}</option>
                      <option value="RepeatOne">{t('Titre actuel')}</option>
                      <option value="RepeatAll">{t('Toute la file')}</option>
                    </Select>
                  </label>
                  <label>
                    {t('Lecture automatique')}
                    <input
                      type="checkbox"
                      checked={autoNext}
                      onChange={(event) => setAutoNext(event.target.checked)}
                    />
                  </label>
                  <label>
                    {t('Confirmer après 3 épisodes')}
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
                      {t('Lecture aléatoire')}
                      <input
                        type="checkbox"
                        checked={shuffle}
                        onChange={(event) => setShuffle(event.target.checked)}
                      />
                    </label>
                  )}
                  <div className="player-menu-actions">
                    {!devices.destination && (
                      <button
                        type="button"
                        onClick={() => setMenu('subtitles')}
                      >
                        {t('Sous-titres')}
                      </button>
                    )}
                    {currentQueue.length > 1 && !sync.group && (
                      <button type="button" onClick={() => setMenu('queue')}>
                        {t('File de lecture')}
                      </button>
                    )}
                    {chapters.length > 0 && (
                      <button type="button" onClick={() => setMenu('chapters')}>
                        {t('Chapitres')}
                      </button>
                    )}
                    <button type="button" onClick={() => setMenu('trailers')}>
                      {t('Bandes-annonces')}
                    </button>
                    <button type="button" onClick={() => setMenu('stats')}>
                      {t('Statistiques')}
                    </button>
                    {audioOnly && (
                      <button type="button" onClick={() => setMenu('lyrics')}>
                        {t('Paroles')}
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
                        {t('Diffusion')}
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
                    {t('Langue')}
                    {/* Rebuild the option registry when Jellyfin renumbers tracks. */}
                    <Select
                      key={subtitlesKey + ':primary'}
                      aria-label={t('Langue')}
                      optionIcon={(value) => {
                        const flag = languageFlag(
                          subtitles.find(
                            (track) => String(track.Index) === value,
                          )?.Language,
                        )
                        return flag ? (
                          <img
                            className="holly-select-flag"
                            src={flag}
                            alt=""
                            width={20}
                            height={15}
                          />
                        ) : null
                      }}
                      value={primary}
                      onValueChange={(value) => subtitle(Number(value))}
                    >
                      <option value={-1}>{t('Désactivés')}</option>
                      {subtitles.map((track) => (
                        <option key={track.Index} value={track.Index}>
                          {trackName(track, t)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  {primaryTrack && subtitles.length > 1 && (
                    <label>
                      {t('Deuxième piste')}
                      <Select
                        key={subtitlesKey + ':secondary'}
                        aria-label={t('Deuxième piste')}
                        optionIcon={(value) => {
                          const flag = languageFlag(
                            subtitles.find(
                              (track) => String(track.Index) === value,
                            )?.Language,
                          )
                          return flag ? (
                            <img
                              className="holly-select-flag"
                              src={flag}
                              alt=""
                              width={20}
                              height={15}
                            />
                          ) : null
                        }}
                        value={secondaryTrack?.Index ?? -1}
                        onValueChange={(value) => {
                          setSubtitleProblem('')
                          setSecondarySubtitle(Number(value))
                        }}
                      >
                        <option value={-1}>{t('Désactivée')}</option>
                        {subtitles
                          .filter((track) => track.Index !== primary)
                          .map((track) => (
                            <option key={track.Index} value={track.Index}>
                              {trackName(track, t)}
                            </option>
                          ))}
                      </Select>
                    </label>
                  )}
                  <SubtitleSyncActions
                    primary={
                      primaryTrack && {
                        canAdjust: caps.primary.adjust,
                        loading: primaryTiming.loading,
                      }
                    }
                    secondary={
                      secondaryTrack && {
                        canAdjust: caps.secondary.adjust,
                        loading: secondaryTiming.loading,
                      }
                    }
                    onOpen={openSync}
                  />
                  {primaryTrack && !devices.destination && (
                    <SubtitleAppearance
                      styles={subtitleStyles}
                      hasSecondary={Boolean(secondaryTrack)}
                      burned={Boolean(
                        player.options.burnSubtitle ||
                        primaryTrack?.DeliveryMethod === 'Encode',
                      )}
                      onChange={(slot, style) =>
                        setSubtitleStyles((current) => ({
                          ...current,
                          [slot]: style,
                        }))
                      }
                    />
                  )}
                  {subtitleProblem && (
                    <p role="alert">
                      {localizeText(
                        t,
                        subtitleProblem,
                        'Cette piste de sous-titres ne peut pas être affichée.',
                      )}
                    </p>
                  )}
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
                          ? t('Afficher dans le navigateur')
                          : t('Incruster dans la vidéo')}
                      </button>
                    )}
                  {playback && !devices.destination && (
                    <PlayerSubtitleTools
                      key={`${playback.target.id}:${source?.Id}`}
                    >
                      <SubtitlePanel
                        session={session}
                        itemId={playback.target.id}
                        sourceId={source?.Id}
                        onChanged={reloadSubtitles}
                      />
                    </PlayerSubtitleTools>
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
                    ·{' '}
                    {chapter.Name ??
                      t('Chapitre {number}', { number: chapterIndex + 1 })}
                  </button>
                ))}
              {menu === 'trailers' && (
                <>
                  {trailers.isPending && <p>{t('Chargement…')}</p>}
                  {trailers.isError && (
                    <p>{t('Impossible de charger les bandes-annonces.')}</p>
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
                      {entry.Name ?? t('Bande-annonce')}
                    </a>
                  ))}
                  {!trailers.isPending &&
                    !trailers.isError &&
                    !trailers.data?.length &&
                    !details.data?.RemoteTrailers?.length && (
                      <p>{t('Aucune bande-annonce disponible.')}</p>
                    )}
                </>
              )}
              {menu === 'sync' && (
                <>
                  {sync.group ? (
                    <>
                      <p>
                        {sync.group.GroupName} ·{' '}
                        {t(
                          (sync.group.Participants?.length ?? 1) === 1
                            ? '{count} participant'
                            : '{count} participants',
                          { count: sync.group.Participants?.length ?? 1 },
                        )}
                      </p>
                      <button type="button" onClick={() => void sync.leave()}>
                        {t('Quitter le groupe')}
                      </button>
                    </>
                  ) : (
                    <>
                      <label>
                        {t('Nom du groupe')}
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
                        {t('Créer un groupe')}
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
                        {t('Actualiser')}
                      </button>
                    </>
                  )}
                  {sync.error && (
                    <p role="alert">
                      {localizeText(
                        t,
                        sync.error,
                        'Impossible de synchroniser la lecture avec ce groupe.',
                      )}
                    </p>
                  )}
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
                        {t('Reprendre ici')}
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
                      {!devices.canCast && (
                        <p>
                          {t(
                            'Pour utiliser Chromecast, ouvrez HollyFilms depuis son adresse HTTPS accessible à votre téléviseur.',
                          )}
                        </p>
                      )}
                      {!devices.devices.length && (
                        <p>{t('Aucun autre appareil connecté.')}</p>
                      )}
                      <button type="button" onClick={() => void devices.list()}>
                        {t('Actualiser')}
                      </button>
                    </>
                  )}
                  {devices.error && (
                    <p role="alert">
                      {localizeText(
                        t,
                        devices.error,
                        'Impossible de communiquer avec l’appareil.',
                      )}
                    </p>
                  )}
                </>
              )}
              {menu === 'stats' && playback && (
                <dl className="player-stats">
                  <div>
                    <dt>{t('Lecture')}</dt>
                    <dd>
                      {
                        {
                          DirectPlay: t('Lecture directe'),
                          DirectStream: t('Remux'),
                          Transcode: t('Transcodage'),
                        }[playback.stream.method]
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Flux')}</dt>
                    <dd>{playback.stream.hls ? 'HLS' : source?.Container}</dd>
                  </div>
                  <div>
                    <dt>{t('Résolution')}</dt>
                    <dd>
                      {video?.videoWidth} × {video?.videoHeight}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Images perdues')}</dt>
                    <dd>
                      {video?.getVideoPlaybackQuality?.().droppedVideoFrames ??
                        0}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Tampon')}</dt>
                    <dd>
                      {Math.max(0, media.buffered - media.position).toFixed(1)}{' '}
                      {t('s')}
                    </dd>
                  </div>
                  {source?.Bitrate && (
                    <div>
                      <dt>{t('Débit source')}</dt>
                      <dd>{(source.Bitrate / 1_000_000).toFixed(1)} Mb/s</dd>
                    </div>
                  )}
                </dl>
              )}
              {menu === 'lyrics' && (
                <>
                  {lyrics.isPending && <p>{t('Chargement…')}</p>}
                  {(lyrics.isError || lyrics.data?.length === 0) && (
                    <p>{t('Paroles indisponibles.')}</p>
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
            </PlayerSettingsPanel>
          )}
        </AnimatePresence>
      </div>
    </PlayerShell>
  )
}
