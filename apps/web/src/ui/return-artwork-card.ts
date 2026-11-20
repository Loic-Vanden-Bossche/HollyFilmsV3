import { duration, ease } from '../motion/tokens.ts'
import type { capturePlaySource } from './play-projection-source.ts'

function visibleSlot(slot: HTMLElement, tile: DOMRect) {
  let left = Math.max(tile.left, 0)
  let top = Math.max(tile.top, 0)
  let right = Math.min(tile.right, window.innerWidth)
  let bottom = Math.min(tile.bottom, window.innerHeight)
  for (let node = slot.parentElement; node; node = node.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(node)
    if (overflowX === 'visible' && overflowY === 'visible') continue
    const box = node.getBoundingClientRect()
    if (overflowX !== 'visible') {
      left = Math.max(left, box.left)
      right = Math.min(right, box.right)
    }
    if (overflowY !== 'visible') {
      top = Math.max(top, box.top)
      bottom = Math.min(bottom, box.bottom)
    }
  }
  return new DOMRect(
    left,
    top,
    Math.max(0, right - left),
    Math.max(0, bottom - top),
  )
}

function pictureTransform(x: number, y: number, scale: number) {
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`
}

function coverPicture(width: number, height: number, box: DOMRect) {
  const scale = Math.max(box.width / width, box.height / height)
  return pictureTransform(
    (box.width - width * scale) / 2,
    (box.height - height * scale) / 2,
    scale,
  )
}

/** The dialog has already closed and restored focus. Lift the returned card
 * above its rail only for the short trip back to its reserved slot. */
export function returnArtworkCard(
  frame: HTMLElement,
  from: ReturnType<typeof capturePlaySource>,
  onFinished: () => void,
) {
  const slot = frame.parentElement
  const shell = frame.querySelector<HTMLElement>(
    ':scope > .artwork-preview-shell',
  )
  const { bounds, canvas, imageBounds } = from
  if (
    !slot?.classList.contains('artwork-card-slot') ||
    !shell ||
    shell.hasAttribute('popover') ||
    !canvas ||
    !imageBounds ||
    !bounds.width ||
    !bounds.height ||
    !frame.isConnected ||
    !frame.showPopover ||
    frame.closest('[inert], dialog') ||
    document.querySelector('dialog[open]')
  )
    return
  const tile = frame.getBoundingClientRect()
  const to = visibleSlot(slot, tile)
  if (!to.width || !to.height) return

  // The moving window and both pictures use the same easing. Only the window
  // changes aspect ratio; the backdrop and the live tile each keep their crop.
  const width = Math.max(bounds.width, tile.width)
  const height = Math.max(bounds.height, tile.height)
  const clip = (rect: DOMRect, x: number, y: number, radius: number) =>
    `inset(${y}px ${width - x - rect.width}px ${height - y - rect.height}px ${x}px round ${radius}px)`
  const trigger = shell.querySelector('.artwork-preview-trigger') ?? shell
  const radius = parseFloat(getComputedStyle(trigger).borderTopLeftRadius) || 0
  const timing: KeyframeAnimationOptions = {
    duration: duration.panel * 1000,
    easing: `cubic-bezier(${ease.inOut.join(',')})`,
    fill: 'both',
  }

  const life = new AbortController()
  const shade = from.shade ? document.createElement('span') : null
  const animations: Animation[] = []
  const animate = (node: Element, frames: Keyframe[]) => {
    animations.push(node.animate(frames, timing))
  }
  const reset = () => {
    life.abort()
    for (const animation of animations) animation.cancel()
    canvas.remove()
    canvas.width = canvas.height = 0
    shade?.remove()
    shell.style.removeProperty('width')
    frame.removeAttribute('popover')
    for (const property of ['top', 'left', 'width', 'height'])
      frame.style.removeProperty(property)
    slot.removeAttribute('data-card-away')
  }
  const finish = () => {
    if (life.signal.aborted) return
    reset()
    onFinished()
  }
  try {
    slot.setAttribute('data-card-away', '')
    Object.assign(frame.style, {
      top: `${tile.top}px`,
      left: `${tile.left}px`,
      width: `${width}px`,
      height: `${height}px`,
    })
    shell.style.width = tile.width + 'px'
    canvas.setAttribute('aria-hidden', 'true')
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: canvas.width + 'px',
      height: canvas.height + 'px',
      maxWidth: 'none',
      transformOrigin: '0 0',
      pointerEvents: 'none',
    })
    frame.append(canvas)
    if (shade && from.shade) {
      shade.setAttribute('aria-hidden', 'true')
      Object.assign(shade.style, {
        position: 'absolute',
        inset: '0 auto auto 0',
        width: bounds.width + 'px',
        height: bounds.height + 'px',
        backgroundImage: from.shade,
        pointerEvents: 'none',
        transformOrigin: '0 0',
      })
      frame.append(shade)
      animate(shade, [
        { opacity: 1, transform: 'scale(1, 1)' },
        { opacity: 0, offset: 0.7 },
        {
          opacity: 0,
          transform: `scale(${tile.width / bounds.width}, ${tile.height / bounds.height})`,
        },
      ])
    }
    frame.popover = 'manual'
    frame.showPopover()
    const fullyVisible = to.width === tile.width && to.height === tile.height
    animate(frame, [
      {
        transform: pictureTransform(
          bounds.left - tile.left,
          bounds.top - tile.top,
          1,
        ),
        clipPath: clip(bounds, 0, 0, from.radius),
      },
      {
        transform: pictureTransform(0, 0, 1),
        clipPath: clip(
          to,
          to.left - tile.left,
          to.top - tile.top,
          fullyVisible ? radius : 0,
        ),
      },
    ])
    animate(shell, [
      {
        transform: coverPicture(tile.width, tile.height, bounds),
        transformOrigin: '0 0',
      },
      { transform: 'none', transformOrigin: '0 0' },
    ])
    animate(canvas, [
      {
        transform: pictureTransform(
          imageBounds.left - bounds.left,
          imageBounds.top - bounds.top,
          imageBounds.width / canvas.width,
        ),
        opacity: 1,
      },
      { opacity: 1, offset: 0.22 },
      {
        transform: coverPicture(canvas.width, canvas.height, tile),
        opacity: 0,
      },
    ])
  } catch {
    reset()
    return
  }
  // A newly focused control, an opening dialog, or any input can take over
  // immediately; leave pointer hit testing on the live catalogue underneath.
  const options = { capture: true, passive: true, signal: life.signal }
  for (const event of [
    'pointermove',
    'keydown',
    'focusin',
    'scroll',
    'beforetoggle',
  ])
    document.addEventListener(event, finish, options)
  document.addEventListener(
    'pointerdown',
    (event) => {
      const pressedSlot =
        event.target === slot && event.isPrimary && event.button === 0
      finish()
      if (!pressedSlot) return
      // Pointerdown can hit the reserved slot before the card lands. Retarget
      // the rest of this real gesture to its control, including the click.
      const hit = document.elementFromPoint(event.clientX, event.clientY)
      if (hit && frame.contains(hit)) hit.setPointerCapture(event.pointerId)
    },
    options,
  )
  void animations[0].finished.then(finish, finish)
  return finish
}
