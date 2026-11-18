import { useLayoutEffect, useRef } from 'react'
import { useIsPresent } from 'motion/react'
import { lockBodyScroll } from './body-scroll-lock.ts'

/** Release the native top layer and focus trap while the visual exit plays. */
export function useModalPresence(
  getFallback?: (opener: HTMLElement) => HTMLElement | null,
) {
  const dialog = useRef<HTMLDialogElement>(null)
  const surface = useRef<HTMLElement>(null)
  const present = useIsPresent()
  const opener = useRef(document.activeElement as HTMLElement | null)
  useLayoutEffect(() => {
    const element = dialog.current
    if (!present || !element) return
    const previous = opener.current
    const fallback = previous && getFallback?.(previous)
    const unlock = lockBodyScroll()
    element.showModal()
    if (
      surface.current &&
      previous?.isConnected &&
      previous !== document.body
    ) {
      const from = previous.getBoundingClientRect()
      const to = surface.current.getBoundingClientRect()
      const x = Math.min(to.width, Math.max(0, from.x + from.width / 2 - to.x))
      const y = Math.min(
        to.height,
        Math.max(0, from.y + from.height / 2 - to.y),
      )
      element.style.setProperty('--dialog-origin', `${x}px ${y}px`)
    }
    return () => {
      element.close()
      unlock()
      const target =
        previous?.isConnected && !previous.matches(':disabled')
          ? previous
          : fallback
      if (target?.isConnected && !target.closest('[inert]'))
        target.focus({ preventScroll: true })
    }
  }, [present, getFallback])
  return { dialog, surface, present }
}
