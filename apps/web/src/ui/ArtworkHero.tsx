import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { deferHistoryRender } from '../use-app-route.ts'
import { ArtworkHeroContext } from './artwork-hero-context.ts'
import './artwork-hero.css'

const endpoint = 'data-artwork-endpoint'
const videoReady =
  '.player-viewport:is([data-state="playing"],[data-has-frame="true"])'
type Destination = 'details' | 'player' | 'catalogue'
type Origin = { card: HTMLElement; detail: HTMLElement }

function visible(surface: HTMLElement | null): surface is HTMLElement {
  if (!surface?.isConnected || surface.closest('dialog:not([open])'))
    return false
  const r = surface.getBoundingClientRect()
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.right > 0 &&
    r.bottom > 0 &&
    r.left < window.innerWidth &&
    r.top < window.innerHeight
  )
}

function detailSurface(dialog: HTMLElement, poster: boolean) {
  const art = dialog.querySelector<HTMLElement>('.media-detail-art')
  const cover = dialog.querySelector<HTMLElement>('.media-detail-poster')
  const preferred = poster ? cover : art
  if (visible(preferred)) return preferred
  const alternate = poster ? art : cover
  return visible(alternate) ? alternate : null
}

function sourceSurface(control: HTMLElement) {
  const dialog = control.closest<HTMLDialogElement>('.media-dialog[open]')
  if (!dialog && !control.closest('.home-page')) return null
  // The settled popover paints its shadow outside the clipping surface. During
  // expansion the inner surface still carries the card's moving geometry.
  const panel = control.closest<HTMLElement>('.artwork-preview-panel')
  if (panel?.style.getPropertyValue('--preview-progress') === '1') return panel
  return (
    control.closest<HTMLElement>(
      '.artwork-preview-surface, .home-carousel, .library-movies-intro',
    ) ??
    (dialog && detailSurface(dialog, false))
  )
}

/** Cached artwork normally decodes in the next commit. Bound the time spent
 * waiting for an endpoint so cold images and lazy routes never gate navigation. */
function waitForPaintedSurface(
  find: () => HTMLElement | null,
  signal: AbortSignal,
) {
  const ready = () => {
    const surface = find()
    return visible(surface) &&
      surface.querySelector('.media-artwork[data-decoded]')
      ? surface
      : null
  }
  const painted = ready()
  if (painted || signal.aborted) return Promise.resolve(painted)
  return new Promise<HTMLElement | null>((resolve) => {
    const finish = (surface: HTMLElement | null) => {
      observer.disconnect()
      clearTimeout(timeout)
      signal.removeEventListener('abort', cancel)
      resolve(surface)
    }
    const cancel = () => finish(null)
    const observer = new MutationObserver(() => {
      const surface = ready()
      if (surface) finish(surface)
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-decoded', 'open'],
    })
    const timeout = setTimeout(() => {
      const surface = find()
      finish(visible(surface) ? surface : null)
    }, 180)
    signal.addEventListener('abort', cancel, { once: true })
  })
}

