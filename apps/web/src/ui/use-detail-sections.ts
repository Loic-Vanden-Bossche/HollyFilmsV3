import { useEffect, useRef, useState, type RefObject } from 'react'

export const detailSections = [
  ['detail-overview', 'Présentation'],
  ['detail-providers', 'Disponibilités'],
  ['detail-reviews', 'Critiques'],
  ['detail-cast', 'Distribution'],
  ['detail-scenes', 'Scènes'],
  ['detail-related', 'À découvrir'],
] as const

type SectionId = (typeof detailSections)[number][0]

function visibleTop(dialog: HTMLDialogElement) {
  return (
    dialog.getBoundingClientRect().top +
    dialog.clientTop +
    parseFloat(getComputedStyle(dialog).scrollPaddingTop)
  )
}

/** Move the dialog alone so the catalogue stays anchored behind it. */
export function scrollToDetailContent(
  dialog: HTMLDialogElement,
  target: HTMLElement,
  align: 'start' | 'nearest' = 'start',
) {
  const viewportTop = visibleTop(dialog)
  const bounds = target.getBoundingClientRect()
  const viewportBottom =
    dialog.getBoundingClientRect().top + dialog.clientTop + dialog.clientHeight
  const delta =
    align === 'start' || bounds.top < viewportTop
      ? bounds.top - viewportTop
      : Math.max(0, bounds.bottom - viewportBottom)
  const top = Math.max(
    0,
    Math.min(
      dialog.scrollHeight - dialog.clientHeight,
      dialog.scrollTop + delta,
    ),
  )
  const moves = Math.abs(top - dialog.scrollTop) > 1
  if (moves || align === 'start') dialog.scrollTo({ top })
  return moves
}

export function useDetailSections(scope: RefObject<HTMLDialogElement | null>) {
  const [active, setActive] = useState<SectionId>('detail-overview')
  const requested = useRef<SectionId | null>(null)

  useEffect(() => {
    const dialog = scope.current
    if (!dialog) return
    const toolbar = dialog.querySelector<HTMLElement>('.detail-toolbar')!
    const sections = detailSections.map(([id]) => ({
      id,
      node: dialog.querySelector<HTMLElement>('#' + id),
    }))
    let frame = 0
    const update = () => {
      frame = 0
      // The section crossing just below the sticky toolbar becomes current.
      const boundary = visibleTop(dialog) + 2
      let next: SectionId = 'detail-overview'
      for (const { id, node } of sections) {
        if (node && node.getBoundingClientRect().top <= boundary) next = id
      }
      if (
        dialog.scrollHeight > dialog.clientHeight + 2 &&
        dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight - 2
      )
        next = 'detail-related'
      // Keep a tapped tab visible on a narrow screen as intermediate
      // sections pass underneath it. Manual scrolling follows the content.
      if (requested.current && requested.current !== next) return
      requested.current = null
      setActive(next)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const resumeTracking = () => {
      requested.current = null
      schedule()
    }
    const resize = new ResizeObserver(() => {
      dialog.style.setProperty(
        '--detail-toolbar-height',
        toolbar.offsetHeight + 'px',
      )
      schedule()
    })
    resize.observe(dialog)
    resize.observe(toolbar)
    for (const { node } of sections) if (node) resize.observe(node)
    const content = dialog.querySelector('.detail-sections')
    if (content) resize.observe(content)
    dialog.addEventListener('scroll', schedule, { passive: true })
    dialog.addEventListener('scrollend', resumeTracking)
    dialog.addEventListener('wheel', resumeTracking, { passive: true })
    dialog.addEventListener('touchmove', resumeTracking, { passive: true })
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      dialog.removeEventListener('scroll', schedule)
      dialog.removeEventListener('scrollend', resumeTracking)
      dialog.removeEventListener('wheel', resumeTracking)
      dialog.removeEventListener('touchmove', resumeTracking)
      dialog.style.removeProperty('--detail-toolbar-height')
    }
  }, [scope])

  useEffect(() => {
    const nav = scope.current?.querySelector<HTMLElement>('.detail-section-nav')
    const button = nav?.querySelector<HTMLElement>(
      `[aria-controls="${active}"]`,
    )
    if (!nav || !button) return
    const bounds = nav.getBoundingClientRect()
    const target = button.getBoundingClientRect()
    const offset =
      target.left < bounds.left + 12
        ? target.left - bounds.left - 12
        : target.right > bounds.right - 12
          ? target.right - bounds.right + 12
          : 0
    // Scroll only the horizontal navigation, never the dialog or keyboard focus.
    if (offset) nav.scrollBy({ left: offset })
  }, [active, scope])

  function selectSection(id: SectionId) {
    const dialog = scope.current
    const target = dialog?.querySelector<HTMLElement>('#' + id)
    if (!dialog || !target) return
    requested.current = scrollToDetailContent(dialog, target) ? id : null
    setActive(id)
  }
  return { active, selectSection }
}
