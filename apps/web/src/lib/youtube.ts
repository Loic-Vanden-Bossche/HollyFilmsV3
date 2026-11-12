export type YouTubePlayer = {
  playVideo: () => void
  pauseVideo: () => void
  mute: () => void
  unMute: () => void
  destroy: () => void
  getIframe: () => HTMLIFrameElement
}
type YouTubeAPI = {
  Player: new (
    element: HTMLElement,
    options: {
      host: string
      videoId: string
      playerVars: Record<string, string | number>
      events: {
        onReady: (event: { target: YouTubePlayer }) => void
        onStateChange: (event: { data: number }) => void
        onError: () => void
        onAutoplayBlocked: () => void
      }
    },
  ) => YouTubePlayer
}
declare global {
  interface Window {
    YT?: YouTubeAPI
    onYouTubeIframeAPIReady?: () => void
  }
}

let loading: Promise<YouTubeAPI> | undefined

export function loadYouTube(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading
  loading = new Promise<YouTubeAPI>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const script = document.createElement('script')
    const cleanup = () => {
      clearTimeout(timeout)
      window.onYouTubeIframeAPIReady = previous
    }
    const fail = () => {
      cleanup()
      script.remove()
      reject(new Error('Aperçu vidéo indisponible'))
    }
    const timeout = setTimeout(fail, 10000)
    window.onYouTubeIframeAPIReady = () => {
      cleanup()
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('Aperçu vidéo indisponible'))
    }
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = fail
    document.head.append(script)
  }).catch((error: unknown) => {
    loading = undefined
    throw error
  })
  return loading
}
