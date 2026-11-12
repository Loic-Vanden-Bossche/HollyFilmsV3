import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { getSyncPlayApi } from '@jellyfin/sdk/lib/utils/api/sync-play-api.js'
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api.js'
import type {
  GroupInfoDto,
  SendCommand,
} from '@jellyfin/sdk/lib/generated-client/index.js'
import { itemTarget, ticksPerSecond } from './playback-api.ts'
import type { PlaybackApi, PlaybackTarget } from './playback-api.ts'

type SyncControls = {
  target?: PlaybackTarget
  queue: PlaybackTarget[]
  position: number
  seek: (seconds: number) => void
  open: (target: PlaybackTarget, paused: boolean) => void
}

export function useSyncPlay(
  api: PlaybackApi,
  videoRef: RefObject<HTMLVideoElement | null>,
  controls: SyncControls,
) {
  const latest = useRef(controls)
  const groupRef = useRef<string | undefined>(undefined)
  const playlistItem = useRef<string | undefined>(undefined)
  const clockOffset = useRef(0)
  const pendingItem = useRef<string | undefined>(undefined)
  const pendingCommand = useRef<SendCommand | undefined>(undefined)
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const [group, setGroup] = useState<GroupInfoDto>()
  const [groups, setGroups] = useState<GroupInfoDto[]>([])
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)

  useEffect(() => {
    latest.current = controls
  }, [controls])

  const sync = getSyncPlayApi(api.sdk)
  const config = { timeout: 5000 }
  const notifyError = () =>
    setError('Impossible de synchroniser la lecture avec ce groupe.')

  useEffect(() => {
    if (!listening) return
    const player = videoRef.current
    if (!player) return
    const syncApi = getSyncPlayApi(api.sdk)
    const options = { timeout: 5000 }
    let disposed = false

    function schedule(command: SendCommand) {
      clearTimeout(actionTimer.current)
      const when = Date.parse(command.When ?? '')
      const delay = Number.isFinite(when)
        ? Math.max(0, when - Date.now() - clockOffset.current)
        : 0
      actionTimer.current = setTimeout(() => {
        if (disposed || groupRef.current !== command.GroupId) return
        if (
          command.Command === 'Stop' ||
          command.Command === 'Pause' ||
          command.Command === 'Seek'
        )
          player!.pause()
        if (command.PositionTicks != null && command.Command !== 'Stop') {
          const late =
            command.Command === 'Unpause' && Number.isFinite(when)
              ? Math.max(0, Date.now() + clockOffset.current - when) / 1000
              : 0
          const position = command.PositionTicks / ticksPerSecond + late
          if (Math.abs(position - latest.current.position) > 0.35)
            latest.current.seek(position)
        }
        if (command.Command === 'Unpause')
          void player!
            .play()
            .catch(() =>
              setError(
                'Appuyez sur Lire pour reprendre la lecture synchronisée.',
              ),
            )
      }, delay)
    }

    function reportReady() {
      const id = playlistItem.current
      if (
        !groupRef.current ||
        !id ||
        (pendingItem.current &&
          pendingItem.current !== latest.current.target?.id)
      )
        return
      pendingItem.current = undefined
      void syncApi
        .syncPlayReady(
          {
            readyRequestDto: {
              PlaylistItemId: id,
              PositionTicks: Math.round(
                latest.current.position * ticksPerSecond,
              ),
              IsPlaying: !player!.paused,
              When: new Date(Date.now() + clockOffset.current).toISOString(),
            },
          },
          options,
        )
        .catch(() => {})
      if (pendingCommand.current) {
        schedule(pendingCommand.current)
        pendingCommand.current = undefined
      }
    }

    function reportWaiting() {
      if (!groupRef.current || !playlistItem.current || player!.paused) return
      void syncApi
        .syncPlayBuffering(
          {
            bufferRequestDto: {
              PlaylistItemId: playlistItem.current,
              PositionTicks: Math.round(
                latest.current.position * ticksPerSecond,
              ),
              IsPlaying: true,
              When: new Date(Date.now() + clockOffset.current).toISOString(),
            },
          },
          options,
        )
        .catch(() => {})
    }

    function clearGroup() {
      groupRef.current = undefined
      playlistItem.current = undefined
      pendingItem.current = undefined
      pendingCommand.current = undefined
      clearTimeout(actionTimer.current)
      setGroup(undefined)
    }

    const unsubscribe = api.sdk.subscribe(
      ['SyncPlayGroupUpdate', 'SyncPlayCommand'],
      (message) => {
        const data = message.Data
        if (!data || disposed) return
        if (message.MessageType === 'SyncPlayCommand') {
          const command = message.Data
          if (!command || command.GroupId !== groupRef.current) return
          if (
            pendingItem.current ||
            (command.PlaylistItemId &&
              command.PlaylistItemId !== playlistItem.current)
          ) {
            pendingCommand.current = command
          } else schedule(command)
          return
        }
        const update = message.Data
        if (!update) return
        switch (update.Type) {
          case 'GroupJoined':
            if (update.Data) {
              groupRef.current = update.GroupId
              setGroup(update.Data)
            }
            break
          case 'UserJoined':
          case 'UserLeft':
            setGroup(
              (current) =>
                current && {
                  ...current,
                  Participants:
                    update.Type === 'UserJoined' && update.Data
                      ? [
                          ...new Set([
                            ...(current.Participants ?? []),
                            update.Data,
                          ]),
                        ]
                      : current.Participants?.filter(
                          (name) => name !== update.Data,
                        ),
                },
            )
            break
          case 'GroupLeft':
          case 'NotInGroup':
          case 'GroupDoesNotExist':
            clearGroup()
            break
          case 'LibraryAccessDenied':
            setError('Votre compte ne peut pas lire le média de ce groupe.')
            break
          case 'PlayQueue': {
            if (update.GroupId !== groupRef.current || !update.Data) return
            const queue = update.Data
            const selected = queue.Playlist?.[queue.PlayingItemIndex ?? 0]
            if (!selected?.ItemId || !selected.PlaylistItemId) return
            const changing = playlistItem.current !== selected.PlaylistItemId
            playlistItem.current = selected.PlaylistItemId
            if (!changing) return
            player.pause()
            if (
              selected.ItemId === latest.current.target?.id &&
              player.readyState >= 2
            ) {
              reportReady()
            } else {
              const id = selected.ItemId
              pendingItem.current = id
              void api
                .details(id)
                .then((item) => {
                  const target = itemTarget(item)
                  if (target && !disposed && pendingItem.current === id) {
                    latest.current.open(
                      {
                        ...target,
                        start: (queue.StartPositionTicks ?? 0) / ticksPerSecond,
                      },
                      true,
                    )
                  }
                })
                .catch(() => {
                  if (!disposed)
                    setError('Impossible de charger le média synchronisé.')
                })
            }
            break
          }
        }
      },
    )
    player.addEventListener('canplay', reportReady)
    player.addEventListener('seeked', reportReady)
    player.addEventListener('waiting', reportWaiting)
    const clock = async () => {
      const sent = Date.now()
      const { data } = await getSystemApi(api.sdk).getUtcTime(options)
      const received = Date.now()
      const server = Date.parse(data.ResponseTransmissionTime ?? '')
      if (disposed || !Number.isFinite(server)) return
      clockOffset.current = server - (sent + received) / 2
      if (groupRef.current)
        await syncApi.syncPlayPing(
          { pingRequestDto: { Ping: Math.round((received - sent) / 2) } },
          options,
        )
    }
    void clock().catch(() => {})
    const interval = setInterval(() => void clock().catch(() => {}), 15_000)
    return () => {
      disposed = true
      clearTimeout(actionTimer.current)
      clearInterval(interval)
      unsubscribe()
      player.removeEventListener('canplay', reportReady)
      player.removeEventListener('seeked', reportReady)
      player.removeEventListener('waiting', reportWaiting)
      if (groupRef.current)
        void syncApi.syncPlayLeaveGroup(options).catch(() => {})
    }
  }, [api, videoRef, listening])

  return {
    group,
    groups,
    error,
    async list() {
      setListening(true)
      setError('')
      try {
        setGroups((await sync.syncPlayGetGroups(config)).data)
      } catch {
        notifyError()
      }
    },
    async create(name: string) {
      const target = latest.current.target
      if (!target) return
      setError('')
      try {
        const { data } = await sync.syncPlayCreateGroup(
          { newGroupRequestDto: { GroupName: name.trim() || 'HollyFilms' } },
          config,
        )
        groupRef.current = data.GroupId
        setGroup(data)
        const queue = latest.current.queue.length
          ? latest.current.queue
          : [target]
        await sync.syncPlaySetNewQueue(
          {
            playRequestDto: {
              PlayingQueue: queue.map((entry) => entry.id),
              PlayingItemPosition: Math.max(
                0,
                queue.findIndex((entry) => entry.id === target.id),
              ),
              StartPositionTicks: Math.round(
                latest.current.position * ticksPerSecond,
              ),
            },
          },
          config,
        )
      } catch {
        notifyError()
      }
    },
    async join(id: string) {
      setError('')
      try {
        await sync.syncPlayJoinGroup(
          { joinGroupRequestDto: { GroupId: id } },
          config,
        )
      } catch {
        notifyError()
      }
    },
    async leave() {
      if (!groupRef.current) return
      try {
        await sync.syncPlayLeaveGroup(config)
      } catch {
        notifyError()
      }
      groupRef.current = undefined
      playlistItem.current = undefined
      clearTimeout(actionTimer.current)
      setGroup(undefined)
    },
    toggle() {
      void (
        videoRef.current?.paused
          ? sync.syncPlayUnpause(config)
          : sync.syncPlayPause(config)
      ).catch(notifyError)
    },
    seek(seconds: number) {
      void sync
        .syncPlaySeek(
          {
            seekRequestDto: {
              PositionTicks: Math.max(0, Math.round(seconds * ticksPerSecond)),
            },
          },
          config,
        )
        .catch(notifyError)
    },
    step(direction: -1 | 1) {
      const id = playlistItem.current
      if (!id) return
      void (
        direction > 0
          ? sync.syncPlayNextItem(
              { nextItemRequestDto: { PlaylistItemId: id } },
              config,
            )
          : sync.syncPlayPreviousItem(
              { previousItemRequestDto: { PlaylistItemId: id } },
              config,
            )
      ).catch(notifyError)
    },
  }
}
