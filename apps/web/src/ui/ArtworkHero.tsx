import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { readAppRoute } from '../app-route.ts'
import { deferHistoryRender } from '../use-app-route.ts'
import {
  ArtworkHeroContext,
  type DetailOrigin,
} from './artwork-hero-context.ts'
import { capturePlaySource } from './play-projection-source.ts'
import { morphDetailArtwork } from './morph-detail-artwork.ts'
import { returnArtworkCard } from './return-artwork-card.ts'
import { returnBannerArtwork } from './return-banner-artwork.ts'
import { createPlayProjection } from './play-projection.ts'
import './artwork-hero.css'

const endpoint = 'data-artwork-endpoint'
type DetailVisit = {
  mediaId: string | undefined
  origin: DetailOrigin | null
  catalogue: HTMLElement | null
  page: string | undefined
}
type ArtworkEntry = {
  document: string
  mediaId: string
  page: string
  trigger?: HistoryAnchor
  catalogue?: HistoryAnchor
}
type HistoryAnchor = { id: string; mediaId: string }

function catalogueRoute() {
  const url = new URL(location.href)
  if (
    !/^\/app(?:\/(favorites|movies|series|collections))?\/?$/.test(
      url.pathname,
    ) ||
    url.searchParams.has('play')
  )
    return null
  const { media } = readAppRoute(url.search, url.pathname)
  if (url.searchParams.has('media') && !media) return null
  url.searchParams.delete('media')
  return { page: url.pathname + url.search, media }
}

const documentId = crypto.getRandomValues(new Uint32Array(3)).join('-')

// History stores DOM IDs: virtualized cards can be collected, while surviving
// duplicates of the same title still return to the exact rail that was used.
function historyAnchor(control: HTMLElement | null) {
  const mediaId =
    control?.closest<HTMLElement>('[data-media-id]')?.dataset.mediaId
  if (!control || !mediaId) return undefined
  const node = control.closest<HTMLElement>('.artwork-card-frame') ?? control
  node.id ||= 'artwork-' + crypto.getRandomValues(new Uint32Array(3)).join('-')
  return { id: node.id, mediaId }
}

function resolveAnchor(anchor?: HistoryAnchor) {
  if (!anchor || typeof anchor.id !== 'string') return null
  const node = document.getElementById(anchor.id)
  const trigger = node?.matches('.artwork-card-frame')
    ? node.querySelector<HTMLElement>('.artwork-preview-trigger')
    : node?.matches('[data-artwork-open="details"]')
      ? node
      : null
  return trigger?.closest<HTMLElement>('[data-media-id]')?.dataset.mediaId ===
    anchor.mediaId
    ? trigger
    : null
}

function detailOrigin(control: HTMLElement) {
  const frame = control.closest<HTMLElement>('.artwork-card-frame')
  const trigger =
    frame?.querySelector<HTMLElement>('.artwork-preview-trigger') ?? control
  return { frame, trigger }
}

function rememberVisit(visit: DetailVisit) {
  const route = catalogueRoute()
  if (
    !route?.media ||
    route.media !== visit.mediaId ||
    visit.page !== route.page
  )
    return
  const entry: ArtworkEntry = {
    document: documentId,
    mediaId: route.media,
    page: route.page,
    trigger: historyAnchor(visit.origin?.trigger ?? null),
    catalogue: historyAnchor(visit.catalogue),
  }
  try {
    history.replaceState({ ...history.state, hollyfilmsArtwork: entry }, '')
  } catch {
    // The route has committed. History write limits must never block its render.
  }
}

function savedVisit(mediaId: string, page: string): DetailVisit | null {
  const entry: ArtworkEntry | undefined = history.state?.hollyfilmsArtwork
  if (
    entry?.document !== documentId ||
    entry.mediaId !== mediaId ||
    entry.page !== page
  )
    return null
  const trigger =
    entry.trigger?.mediaId === mediaId ? resolveAnchor(entry.trigger) : null
  return {
    mediaId,
    page,
    catalogue: resolveAnchor(entry.catalogue),
    origin: trigger ? detailOrigin(trigger) : null,
  }
}

function activeDialog() {
  return document.querySelector<HTMLDialogElement>(
    '.media-dialog[open]:not([inert])',
  )
}

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

function visibleDetailHeader(dialog: HTMLElement) {
  const art = dialog.querySelector<HTMLElement>('.media-detail-art')
  if (!visible(art)) return null
  const rect = art.getBoundingClientRect()
  const sheet = dialog.getBoundingClientRect()
  const top =
    dialog.querySelector('.detail-toolbar')?.getBoundingClientRect().bottom ??
    sheet.top
  return rect.top >= top - 1 && rect.bottom <= sheet.bottom + 1 ? art : null
}

function catalogueBackdrop(control: HTMLElement) {
  const hero = control.closest('.home-carousel, .library-movies-intro')
  return (
    hero?.querySelector<HTMLElement>(
      '.home-hero-media, .library-movie-scene',
    ) ?? null
  )
}

