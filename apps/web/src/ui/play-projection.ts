import type { capturePlaySource } from './play-projection-source.ts'

// Keep the aperture and the picture on the same clock. When a frame arrives
// mid-flight, the film can take over the moving aperture on that exact beat.
export function createPlayProjection(
  source: ReturnType<typeof capturePlaySource>,
  onReleasePicture: () => void,
  onEnd: () => void,
) {
  const { bounds, imageBounds, canvas, radius } = source
  const width = window.innerWidth
  const height = window.innerHeight
  const gateHeight = Math.min(height, Math.max(width / 2.39, height * 0.46))
  const matte = (height - gateHeight) / 2
  const openGate = { offset: 0, easing: 'cubic-bezier(.2,.62,.28,1)' }
  const openMattes = { offset: 0.64, easing: 'cubic-bezier(.26,.05,.25,1)' }
  const apertureFrames = [
    {
      clipPath: `inset(${bounds.top}px ${width - bounds.right}px ${height - bounds.bottom}px ${bounds.left}px round ${radius}px)`,
      ...openGate,
    },
    {
      ...openMattes,
      clipPath: `inset(${matte}px 0px ${matte}px 0px round 0px)`,
    },
    { clipPath: 'inset(0px 0px 0px 0px round 0px)' },
  ]
  const travel = 660
  const layer = document.createElement('div')
  layer.className = 'player-projection'
  layer.setAttribute('aria-hidden', 'true')
  const aperture = document.createElement('div')
  aperture.className = 'player-projection-aperture'
  layer.append(aperture)
  if (canvas) aperture.append(canvas)

  let host: HTMLElement | null = null
  let travelAnimation: Animation | undefined
  let camera: Animation | undefined
  let dissolve: Animation | undefined
  let filmAperture: Animation | undefined
  let observer: MutationObserver | undefined
  let watchFrame: (() => void) | undefined
  let settled = false
  let released = false
  let finished = false

  function releasePicture() {
    if (released) return
    released = true
    observer?.disconnect()
    watchFrame?.()
    layer.remove()
    travelAnimation?.cancel()
    camera?.cancel()
    dissolve?.cancel()
    if (canvas) {
      canvas.remove()
      canvas.width = canvas.height = 0
    }
    onReleasePicture()
  }

  function finish() {
    if (finished) return
    finished = true
    filmAperture?.cancel()
    releasePicture()
    onEnd()
  }

  function revealFilm() {
    if (released) return
    const video =
      host?.parentElement?.querySelector<HTMLVideoElement>('.player-video')
    const elapsed = Number(travelAnimation?.currentTime ?? travel)
    // On a warm start the spectator sees the actual moving frame immediately.
    // Only its matte finishes opening; the player chrome stays full-size.
    if (!video?.isConnected || elapsed < 0 || elapsed >= travel) return finish()
    filmAperture = video.animate(apertureFrames, travel)
    filmAperture.currentTime = elapsed
    releasePicture()
    void filmAperture.finished.then(finish, finish)
  }

  function blendToBackdrop() {
    if (!settled || released || dissolve || !host) return
    if (!host.parentElement?.querySelector('.player-artwork[data-decoded]'))
      return
    observer?.disconnect()
    dissolve = layer.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 180,
      easing: 'ease-in-out',
      fill: 'forwards',
    })
    void dissolve.finished.then(finish, () => {})
  }

  function mount(next: HTMLElement) {
    if (released) return
    host = next
    host.append(layer)
    if (!travelAnimation) {
      travelAnimation = aperture.animate(apertureFrames, travel)
      if (canvas && imageBounds) {
        const scale = Math.max(width / canvas.width, height / canvas.height)
        const fullWidth = canvas.width * scale
        const fullHeight = canvas.height * scale
        const gateScale = Math.max(width / fullWidth, gateHeight / fullHeight)
        const centered = (zoom: number) =>
          `translate3d(${(width - fullWidth * zoom) / 2}px,${(height - fullHeight * zoom) / 2}px,0) scale(${zoom})`
        canvas.style.width = fullWidth + 'px'
        canvas.style.height = fullHeight + 'px'
        // Match the matte's easing on both beats. Interpolating corresponding
        // picture and aperture edges keeps every exposed pixel inside the art.
        camera = canvas.animate(
          [
            {
              ...openGate,
              transform: `translate3d(${imageBounds.x}px,${imageBounds.y}px,0) scale(${imageBounds.width / fullWidth})`,
            },
            { ...openMattes, transform: centered(gateScale) },
            { transform: centered(1) },
          ],
          { duration: travel, fill: 'forwards' },
        )
      }
      void travelAnimation.finished.then(
        () => {
          settled = true
          blendToBackdrop()
        },
        () => {},
      )
    }
    const stage = host.parentElement
    const video = stage?.querySelector<HTMLVideoElement>('.player-video')
    if (video && typeof video.requestVideoFrameCallback === 'function') {
      const id = video.requestVideoFrameCallback(revealFilm)
      watchFrame = () => video.cancelVideoFrameCallback(id)
    }
    if (stage && host.closest('.player-viewport')) {
      observer = new MutationObserver(blendToBackdrop)
      observer.observe(stage, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-decoded'],
      })
      blendToBackdrop()
    }
    return () => {
      if (host !== next) return
      host = null
      observer?.disconnect()
      watchFrame?.()
      queueMicrotask(() => {
        if (!host) finish()
      })
    }
  }

  return {
    mount,
    finish,
    revealFilm,
    get mounted() {
      return !!host
    },
  }
}
