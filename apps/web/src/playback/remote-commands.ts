import { useEffect, useRef } from 'react'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import { toMediaItem } from '@hollyfilms/shared/library'
import type { MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js'
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api.js'
import type {
  OutboundWebSocketMessage,
  PlayRequest,
} from '@jellyfin/sdk/lib/generated-client/index.js'

export type RemoteControlMessage = Extract<
  OutboundWebSocketMessage,
  { MessageType: 'Playstate' | 'GeneralCommand' }
>

export function useRemoteCommands(
  session: JellyfinSession,
  userId: string,
  handlers: {
    play: (items: MediaItem[], request: PlayRequest) => void
    control: (message: RemoteControlMessage) => void
  },
) {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  }, [handlers])
  useEffect(() => {
    const api = createJellyfinApi(
      new URL('/jellyfin', location.origin).href,
      session.deviceId,
      session.accessToken,
    )
    const abort = new AbortController()
    let playSequence = 0
    const options = { signal: abort.signal, timeout: 5000 }
    void getSessionApi(api)
      .postFullCapabilities(
        {
          clientCapabilitiesDto: {
            PlayableMediaTypes: ['Video', 'Audio'],
            SupportsMediaControl: true,
            SupportedCommands: [
              'SetVolume',
              'VolumeUp',
              'VolumeDown',
              'Mute',
              'Unmute',
              'ToggleMute',
              'SetAudioStreamIndex',
              'SetSubtitleStreamIndex',
              'ToggleFullscreen',
            ],
          },
        },
        options,
      )
      .catch(() => {})
    const unsubscribe = api.subscribe(
      ['Play', 'Playstate', 'GeneralCommand'],
      (message) => {
        if (message.MessageType !== 'Play') {
          latest.current.control(message)
          return
        }
        const request = message.Data
        const ids = request?.ItemIds?.filter(
          (id) => typeof id === 'string' && id.length > 0,
        ).slice(0, 200)
        if (!request || !ids?.length) return
        const sequence = ++playSequence
        void getLibraryApi(api)
          .getItems(
            {
              ids,
              userId,
              fields: ['Overview', 'Genres'],
              enableUserData: true,
            },
            options,
          )
          .then(({ data }) => {
            if (abort.signal.aborted || sequence !== playSequence) return
            const found = new Map(
              (data.Items ?? []).map((item) => [item.Id, toMediaItem(item)]),
            )
            const items = ids
              .map((id) => found.get(id))
              .filter((item) => item != null)
            if (items.length) latest.current.play(items, request)
          })
          .catch(() => {})
      },
    )
    return () => {
      abort.abort()
      unsubscribe()
      api.update({ accessToken: '' })
    }
  }, [session, userId])
}
