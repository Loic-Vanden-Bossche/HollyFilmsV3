import type { PlaybackStream, PlaybackTarget } from './playback-api.ts'

type RemotePlayer = {
  isConnected: boolean
  isMediaLoaded: boolean
  isPaused: boolean
  isMuted: boolean
  volumeLevel: number
  currentTime: number
  duration: number
}
type RemotePlayerController = {
  playOrPause(): void
  seek(): void
  stop(): void
  muteOrUnmute(): void
  setVolumeLevel(): void
}
type CastContext = {
  setOptions(options: {
    receiverApplicationId: string
    autoJoinPolicy: string
  }): void
  requestSession(): Promise<void>
  getCurrentSession(): {
    loadMedia(request: {
      currentTime?: number
      autoplay?: boolean
    }): Promise<void>
    getCastDevice(): { friendlyName: string }
  } | null
  endCurrentSession(stopCasting: boolean): void
}
type CastWindow = Window & {
  __onGCastApiAvailable?: (available: boolean) => void
  cast?: {
    framework: {
      CastContext: { getInstance(): CastContext }
      RemotePlayer: new () => RemotePlayer
      RemotePlayerController: new (
        player: RemotePlayer,
      ) => RemotePlayerController
    }
  }
  chrome?: {
    cast?: {
      isAvailable?: boolean
      AutoJoinPolicy: { ORIGIN_SCOPED: string }
      media: {
        DEFAULT_MEDIA_RECEIVER_APP_ID: string
        MediaInfo: new (
          url: string,
          type: string,
        ) => { metadata?: { title: string }; streamType?: string }
        LoadRequest: new (info: unknown) => {
          currentTime?: number
          autoplay?: boolean
        }
        GenericMediaMetadata: new () => { title: string }
      }
    }
  }
}

let senderScript: Promise<void> | undefined
function loadSender(window: CastWindow) {
  if (window.cast?.framework && window.chrome?.cast?.isAvailable)
    return Promise.resolve()
  senderScript ??= new Promise<void>((resolve, reject) => {
    const oldHandler = window.__onGCastApiAvailable
    const script = document.createElement('script')
    const finish = (available: boolean) => {
      clearTimeout(timeout)
      window.__onGCastApiAvailable = oldHandler
      if (available) resolve()
      else {
        script.remove()
        reject(new Error('Google Cast est indisponible dans ce navigateur.'))
      }
    }
    const timeout = setTimeout(() => finish(false), 8000)
    window.__onGCastApiAvailable = (available) => {
      oldHandler?.(available)
      finish(available)
    }
    script.src =
      'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'
    script.async = true
    script.onerror = () => finish(false)
    document.head.appendChild(script)
  }).catch((error) => {
    senderScript = undefined
    throw error
  })
  return senderScript
}

export async function castMedia(
  prepare: () => Promise<PlaybackStream>,
  target: PlaybackTarget,
) {
  const browser = window as CastWindow
  await loadSender(browser)
  const framework = browser.cast?.framework
  const chrome = browser.chrome?.cast
  if (!framework || !chrome) throw new Error('Google Cast est indisponible.')
  const context = framework.CastContext.getInstance()
  context.setOptions({
    receiverApplicationId: chrome.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.AutoJoinPolicy.ORIGIN_SCOPED,
  })
  if (!context.getCurrentSession()) await context.requestSession()
  const session = context.getCurrentSession()
  if (!session) throw new Error('Aucun appareil sélectionné.')
  const stream = await prepare()
  const media = new chrome.media.MediaInfo(
    stream.url,
    stream.hls ? 'application/x-mpegURL' : 'video/mp4',
  )
  media.metadata = new chrome.media.GenericMediaMetadata()
  media.metadata.title = target.title
  media.streamType = stream.source.IsInfiniteStream ? 'LIVE' : 'BUFFERED'
  const request = new chrome.media.LoadRequest(media)
  request.currentTime = Math.max(0, target.start - stream.offset)
  request.autoplay = true
  await session.loadMedia(request)
  const player = new framework.RemotePlayer()
  const controller = new framework.RemotePlayerController(player)
  return {
    label: session.getCastDevice().friendlyName,
    stream,
    player,
    controller,
    seek(seconds: number) {
      player.currentTime = seconds
      controller.seek()
    },
    volume(level: number) {
      player.volumeLevel = level
      controller.setVolumeLevel()
    },
    disconnect: () => context.endCurrentSession(true),
  }
}
