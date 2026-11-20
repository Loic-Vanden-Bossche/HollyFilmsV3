/** The hover animation moves the full surface and reveals only part of it. */
export function paintedArtworkBounds(surface: HTMLElement): DOMRect {
  const bounds = surface.getBoundingClientRect()
  const panel = surface.parentElement
  if (
    !surface.style.clipPath ||
    !panel?.classList.contains('artwork-preview-panel')
  )
    return bounds

  const progress = Number.parseFloat(
    panel.style.getPropertyValue('--preview-progress'),
  )
  const slot = panel.closest('.artwork-preview')
  if (!slot || !Number.isFinite(progress)) return bounds
  const from = slot.getBoundingClientRect()
  const to = panel.getBoundingClientRect()
  const remaining = 1 - progress
  return new DOMRect(
    bounds.left,
    bounds.top,
    bounds.width - (to.width - from.width) * remaining,
    bounds.height - (to.height - from.height) * remaining,
  )
}
