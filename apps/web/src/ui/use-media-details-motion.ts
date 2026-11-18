import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useLayoutEffect, useRef } from 'react'
import { useAnimate } from 'motion/react'
import { cinemaMotion } from '../components/reactbits/policy.ts'
import { lockBodyScroll } from './body-scroll-lock.ts'

const revealSelector = [
  '.media-detail-body > :not([role])',
  '.detail-provider-panel > *',
  '.detail-reviews > .detail-section-heading',
  '.detail-credits > *',
  '.detail-browser > .detail-section-heading',
  '.detail-attribution',
].join(', ')

/** One observer per open dialog, including metadata arriving after its opening. */
export function useMediaDetailsMotion() {
  const [scope, animate] = useAnimate<HTMLDialogElement>()
  const reduced = useReducedMotion()
  const closing = useRef(false)
  const stopEntrance = useRef(() => {})

  useLayoutEffect(() => {
    const dialog = scope.current
    const trigger = document.activeElement as HTMLElement | null
    const unlockScroll = lockBodyScroll()
    closing.current = false
    dialog.showModal()
    return () => {
      dialog.close()
      unlockScroll()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [scope])

  useLayoutEffect(() => {
    const dialog = scope.current
    const subtle = reduced || document.hidden
    const started = performance.now()
    let disposed = false
    const controls = new Set<ReturnType<typeof animate>>()
    const seen = new Set<HTMLElement>()
    const pending = new Set<HTMLElement>()
    const play = (
      node: HTMLElement,
      from: string,
      delay = 0,
      duration = 0.46,
    ) => {
      const control = animate(
        node,
        { opacity: [0, 1], translate: [from, '0px 0px'] },
        {
          duration: subtle ? 0 : duration,
          delay: subtle ? 0 : delay,
          ease: cinemaMotion.ease,
        },
      )
      controls.add(control)
      void control.then(() => controls.delete(control))
    }
    dialog.setAttribute('data-phase', 'opening')
    const entrance = animate(
      dialog,
      {
        opacity: [0, 1],
        transform: subtle
          ? ['none', 'none']
          : ['translateY(28px) scale(0.965)', 'translateY(0px) scale(1)'],
      },
      { duration: subtle ? 0 : 0.48, ease: cinemaMotion.ease },
    )
    controls.add(entrance)
    void entrance.then(() => {
      controls.delete(entrance)
      if (!disposed && !closing.current)
        dialog.setAttribute('data-phase', 'open')
    })
    const artwork = dialog.querySelector<HTMLElement>('.detail-art-reveal')!
    const art = animate(
      artwork,
      {
        opacity: [0, 1],
        transform: subtle ? ['none', 'none'] : ['scale(1.055)', 'scale(1)'],
      },
      { duration: subtle ? 0 : 0.82, ease: cinemaMotion.ease },
    )
    controls.add(art)
    void art.then(() => controls.delete(art))

    const reveal = (node: HTMLElement, index = 0, immediate = false) => {
      if (!pending.delete(node)) return
      observer.unobserve(node)
      node.dataset.detailReveal = 'visible'
      const openingDelay = Math.max(
        0,
        0.14 - (performance.now() - started) / 1000,
      )
      if (immediate || document.hidden) {
        node.style.opacity = '1'
        node.style.translate = 'none'
      } else {
        play(
          node,
          node.classList.contains('media-detail-poster')
            ? '0px 26px'
            : '0px 16px',
          openingDelay + Math.min(index, 5) * 0.055,
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
      disposed = true
      stopEntrance.current()
      dialog.removeEventListener('focusin', focus)
      for (const node of seen) {
        node.style.removeProperty('opacity')
        node.style.removeProperty('translate')
        delete node.dataset.detailReveal
      }
    }
  }, [scope, animate, reduced])

  async function dismiss(onClose: () => void) {
    if (closing.current) return
    closing.current = true
    stopEntrance.current()
    const dialog = scope.current
    dialog.setAttribute('data-phase', 'closing')
    await animate(
      dialog,
      {
        opacity: 0,
        transform: reduced ? 'none' : 'translateY(18px) scale(0.98)',
      },
      { duration: reduced ? 0 : 0.24, ease: [0.4, 0, 1, 1] },
    )
    dialog.close()
    onClose()
  }
  return { scope, reduced, dismiss }
}
