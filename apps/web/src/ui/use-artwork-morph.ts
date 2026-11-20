import { useLayoutEffect, useRef, type RefObject } from 'react'
import { animate, useMotionValue } from 'motion/react'
import { duration, ease } from '../motion/tokens.ts'

type ElementRef = RefObject<HTMLElement | null>

export function useArtworkMorph({
  slot,
  panel,
  trigger,
  open,
  retracting,
  reduced,
  rankedHover,
  onRetracted,
}: {
  slot: ElementRef
  panel: ElementRef
  trigger: ElementRef
  open: boolean
  retracting: boolean
  reduced: boolean
  rankedHover: boolean
  onRetracted: () => void
}) {
  const progress = useMotionValue(0)
  const finish = useRef(onRetracted)
  useLayoutEffect(() => {
    finish.current = onRetracted
  }, [onRetracted])

  useLayoutEffect(() => {
    const origin = slot.current
    const shell = panel.current
    const button = trigger.current
    if (!open || !origin || !shell || !button) return
    const surface = shell.querySelector<HTMLElement>(
      '.artwork-preview-surface',
    )!
    const hero = shell.querySelector<HTMLElement>('.artwork-preview-hero')!
    const cover = hero.querySelector<HTMLElement>('.artwork-preview-cover')!
    const number = rankedHover
      ? origin.parentElement?.querySelector<HTMLElement>(
          ':scope > .home-rank-number',
        )
      : null
    number?.setAttribute('data-rank-hover', '')
    const document = shell.ownerDocument
    const fromRadius =
      parseFloat(
        getComputedStyle(origin).getPropertyValue('--preview-origin-radius'),
      ) ||
      parseFloat(getComputedStyle(button).borderTopLeftRadius) ||
      0
    const toRadius =
      parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 0

    const measure = () => {
      // The shell is the fixed destination and the slot never leaves the rail.
      // Surface/hero bounds share the same translation, so their difference
      // is the hero's local offset even midway through a reversal.
      const start = origin.getBoundingClientRect()
      const end = shell.getBoundingClientRect()
      const bounds = surface.getBoundingClientRect()
      const picture = hero.getBoundingClientRect()
      const pictureX = picture.left - bounds.left
      const pictureY = picture.top - bounds.top
      const fit = hero.dataset.contain === 'true' ? Math.min : Math.max
      const scale = fit(
        picture.width / start.width,
        picture.height / start.height,
      )
      return {
        start,
        end,
        picture,
        pictureX,
        pictureY,
        scale,
        toX: (picture.width - start.width * scale) / 2,
        toY: (picture.height - start.height * scale) / 2,
      }
    }
    let geometry: ReturnType<typeof measure>
    cover.style.transformOrigin = '0 0'
    const paint = (value: number) => {
      const { start, end, picture, pictureX, pictureY, scale, toX, toY } =
        geometry
      if (!start.width || !start.height || !end.width || !end.height) return
      const rest = 1 - value
      const x = (start.left - end.left) * rest
      const y = (start.top - end.top) * rest
      const radius = fromRadius * rest + toRadius * value
      const fraction = String(value)
      shell.style.setProperty('--preview-progress', fraction)
      number?.style.setProperty('--preview-progress', fraction)
      const scaleX = value + (start.width / end.width) * rest
      const scaleY = value + (start.height / end.height) * rest
      shell.style.setProperty(
        '--preview-shadow-transform',
        `translate3d(${x}px,${y}px,0) scale(${scaleX},${scaleY})`,
      )
      surface.style.transform = rest ? `translate3d(${x}px,${y}px,0)` : ''
      surface.style.clipPath = rest
        ? `inset(0 ${(end.width - start.width) * rest}px ${(end.height - start.height) * rest}px 0 round ${radius}px)`
        : ''
      // The animated outline owns all four corners until it rejoins the card.
      surface.style.borderRadius = rest ? '0' : ''
      const coverX = toX * value - pictureX * rest
      const coverY = toY * value - pictureY * rest
      cover.style.transform = `translate3d(${coverX}px,${coverY}px,0) scale(${rest + scale * value})`
      // A portrait can start taller than the final landscape picture. Permit
      // just that extra area while its lower edge folds into the hero.
      const overflowsHero =
        picture.height < start.height ||
        picture.width < start.width ||
        pictureX !== 0 ||
        pictureY !== 0
      if (overflowsHero && rest) {
        hero.style.overflow = 'visible'
        hero.style.clipPath = `inset(${-pictureY * rest}px ${(picture.width + pictureX - start.width) * rest}px ${(picture.height + pictureY - start.height) * rest}px ${-pictureX * rest}px)`
      } else {
        hero.style.overflow = ''
        hero.style.clipPath = ''
      }
    }
    function sync() {
      geometry = measure()
      // At the rail's right edge the preview grows to the left. Keep the
      // number next to that moving edge throughout the same morph.
      number?.style.setProperty(
        '--rank-travel',
        geometry.end.left - geometry.start.left + 'px',
      )
      paint(progress.get())
    }
    sync()
    const unsubscribe = progress.on('change', paint)
    const observer = new ResizeObserver(sync)
    for (const target of [origin, shell, hero]) observer.observe(target)
    const onScroll = (event: Event) => {
      if (
        event.target instanceof Node &&
        (event.target.contains(origin) || event.target === surface)
      )
        sync()
    }
    document.addEventListener('scroll', onScroll, true)
    return () => {
      unsubscribe()
      observer.disconnect()
      document.removeEventListener('scroll', onScroll, true)
      shell.style.removeProperty('--preview-progress')
      shell.style.removeProperty('--preview-shadow-transform')
      number?.removeAttribute('data-rank-hover')
      number?.style.removeProperty('--preview-progress')
      number?.style.removeProperty('--rank-travel')
      surface.style.transform = ''
      surface.style.clipPath = ''
      surface.style.borderRadius = ''
      cover.style.transform = ''
      cover.style.transformOrigin = ''
      hero.style.overflow = ''
      hero.style.clipPath = ''
      progress.jump(0)
    }
  }, [open, slot, panel, trigger, progress, rankedHover])

  useLayoutEffect(() => {
    if (!open) return
    const target = retracting ? 0 : 1
    const remaining = Math.abs(target - progress.get())
    if (reduced || !remaining) {
      progress.jump(target)
      if (retracting) finish.current()
      return
    }
    let active = true
    const animation = animate(progress, target, {
      duration: (retracting ? duration.panel : duration.scene) * remaining,
      ease: ease.out,
      onComplete: () => {
        if (active && retracting) finish.current()
      },
    })
    return () => {
      active = false
      animation.stop()
    }
  }, [open, retracting, reduced, progress])
}