// Prefer the actual crop on screen, including a partly expanded hover. The
// player's neutral slit when no artwork is visible is specific to playback.
function visiblePicture(control: HTMLElement | null) {
  if (!control?.isConnected) return null
  const picture = capturePlaySource(control)
  return picture.canvas && picture.bounds.height > 8 ? picture : null
}

export function ArtworkHeroProvider({ children }: { children: ReactNode }) {
  const reduced = usePerformanceReducedMotion()
  const running = useRef<{ skip: () => void } | null>(null)
  const projection = useRef<ReturnType<typeof createPlayProjection> | null>(
    null,
  )
  const origins = useRef(
    new WeakMap<
      HTMLDialogElement,
      {
        catalogue: WeakRef<HTMLElement> | null
        page: string | undefined
      }
    >(),
  )
  const opening = useRef<DetailVisit | null>(null)

  const registry = useMemo(() => {
    function finishPrevious() {
      running.current?.skip()
    }

    function moveArtwork(
      destination: 'details' | 'catalogue',
      start: (finish: () => void) => (() => void) | undefined,
    ) {
      const root = document.documentElement
      const flight = { skip: finish }
      function finish() {
        if (running.current !== flight) return
        running.current = null
        delete root.dataset.artworkDestination
        delete root.dataset.artworkFlight
      }
      running.current = flight
      root.dataset.artworkFlight = 'true'
      root.dataset.artworkDestination = destination
      try {
        flight.skip = start(finish) ?? finish
      } finally {
        if (flight.skip === finish) finish()
      }
    }

    function recordDialog(visit: DetailVisit, dialog = activeDialog()) {
      if (!dialog || dialog.dataset.mediaId !== visit.mediaId) return null
      if (!origins.current.has(dialog))
        origins.current.set(dialog, {
          page: visit.page,
          catalogue: visit.catalogue && new WeakRef(visit.catalogue),
        })
      return dialog
    }

    function openDetails(
      visit: DetailVisit,
      source: HTMLElement | null,
      update: () => void,
      begin?: () => () => void,
    ) {
      const picture =
        !reduced && !document.hidden ? visiblePicture(source) : null
      finishPrevious()
      const publish = begin?.()
      if (begin) rememberVisit(visit)
      const render = () => {
        opening.current = visit
        try {
          flushSync(() => {
            update()
            publish?.()
          })
        } finally {
          opening.current = null
        }
        return recordDialog(visit)
      }
      if (!picture) {
        render()
        return
      }
      moveArtwork('details', (finish) => {
        const dialog = render()
        return dialog ? morphDetailArtwork(dialog, picture, finish) : undefined
      })
    }

    function navigate(
      control: HTMLElement,
      destination: 'details' | 'player',
      update: () => void,
      begin?: () => () => void,
    ) {
      if (destination === 'player') {
        try {
          const source =
            !reduced &&
            !document.hidden &&
            typeof control.animate === 'function' &&
            capturePlaySource(control)
          finishPrevious()
          if (source) {
            const root = document.documentElement
            const shot = createPlayProjection(
              source,
              () => {
                if (projection.current !== shot) return
                delete root.dataset.artworkFlight
                delete root.dataset.artworkDestination
              },
              () => {
                if (projection.current !== shot) return
                projection.current = null
                running.current = null
              },
            )
            projection.current = shot
            running.current = { skip: shot.finish }
            root.dataset.artworkDestination = 'player'
            root.dataset.artworkFlight = 'true'
          }
        } catch {
          // A source may disappear or lose its decoder during activation.
          // The visual handoff is optional; playback always commits below.
          finishPrevious()
        }
        try {
          const publish = begin?.()
          flushSync(() => {
            update()
            publish?.()
          })
        } finally {
          const shot = projection.current
          if (shot && !shot.mounted) shot.finish()
        }
        return
      }
      const parent = control.closest<HTMLDialogElement>('.media-dialog[open]')
      const origin = detailOrigin(control)
      const visit: DetailVisit = {
        mediaId:
          control.closest<HTMLElement>('[data-media-id]')?.dataset.mediaId,
        origin,
        catalogue: parent
          ? (origins.current.get(parent)?.catalogue?.deref() ?? null)
          : origin.trigger,
        page: catalogueRoute()?.page,
      }
      openDetails(visit, control, update, begin)
    }
    function returnToOrigin(dialog: HTMLDialogElement, update: () => void) {
      const origin = origins.current.get(dialog)?.catalogue?.deref()
      origins.current.delete(dialog)
      const moving = !reduced && !document.hidden && origin?.isConnected
      const frame = origin?.closest<HTMLElement>('.artwork-card-frame')
      const banner =
        moving && !frame && origin ? catalogueBackdrop(origin) : null
      const nativeHeader =
        banner &&
        typeof document.startViewTransition === 'function' &&
        !dialog.hasAttribute('data-detail-morph') &&
        visibleDetailHeader(dialog)
      const picture = moving && !nativeHeader ? visiblePicture(dialog) : null
      finishPrevious()
      if (frame && picture) {
        flushSync(update)
        moveArtwork('catalogue', (finish) =>
          returnArtworkCard(frame, picture, finish),
        )
        return
      }
      if (!nativeHeader || !visible(banner)) {
        flushSync(update)
        if (picture && visible(banner))
          moveArtwork('catalogue', (finish) =>
            returnBannerArtwork(banner, picture, finish),
          )
        return
      }
      // Only the visible header can travel back to a banner. The dialog shell
      // and the catalogue stay live outside the two clipped pictures.
      let committed = false
      const commit = () => {
        if (committed) return
        committed = true
        flushSync(update)
      }
      const root = document.documentElement
      const flight = { skip: commit }
      running.current = flight
      root.dataset.artworkFlight = 'true'
      root.dataset.artworkDestination = 'catalogue'
      nativeHeader.setAttribute(endpoint, 'source')
      const release = () => {
        if (running.current !== flight) return
        nativeHeader.removeAttribute(endpoint)
        banner.removeAttribute(endpoint)
        delete root.dataset.artworkFlight
        delete root.dataset.artworkDestination
        running.current = null
      }
      try {
        const transition = document.startViewTransition(() => {
          nativeHeader.removeAttribute(endpoint)
          commit()
          if (running.current === flight && visible(banner))
            banner.setAttribute(endpoint, 'target')
        })
        flight.skip = () => {
          transition.skipTransition()
          release()
          commit()
        }
        void transition.ready.catch(() => {})
        void transition.finished.then(release, release)
      } catch {
        release()
        commit()
      }
    }
    function detailOriginFor(mediaId: string) {
      if (opening.current?.mediaId === mediaId) return opening.current.origin
      const route = catalogueRoute()
      return route?.media === mediaId
        ? (savedVisit(mediaId, route.page)?.origin ?? null)
        : null
    }
    function onDialogOpening(event: ToggleEvent) {
      // A player return or slow history load can mount after a transition.
      if (
        event.newState !== 'open' ||
        !(event.target instanceof HTMLDialogElement) ||
        !event.target.matches('.media-dialog') ||
        opening.current
      )
        return
      const route = catalogueRoute()
      if (!route?.media || event.target.dataset.mediaId !== route.media) return
      const visit = savedVisit(route.media, route.page)
      if (visit) recordDialog(visit, event.target)
    }
    function restoreHistory(event: PopStateEvent) {
      const route = catalogueRoute()
      const dialog = activeDialog()
      if (!route || document.querySelector('.player-shell[open]')) return false
      if (!route.media) {
        if (!dialog || origins.current.get(dialog)?.page !== route.page)
          return false
        deferHistoryRender(event, (render) => returnToOrigin(dialog, render))
        return true
      }
      if (dialog?.dataset.mediaId === route.media) return false
      const visit = savedVisit(route.media, route.page)
      const previous = dialog && origins.current.get(dialog)
      if (previous && previous.page !== route.page) return false
      if (!visit?.origin && !(dialog && previous?.page === route.page))
        return false
      const catalogue = visit?.catalogue ?? previous?.catalogue?.deref() ?? null
      // On a nested return the recommendation that opened the current dialog
      // was unmounted. The outgoing dialog itself is its painted endpoint.
      const source = dialog ?? visit?.origin?.trigger
      deferHistoryRender(event, (render) =>
        openDetails(
          {
            mediaId: route.media,
            page: route.page,
            catalogue,
            origin:
              visit?.origin ??
              (catalogue && { frame: null, trigger: catalogue }),
          },
          source ?? null,
          render,
        ),
      )
      return true
    }
    return {
      attachPlayerProjection: (host: HTMLElement) =>
        projection.current?.mount(host),
      finishPlayerProjection: (presentFrame = false) => {
        if (presentFrame) projection.current?.revealFilm()
        else projection.current?.finish()
      },
      detailOriginFor,
      navigate,
      returnToOrigin,
      restoreHistory,
      onDialogOpening,
    }
  }, [reduced])

  useEffect(() => {
    const cancel = () => running.current?.skip()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Tab') cancel()
    }
    const back = (event: PopStateEvent) => {
      if (!registry.restoreHistory(event)) cancel()
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
    document.addEventListener('beforetoggle', registry.onDialogOpening, true)
    return () => {
      cancel()
      window.removeEventListener('popstate', back, true)
      window.removeEventListener('resize', cancel)
      window.removeEventListener('keydown', keyboard, true)
      window.removeEventListener('wheel', cancel, true)
      window.removeEventListener('touchmove', cancel, true)
      document.removeEventListener('visibilitychange', cancel)
      document.removeEventListener(
        'beforetoggle',
        registry.onDialogOpening,
        true,
      )
    }
  }, [registry])

  return (
    <ArtworkHeroContext.Provider value={registry}>
      {children}
    </ArtworkHeroContext.Provider>
  )
}
