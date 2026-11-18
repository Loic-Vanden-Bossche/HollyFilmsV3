import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'

type Place = { y: number; rail: number; focus?: string }

export function useCatalogueReturn(
  content: RefObject<HTMLElement | null>,
  page: string,
) {
  const places = useRef(new Map<string, Place>())
  const previous = useRef(page)
  const restore = useRef(false)
  const save = useCallback(
    (returning = false) => {
      const surface = content.current?.querySelector('[data-present="true"]')
      const control = document.activeElement?.closest<HTMLElement>(
        '[data-media-id], [data-collection-id]',
      )
      const focus = control?.dataset.collectionId
        ? '[data-collection-id="' +
          CSS.escape(control.dataset.collectionId) +
          '"]'
        : control?.dataset.mediaId
          ? '[data-media-id="' +
            CSS.escape(control.dataset.mediaId) +
            '"] .media-tile-select'
          : undefined
      const rail = surface?.querySelector(
        '.home-resume-rail, .library-episode-rail',
      )
      places.current.set(previous.current, {
        y: window.scrollY,
        rail: rail?.scrollLeft ?? 0,
        focus,
      })
      restore.current = returning
    },
    [content],
  )

  useLayoutEffect(() => {
    const pop = () => save(true)
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [save])

  useLayoutEffect(() => {
    if (previous.current === page) return
    previous.current = page
    const place = restore.current && places.current.get(page)
    restore.current = false
    if (!place) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    // A virtual grid acquires its full scroll height after measurement. Stop
    // restoring as soon as the position is available or the user takes over.
    const root = content.current!
    let frame = 0
    const position = () => {
      window.scrollTo({ top: place.y, behavior: 'instant' })
      const surface = root.querySelector('[data-present="true"]')
      const rail = surface?.querySelector(
        '.home-resume-rail, .library-episode-rail',
      )
      if (rail && place.rail) rail.scrollLeft = place.rail
      const trigger =
        place.focus && surface?.querySelector<HTMLElement>(place.focus)
      if (trigger) trigger.focus({ preventScroll: true })
      if (Math.abs(window.scrollY - place.y) < 2 && (!place.focus || trigger))
        stop()
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(position)
    }
    const resize = new ResizeObserver(schedule)
    const mutations = new MutationObserver(schedule)
    const stop = () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      resize.disconnect()
      mutations.disconnect()
      window.removeEventListener('pointerdown', stop, true)
      window.removeEventListener('wheel', stop, true)
      window.removeEventListener('keydown', stop, true)
    }
    const timer = setTimeout(stop, 2000)
    resize.observe(root)
    mutations.observe(root, { childList: true, subtree: true })
    window.addEventListener('pointerdown', stop, true)
    window.addEventListener('wheel', stop, { capture: true, passive: true })
    window.addEventListener('keydown', stop, true)
    schedule()
    return stop
  }, [page, content])
  return save
}
