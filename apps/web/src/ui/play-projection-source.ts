import { paintedArtworkBounds } from './artwork-geometry.ts'

type Bitmap = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
type Source = {
  bounds: DOMRect
  canvas: HTMLCanvasElement | null
  imageBounds: DOMRect | null
  radius: number
  shade?: string
}

function pictureRoots(control: HTMLElement): HTMLElement[] {
  // A collection starts its first member. Its own cover may be a different film.
  if (control.closest('.detail-collection-actions')) return []
  const card = control.closest('.artwork-preview-surface')
  if (card)
    return [...card.querySelectorAll<HTMLElement>('.artwork-preview-hero')]
  if (control.closest('.detail-browser')) return []
  const dialog = control.closest('.media-dialog')
  if (dialog)
    return [
      ...dialog.querySelectorAll<HTMLElement>(
        '.media-detail-art, .media-detail-poster',
      ),
    ]
  const carousel = control.closest('.home-carousel')
  if (carousel) {
    // Outgoing and incoming slides coexist briefly and have distinct titles.
    if (
      carousel.querySelectorAll('.hero-backdrop').length !== 1 ||
      control.closest('.hero-slide-copy[data-present="false"]')
    )
      return []
    return [...carousel.querySelectorAll<HTMLElement>('.home-hero-media')]
  }
  return [
    ...(control
      .closest('.library-movies-intro')
      ?.querySelectorAll<HTMLElement>('.library-movie-scene') ?? []),
  ]
}

function bitmaps(root: HTMLElement): Bitmap[] {
  const video = root.querySelector<HTMLVideoElement>(
    '.hero-video[data-playing] video',
  )
  const candidates: Bitmap[] = []
  // Escape or Play may interrupt a card while its opening image is still visible.
  const moving = root.querySelector<HTMLCanvasElement>('.detail-morph-picture')
  if (moving?.width && Number(getComputedStyle(moving).opacity) >= 0.5)
    candidates.push(moving)
  if (
    video &&
    !video.paused &&
    video.readyState >= 2 &&
    video.videoWidth &&
    Number(getComputedStyle(video.parentElement!).opacity) > 0.05
  )
    candidates.push(video)

  const images = root.matches('.artwork-preview-hero')
    ? root.querySelectorAll<HTMLImageElement>(
        '.artwork-preview-backdrop img, .artwork-preview-trigger img',
      )
    : root.querySelectorAll<HTMLImageElement>(
        '.media-artwork[data-decoded] > img',
      )
  const stills = [...images].filter(
    (img) =>
      !img.hidden &&
      img.complete &&
      img.naturalWidth &&
      (!img.closest('.media-artwork') ||
        img.closest('.media-artwork[data-decoded]')),
  )
  const alternate = stills.find((img) => {
    const layer = img.closest('.artwork-preview-backdrop')
    return layer && Number(getComputedStyle(layer).opacity) >= 0.5
  })
  if (alternate) candidates.push(alternate)
  return candidates.concat(
    stills.filter((img) => !img.closest('.artwork-preview-backdrop')),
  )
}

function artworkShade(root: HTMLElement, bitmap: Bitmap) {
  let style: CSSStyleDeclaration | undefined
  if (root.matches('.media-detail-art, .library-movie-scene')) {
    const layer = bitmap instanceof HTMLCanvasElement ? '::before' : '::after'
    style = getComputedStyle(root, layer)
  } else {
    const scrim = root.matches('.home-hero-media')
      ? root.parentElement?.querySelector('.home-hero-shade')
      : root.querySelector('.artwork-preview-scrim')
    if (scrim) style = getComputedStyle(scrim)
  }
  if (style && style.backgroundImage !== 'none' && Number(style.opacity) > 0.5)
    return style.backgroundImage
}

function fit(
  box: DOMRect,
  width: number,
  height: number,
  mode: string,
  position: string,
) {
  if (mode === 'fill') return box
  const scale =
    mode === 'contain'
      ? Math.min(box.width / width, box.height / height)
      : Math.max(box.width / width, box.height / height)
  const [x, y] = position.split(' ')
  // Computed object-position resolves the app's keywords to percentages.
  const offset = (value: string, space: number) =>
    value.endsWith('px') ? parseFloat(value) : (parseFloat(value) / 100) * space
  return new DOMRect(
    box.left + offset(x, box.width - width * scale),
    box.top + offset(y, box.height - height * scale),
    width * scale,
    height * scale,
  )
}

