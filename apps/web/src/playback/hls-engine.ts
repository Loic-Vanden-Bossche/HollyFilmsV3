import Hls from 'hls.js'
import workerPath from 'hls.js/dist/hls.worker.js?url'

export function attachHls(
  video: HTMLVideoElement,
  url: string,
  position: number,
  onError: () => void,
) {
  if (!Hls.isSupported()) {
    if (!video.canPlayType('application/vnd.apple.mpegurl')) {
      throw new Error('Ce navigateur ne prend pas en charge ce flux.')
    }
    video.src = url
    return () => {}
  }
  const hls = new Hls({
    workerPath,
    startPosition: position,
    lowLatencyMode: false,
    backBufferLength: 30,
  })
  let mediaRecovered = false
  hls.on(Hls.Events.ERROR, (_event, error) => {
    if (!error.fatal) return
    if (error.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
      mediaRecovered = true
      hls.recoverMediaError()
    } else {
      onError()
    }
  })
  hls.loadSource(url)
  hls.attachMedia(video)
  return () => hls.destroy()
}
