import { duration, ease } from '../motion/tokens.ts'
import type { capturePlaySource } from './play-projection-source.ts'

/** Reveal the catalogue backdrop beneath its live title and controls. If the
 * original hero has scrolled past the header, keep the dissolve in place. */
export function returnBannerArtwork(
  banner: HTMLElement,
  shot: ReturnType<typeof capturePlaySource>,
  onFinished: () => void,
) {
  const target = banner.getBoundingClientRect()
  if (
    !target.width ||
    !target.height ||
    target.bottom <= 0 ||
    target.top >= window.innerHeight ||
    target.right <= 0 ||
    target.left >= window.innerWidth
  )
    return
  const { canvas, imageBounds, bounds } = shot
  const inset = [
    bounds.top - target.top,
    target.right - bounds.right,
    target.bottom - bounds.bottom,
    bounds.left - target.left,
  ]
  const effects: Animation[] = []
  let shade: HTMLElement | undefined
  let done = false
  const finish = () => {
    if (done) return
    done = true
    for (const effect of effects) effect.cancel()
    shade?.remove()
    canvas?.remove()
    if (canvas) canvas.width = canvas.height = 0
    onFinished()
  }
  const animate = (node: Element, frames: Keyframe[]) => {
    effects.push(
      node.animate(frames, {
        duration: duration.panel * 1000,
        easing: `cubic-bezier(${ease.inOut.join(',')})`,
        fill: 'both',
      }),
    )
  }
  try {
    if (canvas && imageBounds && inset.every((edge) => edge >= -1)) {
      const crop = inset.map((edge) => Math.max(0, edge) + 'px').join(' ')
      animate(banner, [
        { clipPath: `inset(${crop} round ${shot.radius}px)` },
        { clipPath: 'inset(0px round 0px)' },
      ])
      Object.assign(canvas.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        zIndex: '1',
        width: canvas.width + 'px',
        height: canvas.height + 'px',
        maxWidth: 'none',
        transformOrigin: '0 0',
        pointerEvents: 'none',
      })
      canvas.setAttribute('aria-hidden', 'true')
      banner.append(canvas)
      const scale = Math.max(
        target.width / canvas.width,
        target.height / canvas.height,
      )
      const camera = (x: number, y: number, zoom: number) =>
        `translate3d(${x}px, ${y}px, 0) scale(${zoom})`
      animate(canvas, [
        {
          transform: camera(
            imageBounds.left - target.left,
            imageBounds.top - target.top,
            imageBounds.width / canvas.width,
          ),
          opacity: 1,
        },
        { opacity: 1, offset: 0.2 },
        {
          transform: camera(
            (target.width - canvas.width * scale) / 2,
            (target.height - canvas.height * scale) / 2,
            scale,
          ),
          opacity: 0,
        },
      ])
      if (shot.shade) {
        shade = document.createElement('span')
        shade.setAttribute('aria-hidden', 'true')
        Object.assign(shade.style, {
          position: 'absolute',
          zIndex: '2',
          backgroundImage: shot.shade,
          pointerEvents: 'none',
          top: '0',
          left: '0',
          width: bounds.width + 'px',
          height: bounds.height + 'px',
          transformOrigin: '0 0',
        })
        banner.append(shade)
        animate(shade, [
          { transform: camera(inset[3], inset[0], 1), opacity: 1 },
          {
            transform: `translate3d(0, 0, 0) scale(${target.width / bounds.width}, ${target.height / bounds.height})`,
            opacity: 0,
          },
        ])
      }
      const grade = banner.parentElement?.querySelector(
        ':scope > .home-hero-shade',
      )
      if (grade)
        animate(grade, [
          { opacity: 0 },
          { opacity: getComputedStyle(grade).opacity },
        ])
    } else {
      const opacity = Number(getComputedStyle(banner).opacity)
      animate(banner, [{ opacity: opacity * 0.45 }, { opacity }])
    }
    void effects[0].finished.then(finish, finish)
  } catch {
    finish()
    return
  }
  return finish
}