function intersect(a: DOMRect, b: DOMRect, x = true, y = true) {
  const left = x ? Math.max(a.left, b.left) : a.left
  const top = y ? Math.max(a.top, b.top) : a.top
  return new DOMRect(
    left,
    top,
    Math.max(0, (x ? Math.min(a.right, b.right) : a.right) - left),
    Math.max(0, (y ? Math.min(a.bottom, b.bottom) : a.bottom) - top),
  )
}

function visibleCrop(bitmap: Bitmap, image: DOMRect, viewport: DOMRect) {
  let bounds = intersect(
    intersect(bitmap.getBoundingClientRect(), image),
    viewport,
  )
  let radius = 0
  for (let node = bitmap.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    const x = style.overflowX !== 'visible'
    const y = style.overflowY !== 'visible'
    if (node.matches('.artwork-preview-surface') || x || y) {
      bounds = intersect(bounds, paintedArtworkBounds(node), x, y)
      radius ||= parseFloat(style.borderTopLeftRadius) || 0
    }
    // Top-layer cards escape their rail's clip. A dialog's sticky toolbar
    // does cover its own artwork when its body scrolls behind the toolbar.
    if (node.matches('.media-dialog')) {
      const toolbar = node
        .querySelector('.detail-toolbar')
        ?.getBoundingClientRect()
      if (toolbar)
        bounds = intersect(
          bounds,
          new DOMRect(0, toolbar.bottom, viewport.width, viewport.height),
          false,
        )
      break
    }
    if (node.hasAttribute('popover')) break
  }
  return { bounds, radius }
}

function capture(
  bitmap: Bitmap,
  width: number,
  height: number,
  filter: string,
) {
  // One small GPU draw. Keep the full frame so its crop can open as it travels.
  const scale = Math.min(
    1,
    1280 / Math.max(width, height),
    Math.sqrt((1280 * 720) / (width * height)),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  try {
    ctx.filter = filter
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas
  } catch {
    // A preview can lose its decoder as the pointer or player takes focus.
    return null
  }
}

export function capturePlaySource(control: HTMLElement): Source {
  const viewport = new DOMRect(0, 0, window.innerWidth, window.innerHeight)
  const button = control.getBoundingClientRect()
  const width = Math.min(Math.max(button.width * 0.8, 48), 120, viewport.width)
  const slit = new DOMRect(
    Math.max(
      0,
      Math.min(
        viewport.width - width,
        button.left + (button.width - width) / 2,
      ),
    ),
    Math.max(
      0,
      Math.min(viewport.height - 8, button.top + button.height / 2 - 4),
    ),
    width,
    8,
  )
  const neutral = { bounds: slit, radius: 4, imageBounds: null, canvas: null }
  let offscreen: HTMLImageElement | undefined
  for (const root of pictureRoots(control)) {
    for (const bitmap of bitmaps(root)) {
      const [w, h] =
        bitmap instanceof HTMLVideoElement
          ? [bitmap.videoWidth, bitmap.videoHeight]
          : bitmap instanceof HTMLCanvasElement
            ? [bitmap.width, bitmap.height]
            : [bitmap.naturalWidth, bitmap.naturalHeight]
      const style = getComputedStyle(bitmap)
      const imageBounds = fit(
        bitmap.getBoundingClientRect(),
        w,
        h,
        style.objectFit,
        style.objectPosition,
      )
      const { bounds, radius } = visibleCrop(bitmap, imageBounds, viewport)
      if (bounds.width >= 8 && bounds.height >= 8) {
        const canvas = capture(bitmap, w, h, style.filter)
        if (canvas)
          return {
            bounds,
            radius,
            imageBounds,
            canvas,
            shade: artworkShade(root, bitmap),
          }
      } else if (bitmap instanceof HTMLImageElement) offscreen ??= bitmap
    }
  }
  if (!offscreen) return neutral
  const { naturalWidth: w, naturalHeight: h } = offscreen
  const canvas = capture(offscreen, w, h, getComputedStyle(offscreen).filter)
  return canvas
    ? { ...neutral, canvas, imageBounds: fit(slit, w, h, 'cover', '50% 50%') }
    : neutral
}
