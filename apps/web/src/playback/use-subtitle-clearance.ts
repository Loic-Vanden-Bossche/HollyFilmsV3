import { useLayoutEffect, type RefObject } from 'react'

/** Reserve the real control panel height, including wrapping and safe-area margins. */
export function useSubtitleClearance(
  stageRef: RefObject<HTMLElement | null>,
  controlsVisible: boolean,
) {
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observed = new Set<Element>()
    const measure = () => {
      const controls = stage.querySelector<HTMLElement>(
        '.player-controls-layer',
      )
      // Layout dimensions exclude Motion's entrance/exit transforms.
      const clearance =
        controlsVisible && controls ? controls.offsetHeight + 16 : 0
      const lift = Math.max(0, clearance - stage.clientHeight * 0.06)
      stage.style.setProperty('--subtitle-lift', `${lift}px`)
      for (const canvas of stage.querySelectorAll<HTMLCanvasElement>(
        '.player-subtitle-canvas',
      )) {
        // Fit the complete ASS/bitmap plane above the controls. Uniform scaling
        // preserves proportions and authored top captions instead of clipping them.
        const available = Math.max(
          0,
          stage.clientHeight - clearance - canvas.offsetTop,
        )
        const scale =
          clearance && canvas.offsetHeight
            ? Math.min(1, available / canvas.offsetHeight)
            : 1
        canvas.style.setProperty('--subtitle-plane-scale', String(scale))
      }
    }
    const resize = new ResizeObserver(measure)
    const refresh = () => {
      const targets = new Set<Element>([
        stage,
        ...stage.querySelectorAll(
          '.player-controls-layer, .player-subtitle-canvas',
        ),
      ])
      for (const element of observed) {
        if (!targets.has(element)) {
          resize.unobserve(element)
          observed.delete(element)
        }
      }
      for (const element of targets) {
        if (!observed.has(element)) {
          resize.observe(element)
          observed.add(element)
        }
      }
      measure()
    }
    // Renderers can attach asynchronously or replace their canvas on a track change.
    const mutations = new MutationObserver(refresh)
    mutations.observe(stage, { childList: true, subtree: true })
    refresh()
    return () => {
      resize.disconnect()
      mutations.disconnect()
    }
  }, [stageRef, controlsVisible])
}
