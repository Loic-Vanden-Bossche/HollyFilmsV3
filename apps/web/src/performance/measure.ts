import type { PerformanceController } from './profiles.ts'

/** One bounded sampler per app, with no React updates for individual frames. */
export function measurePerformance(controller: PerformanceController) {
  let raf = 0
  let previous = 0
  let start = performance.now()
  let warmupUntil = start + 4000
  let lastInput = -Infinity
  let interaction: number | null = null
  let inputStarted: number | undefined
  let frames: number[] = []
  let tasks: { start: number; end: number }[] = []
  let previousPlayback = false
  const observers: PerformanceObserver[] = []
  const observing = new Set<string>()
  const supported =
    typeof PerformanceObserver === 'undefined'
      ? []
      : (PerformanceObserver.supportedEntryTypes ?? [])
  function observe(
    type: string,
    callback: (entries: PerformanceEntry[]) => void,
  ) {
    if (!supported.includes(type)) return
    try {
      const observer = new PerformanceObserver((list) => {
        if (!document.hidden) callback(list.getEntries())
      })
      observer.observe({
        type,
        ...(type === 'event' ? { durationThreshold: 40 } : {}),
      })
      observers.push(observer)
      observing.add(type)
    } catch {
      /* Frame timing and input-to-frame latency remain available. */
    }
  }
  observe('longtask', (entries) => {
    tasks.push(
      ...entries.map((entry) => ({
        start: entry.startTime,
        end: entry.startTime + entry.duration,
      })),
    )
    tasks = tasks.slice(-100)
  })
  observe('event', (entries) => {
    for (const entry of entries)
      interaction = Math.max(interaction ?? 0, entry.duration)
  })
  const input = (event: Event) => {
    const now = performance.now()
    lastInput = now
    if (event.type === 'pointerdown' || event.type === 'keydown') {
      const time =
        event.timeStamp > 0 && event.timeStamp <= now ? event.timeStamp : now
      inputStarted = Math.min(inputStarted ?? time, time)
    }
  }
  const events = [
    'pointerdown',
    'pointermove',
    'keydown',
    'wheel',
    'touchmove',
    'scroll',
  ]
  events.forEach((event) =>
    window.addEventListener(event, input, { passive: true, capture: true }),
  )
  const tick = (now: number) => {
    if (inputStarted !== undefined) {
      interaction = Math.max(interaction ?? 0, now - inputStarted)
      inputStarted = undefined
    }
    if (previous) frames.push(now - previous)
    previous = now
    const duration = now - start
    if (duration >= 2000 && frames.length) {
      const sorted = [...frames].sort((a, b) => a - b)
      const profile = controller.getSettings().profile
      // A native modal player is the actual mounted playback surface, independent of its URL.
      const playing = Boolean(
        document.querySelector('dialog.player-shell[open]'),
      )
      const decorationsRunning = Boolean(
        document.querySelector(
          '.catalogue-backdrop[data-motion="running"], .catalogue-gallery[data-motion="running"], .rb-atmosphere[data-motion="running"]',
        ),
      )
      const state =
        playing || previousPlayback
          ? 'playback'
          : start < warmupUntil
            ? 'warmup'
            : now - lastInput < 5000 || decorationsRunning
              ? 'active'
              : 'idle'
      previousPlayback = playing
      const blocking = observing.has('longtask')
        ? Math.min(
            1,
            tasks.reduce(
              (total, task) =>
                total +
                Math.max(
                  0,
                  Math.min(now, task.end) - Math.max(start, task.start),
                ),
              0,
            ) / duration,
          )
        : null
      controller.ingest({
        time: now,
        fps: (frames.length * 1000) / duration,
        frameP95:
          sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
        slowFrames: frames.filter((frame) => frame > 25).length / frames.length,
        blocking,
        interaction,
        state,
        profile: profile.id,
      })
      start = now
      frames = []
      tasks = tasks.filter((task) => task.end > now)
      interaction = null
    }
    // Bounds remain fixed even on very high-refresh displays or delayed timers.
    if (frames.length > 1000) frames = frames.slice(-1000)
    raf = requestAnimationFrame(tick)
  }
  const visibility = () => {
    cancelAnimationFrame(raf)
    previous = 0
    frames = []
    tasks = []
    interaction = null
    inputStarted = undefined
    start = performance.now()
    warmupUntil = start + 2000
    if (!document.hidden) raf = requestAnimationFrame(tick)
  }
  document.addEventListener('visibilitychange', visibility)
  if (!document.hidden) raf = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(raf)
    observers.forEach((observer) => observer.disconnect())
    events.forEach((event) => window.removeEventListener(event, input, true))
    document.removeEventListener('visibilitychange', visibility)
  }
}
