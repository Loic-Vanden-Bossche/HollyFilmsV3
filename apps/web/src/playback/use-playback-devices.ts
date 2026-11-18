import { useEffect, useState } from 'react'
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api.js'
import type {
  GeneralCommandType,
  PlaybackProgressInfo,
  PlaystateCommand,
  SessionInfoDto,
} from '@jellyfin/sdk/lib/generated-client/index.js'
import { itemTarget, ticksPerSecond } from './playback-api.ts'
import type {
  PlaybackApi,
  PlaybackStream,
  PlaybackTarget,
} from './playback-api.ts'
import type { castMedia } from './cast-client.ts'
import { initialMediaState } from './use-playback.ts'

type CastConnection = Awaited<ReturnType<typeof castMedia>>
type Destination = (
  | { kind: 'session'; id: string; label: string }
  | { kind: 'cast'; connection: CastConnection; label: string }
) & { target: PlaybackTarget }

export function usePlaybackDevices(api: PlaybackApi) {
  const [devices, setDevices] = useState<SessionInfoDto[]>([])
  const [destination, setDestination] = useState<Destination>()
  const [status, setStatus] = useState(initialMediaState)
  const [remoteTarget, setRemoteTarget] = useState<PlaybackTarget>()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const sessions = getSessionApi(api.sdk)
  const options = { timeout: 5000 }
  const fail = () => setError('Impossible de communiquer avec l’appareil.')

  useEffect(() => {
    if (!destination) return
    let disposed = false
    const read = async () => {
      if (destination.kind === 'cast') {
        const player = destination.connection.player
        setStatus({
          position: player.currentTime + destination.connection.stream.offset,
          duration: player.duration + destination.connection.stream.offset,
          buffered: 0,
          paused: player.isPaused,
          muted: player.isMuted,
          volume: player.volumeLevel,
          rate: 1,
        })
        if (!player.isConnected)
          setError('L’appareil Google Cast est déconnecté.')
      } else {
        const { data } = await getSessionApi(api.sdk).getSessions(
          {},
          { timeout: 5000 },
        )
        if (disposed) return
        const device = data.find((entry) => entry.Id === destination.id)
        if (!device) {
          setError('L’appareil est déconnecté.')
          return
        }
        const item = device.NowPlayingItem && itemTarget(device.NowPlayingItem)
        if (item) setRemoteTarget(item)
        const state = device.PlayState
        setStatus({
          position: (state?.PositionTicks ?? 0) / ticksPerSecond,
          duration: (device.NowPlayingItem?.RunTimeTicks ?? 0) / ticksPerSecond,
          buffered: 0,
          paused: state?.IsPaused ?? true,
          muted: state?.IsMuted ?? false,
          volume: (state?.VolumeLevel ?? 100) / 100,
          rate: 1,
        })
      }
    }
    const refresh = () =>
      void read().catch(() => {
        if (!disposed) fail()
      })
    refresh()
    const interval = setInterval(refresh, 1000)
    let reportTimer: ReturnType<typeof setInterval> | undefined
    if (destination.kind === 'cast') {
      const { connection, target } = destination
      const snapshot = (): PlaybackProgressInfo => ({
        ItemId: target.id,
        MediaSourceId: connection.stream.source.Id,
        PlaySessionId: connection.stream.sessionId,
        PlayMethod: connection.stream.method,
        PositionTicks: Math.round(
          (connection.player.currentTime + connection.stream.offset) *
            ticksPerSecond,
        ),
        IsPaused: connection.player.isPaused,
        IsMuted: connection.player.isMuted,
        VolumeLevel: Math.round(connection.player.volumeLevel * 100),
      })
      void api.start(snapshot()).catch(() => {})
      reportTimer = setInterval(
        () => void api.progress(snapshot()).catch(() => {}),
        10_000,
      )
    }
    return () => {
      disposed = true
      clearInterval(interval)
      clearInterval(reportTimer)
    }
  }, [api, destination])

  function playstate(command: PlaystateCommand, position?: number) {
    if (destination?.kind !== 'session') return
    void sessions
      .sendPlaystateCommand(
        {
          sessionId: destination.id,
          command,
          seekPositionTicks:
            position == null
              ? undefined
              : Math.round(position * ticksPerSecond),
        },
        options,
      )
      .catch(fail)
  }
  function general(name: GeneralCommandType, args?: Record<string, string>) {
    if (destination?.kind !== 'session') return
    void sessions
      .sendFullGeneralCommand(
        {
          sessionId: destination.id,
          generalCommand: { Name: name, Arguments: args },
        },
        options,
      )
      .catch(fail)
  }
  async function transfer(
    start: () => Promise<Destination>,
    stopLocal: () => Promise<void>,
  ) {
    if (pending || destination) return
    setPending(true)
    setError('')
    try {
      const result = await start()
      await stopLocal()
      setDestination(result)
    } catch {
      fail()
    } finally {
      setPending(false)
    }
  }
  return {
    devices,
    destination,
    pending,
    error,
    status,
    target: remoteTarget ?? destination?.target,
    canCast:
      window.isSecureContext &&
      !/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname),
    async list() {
      setError('')
      try {
        const { data } = await sessions.getSessions(
          { controllableByUserId: api.userId },
          options,
        )
        setDevices(
          data.filter(
            (device) =>
              device.Id &&
              device.DeviceId !== api.session.deviceId &&
              (device.SupportsRemoteControl || device.SupportsMediaControl),
          ),
        )
      } catch {
        fail()
      }
    },
    connect(
      device: SessionInfoDto,
      target: PlaybackTarget,
      queue: PlaybackTarget[],
      stopLocal: () => Promise<void>,
    ) {
      if (!device.Id) return
      const id = device.Id
      void transfer(async () => {
        const index = queue.findIndex((entry) => entry.id === target.id)
        const items = index < 0 ? [target] : queue.slice(index)
        await sessions.play(
          {
            sessionId: id,
            playCommand: 'PlayNow',
            itemIds: items.map((item) => item.id),
            startPositionTicks: Math.round(target.start * ticksPerSecond),
          },
          options,
        )
        return {
          kind: 'session',
          id,
          label: device.DeviceName ?? device.Client ?? 'Appareil',
          target,
        }
      }, stopLocal)
    },
    cast(
      video: HTMLVideoElement,
      target: PlaybackTarget,
      stopLocal: () => Promise<void>,
    ) {
      let prepared: PlaybackStream | undefined
      void transfer(async () => {
        const { castMedia } = await import('./cast-client.ts')
        try {
          const connection = await castMedia(async () => {
            prepared = await api.stream(
              video,
              target,
              { forceTranscode: true },
              AbortSignal.timeout(15_000),
            )
            return prepared
          }, target)
          return { kind: 'cast', connection, label: connection.label, target }
        } catch (error) {
          if (prepared) void api.release(prepared).catch(() => {})
          throw error
        }
      }, stopLocal)
    },
    toggle() {
      if (destination?.kind === 'cast')
        destination.connection.controller.playOrPause()
      else playstate('PlayPause')
    },
    setPaused(paused: boolean) {
      if (destination?.kind === 'cast')
        destination.connection.setPaused(paused, fail)
      else playstate(paused ? 'Pause' : 'Unpause')
    },
    seek(position: number) {
      if (destination?.kind === 'cast') {
        destination.connection.seek(
          Math.max(0, position - destination.connection.stream.offset),
        )
      } else playstate('Seek', position)
    },
    step(direction: -1 | 1) {
      playstate(direction === 1 ? 'NextTrack' : 'PreviousTrack')
    },
    mute() {
      if (destination?.kind === 'cast')
        destination.connection.controller.muteOrUnmute()
      else general('ToggleMute')
    },
    volume(value: number) {
      if (destination?.kind === 'cast') {
        destination.connection.volume(value)
      } else general('SetVolume', { Volume: String(Math.round(value * 100)) })
    },
    async disconnect() {
      if (!destination) return
      if (destination.kind === 'cast') {
        const { connection, target } = destination
        const position =
          connection.player.currentTime + connection.stream.offset
        connection.disconnect()
        await api
          .stop({
            ItemId: target.id,
            MediaSourceId: connection.stream.source.Id,
            PlaySessionId: connection.stream.sessionId,
            PositionTicks: Math.round(position * ticksPerSecond),
          })
          .catch(() => {})
        void api.release(connection.stream).catch(() => {})
      } else {
        await sessions
          .sendPlaystateCommand(
            { sessionId: destination.id, command: 'Stop' },
            options,
          )
          .catch(fail)
      }
      setDestination(undefined)
      setRemoteTarget(undefined)
    },
  }
}
