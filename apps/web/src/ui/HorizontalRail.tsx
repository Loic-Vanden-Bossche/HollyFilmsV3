import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './horizontal-rail.css'

export function HorizontalRail({
  children,
  trackClassName,
  previousLabel,
  nextLabel,
  step = 'page',
}: {
  children: ReactNode
  trackClassName: string
  previousLabel: string
  nextLabel: string
  step?: 'card' | 'page'
}) {
  const id = useId()
  const track = useRef<HTMLDivElement>(null)
  const previous = useRef<HTMLButtonElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const focusAfterScroll = useRef<HTMLElement | null>(null)
  const [edges, setEdges] = useState({ back: false, forward: false })

  useLayoutEffect(() => {
    const node = track.current!
    const measure = () => {
      const back = node.scrollLeft > 1
      const forward = node.scrollWidth - node.clientWidth - node.scrollLeft > 1
      // Keep keyboard focus in the rail when its focused arrow disappears.
      if (!forward && next.current === document.activeElement)
        focusAfterScroll.current = back ? previous.current : node
      else if (!back && previous.current === document.activeElement)
        focusAfterScroll.current = forward ? next.current : node
      setEdges((last) =>
        last.back === back && last.forward === forward
          ? last
          : { back, forward },
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    for (const child of node.children) observer.observe(child)
    let frame = 0
    const childrenObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const child of record.removedNodes)
          if (child instanceof Element) observer.unobserve(child)
        for (const child of record.addedNodes)
          if (child instanceof Element) observer.observe(child)
      }
      // Removing or reordering cards can change the scroll extent without
      // resizing any remaining card. Coalesce that measurement before paint.
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    childrenObserver.observe(node, { childList: true })
    node.addEventListener('scroll', measure, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      childrenObserver.disconnect()
      observer.disconnect()
      node.removeEventListener('scroll', measure)
    }
  }, [])

  useLayoutEffect(() => {
    focusAfterScroll.current?.focus({ preventScroll: true })
    focusAfterScroll.current = null
  }, [edges])

  function move(direction: number) {
    const node = track.current!
    const first = node.firstElementChild
    const second = first?.nextElementSibling
    const distance =
      step === 'card' &&
      first instanceof HTMLElement &&
      second instanceof HTMLElement
        ? second.offsetLeft - first.offsetLeft
        : node.clientWidth * 0.85
    node.scrollBy({ left: direction * distance })
  }

  return (
    <div className="horizontal-rail">
      <button
        type="button"
        className="horizontal-rail-arrow horizontal-rail-arrow--previous"
        ref={previous}
        aria-label={previousLabel}
        aria-controls={id}
        disabled={!edges.back}
        onClick={() => move(-1)}
      >
        <ChevronLeft aria-hidden="true" viewBox="5 3 14 18" />
      </button>
      <button
        type="button"
        className="horizontal-rail-arrow horizontal-rail-arrow--next"
        ref={next}
        aria-label={nextLabel}
        aria-controls={id}
        disabled={!edges.forward}
        onClick={() => move(1)}
      >
        <ChevronRight aria-hidden="true" viewBox="5 3 14 18" />
      </button>
      <div
        className={'horizontal-rail-track ' + trackClassName}
        id={id}
        ref={track}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
