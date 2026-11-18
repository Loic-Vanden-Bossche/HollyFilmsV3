import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { duration, ease } from '../motion/tokens.ts'
import { ArtworkHeroContext } from './artwork-hero-context.ts'
import type { ArtworkEntry, ArtworkRegistry } from './artwork-hero-context.ts'
import './artwork-hero.css'

type Frame = {
  x: number
  y: number
  width: number
  height: number
  radius: number
}
type Snapshot = {
  entry: ArtworkEntry
  frame: Frame
  src: string
  aspect: number
  position: [number, number]
}
type Destination = 'details' | 'catalogue' | 'player'
type Flight = {
  id: number
  from: Snapshot
  to: Frame
  target: ArtworkEntry
  destination: Destination
}

function frame(element: HTMLElement): Frame | undefined {
  if (!element.isConnected || element.closest('dialog:not([open])')) return
  const rect = element.getBoundingClientRect()
  if (
    rect.width < 2 ||
    rect.height < 2 ||
    rect.bottom <= 0 ||
    rect.right <= 0 ||
    rect.top >= innerHeight ||
    rect.left >= innerWidth
  )
    return
  const edge =
    element.closest('.media-tile-image, .media-detail-poster') ?? element
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    radius: parseFloat(getComputedStyle(edge).borderTopLeftRadius) || 0,
  }
}

function snapshot(entry: ArtworkEntry): Snapshot | undefined {
  const image = entry.element.querySelector('img')
  if (!image?.complete || !image.naturalWidth) return
  const bounds = frame(entry.element)
  if (!bounds) return
  const coordinates = getComputedStyle(image).objectPosition.split(' ')
  const fraction = (value: string) =>
    value?.endsWith('%') ? parseFloat(value) / 100 : 0.5
  return {
    entry: { ...entry },
    frame: bounds,
    src: image.currentSrc || image.src,
    aspect: image.naturalWidth / image.naturalHeight,
    position: [fraction(coordinates[0]), fraction(coordinates[1])],
  }
}

// A fixed-size image plane changes scale uniformly. The crop interpolates
// independently, including between a poster, a panoramic hero and the screen.
function plane(
  rect: Frame,
  aspect: number,
  position: [number, number],
  base: number,
) {
  const width = Math.max(rect.width, rect.height * aspect)
  const height = width / aspect
  const left = (width - rect.width) * position[0]
  const top = (height - rect.height) * position[1]
  const scale = width / base
  const clip = [
    top / height,
    (width - rect.width - left) / width,
    (height - rect.height - top) / height,
    left / width,
  ]
    .map((value) => value * 100 + '%')
    .join(' ')
  return {
    x: rect.x - left,
    y: rect.y - top,
    scale,
    clipPath: 'inset(' + clip + ' round ' + rect.radius / scale + 'px)',
  }
}

