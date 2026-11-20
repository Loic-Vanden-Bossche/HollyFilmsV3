let pending: AbortController | undefined

/** Let a wheel or touch gesture take over even in browsers that finish a
 * smooth fragment scroll despite receiving new input. */
export function allowPageScrollInterruption() {
  pending?.abort()
  const controller = new AbortController()
  pending = controller
  const options = { signal: controller.signal, passive: true }
  const stop = () => controller.abort()
  const interrupt = () => {
    stop()
    window.scrollTo({ top: window.scrollY, behavior: 'instant' })
  }
  window.addEventListener('wheel', interrupt, options)
  window.addEventListener('touchstart', interrupt, options)
  document.addEventListener('scrollend', stop, options)
  // A destination already in view does not produce a scrollend event.
  const timeout = window.setTimeout(stop, 2000)
  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timeout)
      pending = undefined
    },
    { once: true },
  )
}

export function scrollPageTo(top: number) {
  allowPageScrollInterruption()
  window.scrollTo({ top })
}
