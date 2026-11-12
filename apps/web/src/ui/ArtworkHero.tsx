import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArtworkHeroContext as Context } from './artwork-hero-context.ts'
import type {
  ArtworkEntry as Entry,
  ArtworkRegistry as Registry,
} from './artwork-hero-context.ts'
import './artwork-hero.css'

type Frame = {
  x: number
  y: number
  width: number
  height: number
  borderRadius: number
}
type Snapshot = {
  entry: Entry
  frame: Frame
  src: string
  fit: string
  position: string
  at: number
  score: number
  player: boolean
}
type Flight = {
  id: number
  snapshot: Snapshot
  target: Entry
  frame: Frame
  frosted: boolean
  restore: () => void
  hide: () => void
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
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderRadius:
      parseFloat(
        getComputedStyle(element.parentElement ?? element).borderRadius,
      ) || 0,
  }
}

export function ArtworkHeroProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const entries = useRef(new Map<HTMLElement, Entry>())
  const snapshots = useRef(new Map<string, Snapshot>())
  const sequence = useRef(0)
  const scheduled = useRef(new Set<number>())
  const origins = useRef(new WeakMap<HTMLElement, HTMLElement>())
  const active = useRef(new Map<number, Flight>())
  const [flights, setFlights] = useState<Flight[]>([])
  const popover = useRef<HTMLDivElement>(null)

  const registry = useMemo<Registry>(() => {
    const later = (callback: () => void) => {
      const id = requestAnimationFrame(() => {
        scheduled.current.delete(id)
        callback()
      })
      scheduled.current.add(id)
    }
    const transition = (target: Entry) => {
      const snapshot = snapshots.current.get(target.key)
      const destination = frame(target.element)
      const targetIsPlayer = Boolean(
        target.element.closest('.player-artwork-hero'),
      )
      if (
        !snapshot ||
        !destination ||
        // A shared image only travels across the player boundary, never between
        // catalogue cards, carousel slides or details dialogs.
        snapshot.player === targetIsPlayer ||
        snapshot.entry.element === target.element ||
        performance.now() - snapshot.at > 1500
      )
        return
      const a = snapshot.frame
      if (
        Math.abs(a.x - destination.x) +
          Math.abs(a.y - destination.y) +
          Math.abs(a.width - destination.width) +
          Math.abs(a.height - destination.height) <
        8
      )
        return
      snapshots.current.delete(target.key)
      origins.current.set(target.element, snapshot.entry.element)
      const visibility = target.element.style.visibility
      target.element.style.visibility = 'hidden'
      const flight: Flight = {
        id: ++sequence.current,
        snapshot,
        target,
        frame: destination,
        frosted: targetIsPlayer,
        restore: () => {
          target.element.style.visibility = visibility
        },
        hide: () => {
          target.element.style.visibility = 'hidden'
        },
      }
      active.current.set(flight.id, flight)
      setFlights((current) => [...current, flight])
    }
    return {
      add(entry) {
        entries.current.set(entry.element, entry)
        // Native dialogs must have entered the top layer before measuring their artwork.
        later(() => {
          if (entries.current.has(entry.element)) transition(entry)
        })
        return () => {
          entries.current.delete(entry.element)
          const origin = snapshots.current.get(entry.key)
          if (origin?.entry.element !== entry.element) return
          later(() => {
            const modal = document.querySelector('dialog[open]')
            const candidates = [...entries.current.values()].filter(
              (value) =>
                value.key === entry.key &&
                frame(value.element) &&
                (!modal || modal.contains(value.element)),
            )
            const target =
              candidates.find(
                (value) => value.element === origins.current.get(entry.element),
              ) ?? candidates[0]
            if (target) transition(target)
          })
        }
      },
      update(element, blob) {
        const entry = entries.current.get(element)
        if (entry) entry.blob = blob
      },
    }
  }, [])

  useEffect(() => {
    const requests = scheduled.current
    const pending = snapshots.current
    const running = active.current
    let expiry: ReturnType<typeof setTimeout> | undefined
    const clear = () => {
      clearTimeout(expiry)
      snapshots.current.clear()
      running.forEach((flight) => flight.restore())
      running.clear()
      setFlights([])
    }
    const capture = (event: Event) => {
      clear()
      if (reduced || !('showPopover' in HTMLElement.prototype)) return
      const target = event.target instanceof Element ? event.target : null
      const scope = target?.closest('dialog, .media-tile, section')
      const modal = document.querySelector('dialog[open]')
      expiry = setTimeout(() => pending.clear(), 1600)
      for (const entry of entries.current.values()) {
        if (scope?.matches('.media-tile') && !scope.contains(entry.element))
          continue
        const image = entry.element.querySelector('img')
        const bounds = frame(entry.element)
        if (
          !bounds ||
          !image?.complete ||
          !image.naturalWidth ||
          getComputedStyle(entry.element).visibility === 'hidden'
        )
          continue
        // Background catalogue duplicates must never steal the origin from a dialog.
        if (modal && !entry.element.closest('dialog[open]')) continue
        const score =
          (scope?.contains(entry.element) ? 100 : 0) +
          (entry.element.contains(target) ? 100 : 0)
        if ((snapshots.current.get(entry.key)?.score ?? -1) > score) continue
        const style = getComputedStyle(image)
        snapshots.current.set(entry.key, {
          entry: { ...entry },
          frame: bounds,
          src: image.currentSrc || image.src,
          fit: style.objectFit,
          position: style.objectPosition,
          at: performance.now(),
          score,
          player: Boolean(entry.element.closest('.player-artwork-hero')),
        })
      }
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') capture(event)
    }
    document.addEventListener('click', capture, true)
    document.addEventListener('keydown', keyboard, true)
    window.addEventListener('resize', clear)
    // Native dialog focus can scroll the page during the handoff. Only user
    // scrolling cancels it; otherwise fast playback loses its origin snapshot.
    window.addEventListener('wheel', clear, { passive: true, capture: true })
    window.addEventListener('touchmove', clear, {
      passive: true,
      capture: true,
    })
    document.addEventListener('visibilitychange', clear)
    return () => {
      document.removeEventListener('click', capture, true)
      document.removeEventListener('keydown', keyboard, true)
      window.removeEventListener('resize', clear)
      window.removeEventListener('wheel', clear, true)
      window.removeEventListener('touchmove', clear, true)
      document.removeEventListener('visibilitychange', clear)
      clearTimeout(expiry)
      requests.forEach(cancelAnimationFrame)
      requests.clear()
      pending.clear()
      running.forEach((flight) => flight.restore())
      running.clear()
    }
  }, [reduced])

  useLayoutEffect(() => {
    const element = popover.current
    if (reduced && flights.length) {
      flights.forEach((flight) => flight.restore())
      active.current.clear()
      // An OS preference change cancels the current external animation permanently.
      // oxlint-disable-next-line react/set-state-in-effect
      setFlights([])
    }
    if (flights.length && !reduced) element?.showPopover?.()
    else element?.hidePopover?.()
  }, [flights, reduced])

  return (
    <Context.Provider value={registry}>
      {children}
      {createPortal(
        <div
          ref={popover}
          popover="manual"
          className="artwork-hero-layer"
          aria-hidden="true"
        >
          {!reduced &&
            flights.map((flight) => (
              <ArtworkFlight
                key={flight.id}
                flight={flight}
                onComplete={() => {
                  flight.restore()
                  active.current.delete(flight.id)
                  setFlights((current) =>
                    current.filter((value) => value.id !== flight.id),
                  )
                }}
              />
            ))}
        </div>,
        document.body,
      )}
    </Context.Provider>
  )
}