export function ArtworkHeroProvider({ children }: { children: ReactNode }) {
  const reduced = usePerformanceReducedMotion()
  const [flight, setFlight] = useState<Flight>()
  const active = useRef<Flight | undefined>(undefined)
  const serial = useRef(0)
  const popover = useRef<HTMLDivElement>(null)
  const entries = useRef(new Map<HTMLElement, ArtworkEntry>())
  const origins = useRef(
    new WeakMap<
      HTMLDialogElement,
      { card: ArtworkEntry; detail: ArtworkEntry }
    >(),
  )
  const expiry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const intent = useRef<
    { images: Snapshot[]; destination: Destination; at: number } | undefined
  >(undefined)

  const registry = useMemo<ArtworkRegistry>(() => {
    const cancel = () => {
      clearTimeout(expiry.current)
      intent.current = undefined
      if (active.current) {
        active.current = undefined
        setFlight(undefined)
      }
    }
    const start = (
      from: Snapshot,
      target: ArtworkEntry,
      destination: Destination,
    ) => {
      const to = frame(target.element)
      if (!to || reduced || document.hidden || !popover.current?.showPopover)
        return
      const value = { id: ++serial.current, from, target, to, destination }
      active.current = value
      setFlight(value)
    }
    return {
      capture(button, destination) {
        cancel()
        if (reduced || document.hidden || !popover.current?.showPopover) return
        const scope = button.closest(
          '.media-tile, .library-film-feature, .library-series-feature, .home-carousel, .media-dialog',
        )
        if (!scope) return
        const selectors = scope.matches('.media-dialog')
          ? '.detail-art-reveal .media-artwork, .media-detail-poster .media-artwork'
          : scope.matches('.home-carousel')
            ? '.hero-backdrop .media-artwork'
            : '.media-artwork'
        // Measure only the artwork next to the actual control, even when a
        // virtualized catalogue contains multiple copies of the same film.
        const images: Snapshot[] = []
        for (const node of scope.querySelectorAll<HTMLElement>(selectors)) {
          const entry = entries.current.get(node)
          const from = entry && snapshot(entry)
          if (from) images.push(from)
        }
        if (images.length) {
          intent.current = { images, destination, at: performance.now() }
          expiry.current = setTimeout(() => {
            intent.current = undefined
          }, 1500)
        }
      },
      add(entry) {
        entries.current.set(entry.element, entry)
        let scheduled = 0
        const pending = intent.current
        const destination = entry.element.matches('.player-artwork')
          ? 'player'
          : entry.element.closest('.media-detail-poster, .detail-art-reveal')
            ? 'details'
            : undefined
        if (pending && destination === pending.destination) {
          const from = pending.images.find(
            (value) => value.entry.key === entry.key,
          )
          if (from)
            scheduled = requestAnimationFrame(() => {
              if (
                pending !== intent.current ||
                performance.now() - pending.at > 1500
              )
                return
              const dialog = entry.element.closest('dialog')
              if (!frame(entry.element)) return
              if (dialog && destination === 'details')
                origins.current.set(dialog, { card: from.entry, detail: entry })
              intent.current = undefined
              clearTimeout(expiry.current)
              start(from, entry, destination)
            })
        }
        return () => {
          cancelAnimationFrame(scheduled)
          entries.current.delete(entry.element)
          if (active.current?.target.element === entry.element) cancel()
        }
      },
      update(element, blob) {
        const entry = entries.current.get(element)
        if (entry) entry.blob = blob
      },
      returnToOrigin(dialog) {
        const origin = origins.current.get(dialog)
        if (!origin) return
        origins.current.delete(dialog)
        // An interrupted opening reverses from the current visible crop.
        const current = active.current
        let from = snapshot(origin.detail)
        if (current?.target === origin.detail) {
          const crop = popover.current?.querySelector<HTMLElement>(
            '.artwork-hero-bounds',
          )
          const bounds = crop && frame(crop)
          if (bounds) from = { ...current.from, frame: bounds }
        }
        cancel()
        if (from) start(from, origin.card, 'catalogue')
      },
      cancel,
    }
  }, [reduced])

  useEffect(() => {
    const clear = () => {
      intent.current = undefined
      registry.cancel()
    }
    clear()
    const capture = (event: MouseEvent) => {
      const control =
        event.target instanceof Element &&
        event.target.closest<HTMLElement>('[data-artwork-open]')
      if (!control || !control.closest('.media-dialog, .home-page')) return
      registry.capture(
        control,
        control.dataset.artworkOpen === 'player' ? 'player' : 'details',
      )
    }
    const back = () => {
      const route = new URLSearchParams(location.search)
      const dialog = document.querySelector<HTMLDialogElement>(
        '.media-dialog[open]',
      )
      if (dialog && !route.has('media') && !route.has('play'))
        registry.returnToOrigin(dialog)
    }
    window.addEventListener('popstate', back, true)
    document.addEventListener('click', capture, true)
    window.addEventListener('resize', clear)
    window.addEventListener('wheel', clear, { passive: true, capture: true })
    window.addEventListener('touchmove', clear, {
      passive: true,
      capture: true,
    })
    document.addEventListener('visibilitychange', clear)
    return () => {
      clearTimeout(expiry.current)
      window.removeEventListener('popstate', back, true)
      document.removeEventListener('click', capture, true)
      window.removeEventListener('resize', clear)
      window.removeEventListener('wheel', clear, true)
      window.removeEventListener('touchmove', clear, true)
      document.removeEventListener('visibilitychange', clear)
    }
  }, [registry])
  useLayoutEffect(() => {
    if (flight && !reduced) popover.current?.showPopover?.()
    else popover.current?.hidePopover?.()
  }, [flight, reduced])

  return (
    <ArtworkHeroContext.Provider value={registry}>
      {children}
      {createPortal(
        <div
          ref={popover}
          popover="manual"
          className="artwork-hero-layer"
          aria-hidden="true"
        >
          {flight && !reduced && (
            <ArtworkFlight
              key={flight.id}
              flight={flight}
              onComplete={() => {
                if (active.current === flight) registry.cancel()
              }}
            />
          )}
        </div>,
        document.body,
      )}
    </ArtworkHeroContext.Provider>
  )
}

function ArtworkFlight({
  flight,
  onComplete,
}: {
  flight: Flight
  onComplete: () => void
}) {
  const { from, to, destination } = flight
  // Keep authenticated artwork alive if its original card is unmounted.
  const [src, setSrc] = useState(from.src)
  useLayoutEffect(() => {
    if (!from.entry.blob) return
    const url = URL.createObjectURL(from.entry.blob)
    // oxlint-disable-next-line react/set-state-in-effect
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [from])
  const time = destination === 'catalogue' ? duration.panel : duration.scene
  useLayoutEffect(() => {
    const reveal = flight.target.element.animate(
      [{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }],
      { duration: time * 1000 },
    )
    return () => reveal.cancel()
  }, [flight, time])
  const base = Math.max(from.frame.width, to.width)
  const start = plane(from.frame, from.aspect, from.position, base)
  const end = plane(to, from.aspect, [0.5, 0.5], base)
  return (
    <div data-artwork-flight="true" data-artwork-destination={destination}>
      <motion.div
        className="artwork-hero-flight"
        style={{
          width: base,
          height: base / from.aspect,
          transformOrigin: '0 0',
        }}
        initial={{ ...start, opacity: 1 }}
        animate={{ ...end, opacity: [1, 1, 0] }}
        transition={{
          duration: time,
          ease: ease.inOut,
          opacity: { duration: time, times: [0, 0.76, 1] },
        }}
        onAnimationComplete={onComplete}
      >
        <img src={src} alt="" />
      </motion.div>
      <motion.div
        className="artwork-hero-bounds"
        style={{ width: to.width, height: to.height, transformOrigin: '0 0' }}
        initial={{
          x: from.frame.x,
          y: from.frame.y,
          scaleX: from.frame.width / to.width,
          scaleY: from.frame.height / to.height,
        }}
        animate={{ x: to.x, y: to.y, scaleX: 1, scaleY: 1 }}
        transition={{ duration: time, ease: ease.inOut }}
      />
    </div>
  )
}
