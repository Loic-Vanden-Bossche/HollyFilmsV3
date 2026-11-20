import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import { scrollPageTo } from './page-scroll.ts'

type Place = { y: number; rails: Map<string, number>; focus?: string }

const tracks = '[data-home-shelf] .horizontal-rail-track, .library-episode-rail'
const railKey = (track: HTMLElement) =>
  track.closest<HTMLElement>('[data-home-shelf]')?.dataset.homeShelf ??
  'episodes'

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
      const active = document.activeElement
      const control = active?.closest<HTMLElement>(
        '[data-media-id], [data-collection-id]',
      )
      const shelf =
        active?.closest<HTMLElement>('[data-home-shelf]')?.dataset.homeShelf
      const shelfScope = shelf
        ? '[data-home-shelf="' + CSS.escape(shelf) + '"] '
        : ''
      const mediaScope = control?.closest('header')
        ? 'header '
        : control?.closest('[data-grid-item]')
          ? '[data-grid-item] '
          : shelfScope
      const focus = control?.dataset.collectionId
        ? '[data-collection-id="' +
          CSS.escape(control.dataset.collectionId) +
          '"] .collection-trigger'
        : control?.dataset.mediaId
          ? mediaScope +
            '[data-media-id="' +
            CSS.escape(control.dataset.mediaId) +
            '"] .media-tile-select'
          : active?.matches('.home-shelf-link')
            ? shelfScope + '.home-shelf-link'
            : undefined
      const rails = new Map<string, number>()
      surface?.querySelectorAll<HTMLElement>(tracks).forEach((track) => {
        if (track.scrollLeft > 0) rails.set(railKey(track), track.scrollLeft)
      })
      places.current.set(previous.current, {
        y: window.scrollY,
        rails,
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
      scrollPageTo(0)
      return
    }
    // A virtual grid acquires its full scroll height after measurement. Stop
    // restoring as soon as the position is available or the user takes over.
    const root = content.current!
    let frame = 0
    let requestedY: number | undefined
    const requestedLeft = new WeakMap<HTMLElement, number>()
    const position = () => {
      // A smooth scroll has intermediate offsets. Only retarget it when more
      // content becomes reachable, never on every scroll or render.
      const documentHeight = document.documentElement.scrollHeight
      const y = Math.min(
        place.y,
        Math.max(0, documentHeight - document.documentElement.clientHeight),
      )
      if (requestedY !== y) {
        requestedY = y
        scrollPageTo(y)
      }
      const surface = root.querySelector('[data-present="true"]')
      let restoredRails = 0
      surface?.querySelectorAll<HTMLElement>(tracks).forEach((track) => {
        const offset = place.rails.get(railKey(track))
        if (offset != null) {
          const left = Math.min(offset, track.scrollWidth - track.clientWidth)
          if (requestedLeft.get(track) !== left) {
            requestedLeft.set(track, left)
            track.scrollTo({ left })
          }
          if (Math.abs(track.scrollLeft - offset) < 2) restoredRails++
        }
      })
      const trigger =
        place.focus && surface?.querySelector<HTMLElement>(place.focus)
      if (trigger && document.activeElement !== trigger)
        trigger.focus({ preventScroll: true })
      if (
        Math.abs(window.scrollY - place.y) < 2 &&
        restoredRails === place.rails.size &&
        (!place.focus || trigger)
      )
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
      document.removeEventListener('scrollend', schedule, true)
      window.removeEventListener('pointerdown', stop, true)
      window.removeEventListener('wheel', stop, true)
      window.removeEventListener('touchmove', stop, true)
      window.removeEventListener('keydown', stop, true)
    }
    const timer = setTimeout(stop, 2000)
    resize.observe(root)
    mutations.observe(root, { childList: true, subtree: true })
    document.addEventListener('scrollend', schedule, true)
    window.addEventListener('pointerdown', stop, true)
    window.addEventListener('wheel', stop, { capture: true, passive: true })
    window.addEventListener('touchmove', stop, { capture: true, passive: true })
    window.addEventListener('keydown', stop, true)
    schedule()
    return stop
  }, [page, content])
  return save
}
