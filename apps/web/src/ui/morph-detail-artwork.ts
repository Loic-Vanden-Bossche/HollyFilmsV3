import { duration, ease } from '../motion/tokens.ts'
import type { capturePlaySource } from './play-projection-source.ts'

const mix = (from: number, to: number, t: number) => from + (to - from) * t
const transform = (x: number, y: number, sx: number, sy: number) =>
  `translate3d(${x}px, ${y}px, 0) scale(${sx}, ${sy})`

/** The native dialog already owns the card frame. Move it so the real header
 * travels between the two pictures, then open the crop to reveal the sheet. */
export function morphDetailArtwork(
  dialog: HTMLDialogElement,
  shot: ReturnType<typeof capturePlaySource>,
  onFinish: () => void,
) {
  const art = dialog.querySelector<HTMLElement>('.media-detail-art')
  const revealed = art?.querySelector<HTMLElement>('.detail-art-reveal')
  const { bounds, imageBounds, canvas } = shot
  if (!dialog.open || !art || !revealed || !canvas || !imageBounds) return
  const target = art.getBoundingClientRect()
  const sheet = dialog.getBoundingClientRect()
  if (!target.width || !target.height || !bounds.width || !bounds.height) return

  const left = target.left - sheet.left
  const right = sheet.right - target.right
  const top = target.top - sheet.top
  const bottom = sheet.bottom - target.bottom
  const startX = bounds.width / target.width
  const startY = bounds.height / target.height
  const targetRadius =
    parseFloat(getComputedStyle(dialog).borderTopLeftRadius) || 0
  const originScale = imageBounds.width / canvas.width
  const finalScale = Math.max(
    target.width / canvas.width,
    target.height / canvas.height,
  )
  const finalX = (target.width - canvas.width * finalScale) / 2
  const finalY = (target.height - canvas.height * finalScale) / 2

  // A portrait can grow wide much faster than it grows tall. Precompute the
  // inverse scales on the same timeline, keeping both pictures proportional
  // without measuring layout or running script on each animation frame.
  const crop: Keyframe[] = []
  const outgoing: Keyframe[] = []
  const incoming: Keyframe[] = []
  for (let i = 0; i <= 48; i++) {
    const t = i / 48
    const sx = mix(startX, 1, t)
    const sy = mix(startY, 1, t)
    const reveal = Math.max(0, (t - 0.35) / 0.65)
    const shadow = 180 * Math.max(0, (t - 0.87) / 0.13)
    const radius = mix(shot.radius, targetRadius, t)
    const xInset = (edge: number) => edge * (1 - reveal / sx) - shadow + 'px'
    const yInset = (edge: number) => edge * (1 - reveal / sy) - shadow + 'px'
    crop.push({
      clipPath: `inset(${yInset(top)} ${xInset(right)} ${yInset(bottom)} ${xInset(left)} round ${radius / sx}px / ${radius / sy}px)`,
    })
    const scale = mix(originScale, finalScale, t)
    outgoing.push({
      transform: transform(
        mix(imageBounds.left - bounds.left, finalX, t) / sx,
        mix(imageBounds.top - bounds.top, finalY, t) / sy,
        scale / sx,
        scale / sy,
      ),
    })
    const cover = Math.max(sx, sy)
    incoming.push({
      transform: transform(
        (target.width * (1 - cover / sx)) / 2,
        (target.height * (1 - cover / sy)) / 2,
        cover / sx,
        cover / sy,
      ),
    })
  }

  const travel = duration.scene * 1000
  const timing: KeyframeAnimationOptions = {
    duration: travel,
    easing: `cubic-bezier(${ease.inOut.join(',')})`,
    fill: 'both',
  }
  const effects: Animation[] = []
  let observer: MutationObserver | undefined
  let blending: Animation | undefined
  let arrived = false
  let released = false
  const land = () => {
    if (arrived) return
    arrived = true
    // A cold backdrop may still be loading. Leave a responsive, static image
    // inside its own header while releasing all navigation and geometry state.
    canvas.style.width = canvas.style.height = '100%'
    canvas.style.objectFit = 'cover'
    for (const effect of effects) effect.cancel()
    effects.length = 0
    delete dialog.dataset.detailMorph
    art.style.removeProperty('--detail-source-shade')
    delete art.dataset.sourceShade
    if (released) dialog.removeEventListener('close', onClose)
    onFinish()
  }
  const release = () => {
    if (released) return
    released = true
    observer?.disconnect()
    if (arrived) dialog.removeEventListener('close', onClose)
    blending?.cancel()
    canvas.remove()
    canvas.width = canvas.height = 0
  }
  const skip = () => {
    land()
    release()
  }
  // close() queues its event. The same dialog can have reopened by the time
  // an earlier close is delivered (including React's StrictMode replay).
  const onClose = () => {
    if (!dialog.open) skip()
  }
  const animate = (node: Element, frames: Keyframe[], options = timing) => {
    const effect = node.animate(frames, options)
    effects.push(effect)
    return effect
  }
  const fade = (warm: boolean) => {
    if (blending || released) return
    observer?.disconnect()
    if (
      document.hidden ||
      document.documentElement.dataset.performance === 'light' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      release()
      return
    }
    blending = canvas.animate(
      [{ opacity: 1 }, { opacity: 1, offset: warm ? 0.24 : 0 }, { opacity: 0 }],
      warm ? timing : { ...timing, duration: duration.panel * 1000 },
    )
    void blending.finished.then(release, release)
  }
  try {
    canvas.className = 'detail-morph-picture'
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.width = canvas.width + 'px'
    canvas.style.height = canvas.height + 'px'
    dialog.dataset.detailMorph = ''
    if (shot.shade) {
      art.dataset.sourceShade = ''
      art.style.setProperty('--detail-source-shade', shot.shade)
    }
    art.append(canvas)
    const movement = animate(dialog, [
      {
        transform: transform(
          bounds.left - sheet.left - left * startX,
          bounds.top - sheet.top - top * startY,
          startX,
          startY,
        ),
      },
      { transform: transform(0, 0, 1, 1) },
    ])
    animate(dialog, crop)
    animate(canvas, outgoing)
    animate(revealed, incoming)
    for (const element of dialog.querySelectorAll(
      '.detail-toolbar, .media-detail-body, .detail-sections',
    )) {
      animate(element, [
        { opacity: 0 },
        { opacity: 0, offset: 0.35 },
        { opacity: 1, offset: 0.8 },
        { opacity: 1 },
      ])
    }
    void movement.finished.then(land, skip)
    dialog.addEventListener('close', onClose)
    if (revealed.querySelector('[data-decoded]')) fade(true)
    else {
      observer = new MutationObserver(() => {
        if (revealed.querySelector('[data-decoded]')) fade(false)
      })
      observer.observe(revealed, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-decoded'],
      })
    }
  } catch {
    skip()
    return
  }
  return skip
}