export function ArtworkHeroProvider({ children }: { children: ReactNode }) {
  const reduced = usePerformanceReducedMotion()
  const running = useRef<{ skip: () => void; commit: () => void } | null>(null)
  const origins = useRef(new WeakMap<HTMLDialogElement, Origin>())

  const registry = useMemo(() => {
    function transition(
      source: HTMLElement | null,
      destination: Destination,
      update: () => void,
      findTarget: () => HTMLElement | null,
      begin?: () => () => void,
    ) {
      // A new action may arrive before the browser has taken the first snapshot.
      // Finish its navigation before committing the newer one.
      const previous = running.current
      if (previous) {
        previous.skip()
        previous.commit()
      }
      const publish = begin?.()
      const render = () => {
        update()
        publish?.()
      }
      if (
        !document.startViewTransition ||
        reduced ||
        document.hidden ||
        !visible(source)
      ) {
        render()
        return
      }

      const root = document.documentElement
      const life = new AbortController()
      let target: HTMLElement | null = null
      let native: ViewTransition | undefined
      let committed = false
      const commit = () => {
        if (committed) return
        committed = true
        if (life.signal.aborted && running.current?.commit === commit)
          running.current = null
        flushSync(render)
      }
      const release = () => {
        if (life.signal.aborted) return
        life.abort()
        source.removeAttribute(endpoint)
        target?.removeAttribute(endpoint)
        delete root.dataset.artworkFlight
        delete root.dataset.artworkDestination
        if (committed && running.current?.commit === commit)
          running.current = null
      }
      const skip = () => {
        native?.skipTransition()
        release()
      }
      root.dataset.artworkFlight = 'true'
      root.dataset.artworkDestination = destination
      source.setAttribute(endpoint, 'source')
      running.current = { skip, commit }
      try {
        native = document.startViewTransition(async () => {
          if (!life.signal.aborted) source.removeAttribute(endpoint)
          commit()
          if (life.signal.aborted) return

          if (destination === 'player') {
            const onFirstFrame = () => {
              if (document.querySelector(videoReady)) skip()
            }
            const observer = new MutationObserver(onFirstFrame)
            observer.observe(document.body, {
              subtree: true,
              childList: true,
              attributes: true,
              attributeFilter: ['data-state', 'data-has-frame'],
            })
            life.signal.addEventListener('abort', () => observer.disconnect(), {
              once: true,
            })
            onFirstFrame()
          }
          const painted = await waitForPaintedSurface(findTarget, life.signal)
          if (life.signal.aborted) return
          if (!painted) {
            skip()
            return
          }
          target = painted
          target.setAttribute(
            endpoint,
            target.querySelector('.media-artwork[data-decoded]')
              ? 'painted'
              : 'loading',
          )
        })
        // A deliberate skip rejects ready, but the update still runs.
        void native.ready.catch(() => {})
        void native.finished.then(release, release)
      } catch {
        release()
        commit()
      }
    }
    function navigate(
      control: HTMLElement,
      destination: 'details' | 'player',
      update: () => void,
      begin?: () => () => void,
    ) {
      const source = sourceSurface(control)
      const card = source?.closest('.artwork-preview')
      const poster = Boolean(
        card &&
        card.getAttribute('data-wide') === 'false' &&
        card.getAttribute('data-active') !== 'true',
      )
      transition(
        source,
        destination,
        update,
        () => {
          if (destination === 'player')
            return document.querySelector<HTMLElement>('.player-viewport')
          const dialog = document.querySelector<HTMLDialogElement>(
            '.media-dialog[open]',
          )
          if (!dialog) return null
          const detail = detailSurface(dialog, poster)
          if (detail && source)
            origins.current.set(dialog, { card: source, detail })
          return detail
        },
        begin,
      )
    }
    function returnToOrigin(dialog: HTMLDialogElement, update: () => void) {
      const origin = origins.current.get(dialog)
      origins.current.delete(dialog)
      transition(
        origin?.detail ?? null,
        'catalogue',
        update,
        () => origin?.card ?? null,
      )
    }
    return { navigate, returnToOrigin }
  }, [reduced])

  useEffect(() => {
    const cancel = () => running.current?.skip()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Tab') cancel()
    }
    const back = (event: PopStateEvent) => {
      const route = new URLSearchParams(location.search)
      const dialog = document.querySelector<HTMLDialogElement>(
        '.media-dialog[open]',
      )
      if (
        dialog &&
        origins.current.has(dialog) &&
        !route.has('media') &&
        !route.has('play')
      )
        deferHistoryRender(event, (render) =>
          registry.returnToOrigin(dialog, render),
        )
      else cancel()
    }
    window.addEventListener('popstate', back, true)
    window.addEventListener('resize', cancel)
    window.addEventListener('keydown', keyboard, true)
    window.addEventListener('wheel', cancel, { passive: true, capture: true })
    window.addEventListener('touchmove', cancel, {
      passive: true,
      capture: true,
    })
    document.addEventListener('visibilitychange', cancel)
    return () => {
      cancel()
      window.removeEventListener('popstate', back, true)
      window.removeEventListener('resize', cancel)
      window.removeEventListener('keydown', keyboard, true)
      window.removeEventListener('wheel', cancel, true)
      window.removeEventListener('touchmove', cancel, true)
      document.removeEventListener('visibilitychange', cancel)
    }
  }, [registry])

  return (
    <ArtworkHeroContext.Provider value={registry}>
      {children}
    </ArtworkHeroContext.Provider>
  )
}
