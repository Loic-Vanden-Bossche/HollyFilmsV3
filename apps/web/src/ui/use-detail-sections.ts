import { useEffect, useState, type RefObject } from 'react'

export const detailSections = [
  ['detail-overview', 'Présentation'],
  ['detail-providers', 'Disponibilités'],
  ['detail-reviews', 'Critiques'],
  ['detail-cast', 'Distribution'],
  ['detail-scenes', 'Scènes'],
  ['detail-related', 'À découvrir'],
] as const

type SectionId = (typeof detailSections)[number][0]

export function useDetailSections(
  scope: RefObject<HTMLDialogElement | null>,
  reduced: boolean | null,
) {
  const [active, setActive] = useState<SectionId>('detail-overview')

  useEffect(() => {
    const dialog = scope.current
    if (!dialog) return
    const toolbar = dialog.querySelector<HTMLElement>('.detail-toolbar')!
    const sections = detailSections.map(([id]) => ({
      id,
      node: dialog.querySelector<HTMLElement>('#' + id),
    }))
    const scrollMargin = sections[0].node
      ? parseFloat(getComputedStyle(sections[0].node).scrollMarginTop) || 0
      : 0
    let frame = 0
    const update = () => {
      frame = 0
      // The section crossing just below the sticky toolbar becomes current.
      const boundary =
        Math.max(
          toolbar.getBoundingClientRect().bottom + 16,
          dialog.getBoundingClientRect().top + dialog.clientTop + scrollMargin,
        ) + 2
      let next: SectionId = 'detail-overview'
      for (const { id, node } of sections) {
        if (node && node.getBoundingClientRect().top <= boundary) next = id
      }
      if (
        dialog.scrollHeight > dialog.clientHeight + 2 &&
        dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight - 2
      )
        next = 'detail-related'
      setActive((previous) => (previous === next ? previous : next))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const resize = new ResizeObserver(schedule)
    resize.observe(dialog)
    resize.observe(toolbar)
    for (const { node } of sections) if (node) resize.observe(node)
    const content = dialog.querySelector('.detail-sections')
    if (content) resize.observe(content)
    dialog.addEventListener('scroll', schedule, { passive: true })
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      dialog.removeEventListener('scroll', schedule)
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
    if (offset)
      nav.scrollBy({ left: offset, behavior: reduced ? 'instant' : 'smooth' })
  }, [active, reduced, scope])

  return active
}
