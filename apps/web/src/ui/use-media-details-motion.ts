import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useContext, useLayoutEffect, useRef, useState } from 'react'
import { useAnimate, useIsPresent } from 'motion/react'
import { cinemaMotion } from '../components/reactbits/policy.ts'
import {
  ArtworkHeroContext,
  restoringArtworkFocus,
} from './artwork-hero-context.ts'
import { duration, distance, staggerDelay } from '../motion/tokens.ts'
import { lockBodyScroll } from './body-scroll-lock.ts'

const revealSelector = [
  '.media-detail-body > :not([role], .media-detail-poster)',
  '.detail-provider-panel > *',
  '.detail-reviews > .detail-section-heading',
  '.detail-credits > *',
  '.detail-attribution',
].join(', ')

/** One observer per open dialog, including metadata arriving after its opening. */
export function useMediaDetailsMotion(mediaId: string) {
  const [scope, animate] = useAnimate<HTMLDialogElement>()
  const reduced = useReducedMotion()
  const artworkHero = useContext(ArtworkHeroContext)
  const [origin] = useState(() => artworkHero?.detailOriginFor(mediaId) ?? null)
  const cardFrame = origin?.frame ?? null
  const [sharedEntrance] = useState(
    () => document.documentElement.dataset.artworkDestination === 'details',
  )
  const present = useIsPresent()
  const releaseLayer = useRef(() => {})
  const closing = useRef(false)
  const stopEntrance = useRef(() => {})

  useLayoutEffect(() => {
    if (!present) return
    const dialog = scope.current
    const slot = cardFrame?.parentElement
    const trigger =
      cardFrame?.querySelector<HTMLElement>('.artwork-preview-trigger') ??
      origin?.trigger ??
      (document.activeElement as HTMLElement | null)
    const unlockScroll = lockBodyScroll()
    closing.current = false
    if (cardFrame && slot) {
      slot.setAttribute('data-card-away', '')
      dialog.append(cardFrame)
    }
    dialog.showModal()
    // History traversal can clear the browser's own dialog autofocus after
    // popstate returns. Repair only that lost focus, before the next paint.
    const initialFocus = dialog.ownerDocument.activeElement
    const focusFrame = requestAnimationFrame(() => {
      if (
        dialog.open &&
        document.activeElement === document.body &&
        initialFocus instanceof HTMLElement &&
        dialog.contains(initialFocus)
      )
        initialFocus.focus({ preventScroll: true })
    })
    let released = false
    const release = () => {
      if (released) return
      released = true
      cancelAnimationFrame(focusFrame)
      // close() itself may focus the card before our explicit focus restore.
      if (trigger) restoringArtworkFocus.add(trigger)
      try {
        if (cardFrame && slot) {
          slot.append(cardFrame)
          slot.removeAttribute('data-card-away')
        }
        dialog.close()
        unlockScroll()
        if (trigger?.isConnected && !trigger.closest('[inert]'))
          trigger.focus({ preventScroll: true })
      } finally {
        if (trigger) restoringArtworkFocus.delete(trigger)
      }
    }
    releaseLayer.current = release
    return release
  }, [scope, present, cardFrame, origin])

  useLayoutEffect(() => {
    if (!present) return
    const dialog = scope.current
    const subtle = reduced || document.hidden
    const started = performance.now()
    const controls = new Set<ReturnType<typeof animate>>()
    const seen = new Set<HTMLElement>()
    const pending = new Set<HTMLElement>()
    const play = (
      node: HTMLElement,
      from: string,
      delay = 0,
      seconds = duration.scene,
    ) => {
      const control = animate(
        node,
        { opacity: [0, 1], translate: [from, '0px 0px'] },
        {
          duration: subtle ? 0 : seconds,
          delay: subtle ? 0 : delay,
          ease: cinemaMotion.ease,
        },
      )
      controls.add(control)
      void control.then(() => controls.delete(control))
    }
    if (!sharedEntrance) {
      const artwork = dialog.querySelector<HTMLElement>('.detail-art-reveal')!
      const art = animate(
        artwork,
        { opacity: [0, 1] },
        { duration: subtle ? 0 : duration.scene, ease: cinemaMotion.ease },
      )
      controls.add(art)
      void art.then(() => controls.delete(art))
    }

    const reveal = (node: HTMLElement, index = 0, immediate = false) => {
      if (!pending.delete(node)) return
      observer.unobserve(node)
      node.dataset.detailReveal = 'visible'
      const openingDelay = Math.max(
        0,
        0.04 - (performance.now() - started) / 1000,
      )
      if (immediate || document.hidden) {
        node.style.opacity = '1'
        node.style.translate = 'none'
      } else {
        play(
          node,
          '0px ' + distance.panel + 'px',
          openingDelay + staggerDelay(index),
        )
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (closing.current) return
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry, index) => reveal(entry.target as HTMLElement, index))
      },
      { root: dialog, threshold: 0.01 },
    )
    const register = (node: HTMLElement) => {
      if (seen.has(node) || closing.current) return
      seen.add(node)
      if (subtle) return
      pending.add(node)
      node.dataset.detailReveal = 'pending'
      node.style.opacity = '0'
      node.style.translate = '0px 16px'
      observer.observe(node)
    }
    dialog.querySelectorAll<HTMLElement>(revealSelector).forEach(register)
    const mutations = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue
          if (node.matches(revealSelector)) register(node)
          node.querySelectorAll<HTMLElement>(revealSelector).forEach(register)
        }
    })
    if (!subtle) mutations.observe(dialog, { childList: true, subtree: true })
    // Tabbing into unrevealed content must never leave an invisible focused control.
    const focus = (event: FocusEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-detail-reveal="pending"]',
      )
      if (target) reveal(target, 0, true)
    }
    dialog.addEventListener('focusin', focus)
    stopEntrance.current = () => {
      observer.disconnect()
      mutations.disconnect()
      controls.forEach((control) => control.stop())
      controls.clear()
    }
    return () => {
      stopEntrance.current()
      dialog.removeEventListener('focusin', focus)
      for (const node of seen) {
        node.style.removeProperty('opacity')
        node.style.removeProperty('translate')
        delete node.dataset.detailReveal
      }
    }
  }, [scope, animate, reduced, present, sharedEntrance])

  function dismiss(onClose: () => void) {
    if (closing.current) return
    closing.current = true
    const dialog = scope.current
    const close = () => {
      stopEntrance.current()
      dialog.setAttribute('data-phase', 'closing')
      releaseLayer.current()
      onClose()
    }
    if (artworkHero) artworkHero.returnToOrigin(dialog, close)
    else close()
  }
  return { scope, reduced, present, dismiss, sharedEntrance, cardFrame }
}