function ArtworkFlight({
  flight,
  onComplete,
}: {
  flight: Flight
  onComplete: () => void
}) {
  const [src, setSrc] = useState(flight.snapshot.src)
  useEffect(() => {
    flight.hide()
    const reveal = setTimeout(flight.restore, 540)
    const url = flight.snapshot.entry.blob
      ? URL.createObjectURL(flight.snapshot.entry.blob)
      : undefined
    // The flight owns its URL, so unmounting the original image cannot revoke it.
    // oxlint-disable-next-line react/set-state-in-effect
    if (url) setSrc(url)
    return () => {
      clearTimeout(reveal)
      flight.restore()
      if (url) URL.revokeObjectURL(url)
    }
  }, [flight])
  return (
    <motion.div
      className="artwork-hero-flight"
      data-artwork-flight="true"
      data-artwork-destination={flight.frosted ? 'player' : 'artwork'}
      initial={{ ...flight.snapshot.frame, opacity: 1 }}
      animate={{ ...flight.frame, opacity: [1, 1, 0] }}
      transition={{
        duration: 0.72,
        ease: [0.22, 1, 0.36, 1],
        opacity: { duration: 0.72, times: [0, 0.78, 1] },
      }}
      onAnimationComplete={onComplete}
    >
      <img
        src={src}
        alt=""
        style={{
          objectFit: flight.snapshot.fit as 'cover' | 'contain',
          objectPosition: flight.snapshot.position,
        }}
      />
      {flight.frosted && (
        <motion.div
          className="artwork-hero-frost"
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(24px)' }}
          transition={{ duration: 0.65 }}
        />
      )}
    </motion.div>
  )
}
