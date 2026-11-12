import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
const base = process.env.PERF_BASE_URL || 'http://127.0.0.1:6007'
const output =
  process.env.PERF_OUTPUT || '.playwright-mcp/performance-latest.json'
const rounds = Number(process.env.PERF_ROUNDS || 3)
const cpuThrottle = Number(process.env.PERF_CPU || 4)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const system = await browser.newBrowserCDPSession()
const gpu = await system.send('SystemInfo.getInfo')
const scenarios = [
  [
    'catalogue',
    'hollyfilms-accueil--performance-catalogue',
    '.home-grid .media-tile',
  ],
  ['landing', 'hollyfilms-vitrine--opening', '.showcase'],
  [
    'timeline',
    'ui-commandes-de-lecture--timeline-preview',
    'input[aria-label="Position de lecture"]',
  ],
]
const results = []
try {
  for (const [name, id, selector] of scenarios) {
    if (process.env.PERF_SCENARIO && process.env.PERF_SCENARIO !== name)
      continue
    for (let round = 0; round < rounds; round++) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(base + '/iframe.html?id=' + encodeURIComponent(id))
      await page.locator(selector).first().waitFor()
      await page.waitForTimeout(1600)
      await page.locator(selector).first().scrollIntoViewIfNeeded()
      await page.locator(selector).first().hover()
      await page.waitForTimeout(700)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle })
      await cdp.send('Performance.enable')
      const before = Object.fromEntries(
        (await cdp.send('Performance.getMetrics')).metrics.map((m) => [
          m.name,
          m.value,
        ]),
      )
      if (round === 0)
        await cdp.send('Tracing.start', {
          categories: 'devtools.timeline',
          transferMode: 'ReturnAsStream',
        })
      const frames = await page.evaluate(
        async ({ selector }) => {
          const target = document.querySelector(selector)
          const rect = target.getBoundingClientRect()
          const intervals = [],
            longTasks = []
          const observer = new PerformanceObserver((list) =>
            longTasks.push(...list.getEntries().map((e) => e.duration)),
          )
          observer.observe({ type: 'longtask' })
          let previous, start
          await new Promise((resolve) => {
            function frame(now) {
              start ??= now
              if (previous) intervals.push(now - previous)
              previous = now
              const phase = (now - start) / 1000
              target.dispatchEvent(
                new PointerEvent('pointermove', {
                  bubbles: true,
                  pointerType: 'mouse',
                  clientX:
                    rect.left + rect.width * (0.5 + 0.4 * Math.sin(phase * 4)),
                  clientY:
                    rect.top + rect.height * (0.5 + 0.35 * Math.cos(phase * 3)),
                }),
              )
              if (now - start < 4000) requestAnimationFrame(frame)
              else resolve()
            }
            requestAnimationFrame(frame)
          })
          observer.disconnect()
          intervals.sort((a, b) => a - b)
          return {
            frames: intervals.length,
            p50: intervals[Math.floor(intervals.length * 0.5)],
            p95: intervals[Math.floor(intervals.length * 0.95)],
            over33ms: intervals.filter((n) => n > 33.5).length,
            longTasks: longTasks.length,
            longTaskMs: longTasks.reduce((a, b) => a + b, 0),
          }
        },
        { selector },
      )
      const after = Object.fromEntries(
        (await cdp.send('Performance.getMetrics')).metrics.map((m) => [
          m.name,
          m.value,
        ]),
      )
      const metrics = Object.fromEntries(
        [
          'TaskDuration',
          'ScriptDuration',
          'LayoutDuration',
          'RecalcStyleDuration',
          'LayoutCount',
          'RecalcStyleCount',
        ].map((k) => [k, after[k] - before[k]]),
      )
      if (round === 0) {
        const done = new Promise((resolve) =>
          cdp.once('Tracing.tracingComplete', resolve),
        )
        await cdp.send('Tracing.end')
        const { stream } = await done
        let trace = ''
        while (true) {
          const chunk = await cdp.send('IO.read', { handle: stream })
          trace += chunk.data
          if (chunk.eof) break
        }
        await cdp.send('IO.close', { handle: stream })
        await fs.mkdir(path.dirname(output), { recursive: true })
        await fs.writeFile(
          output.replace(/\.json$/, '-' + name + '-trace.json'),
          trace,
        )
      }
      const result = { name, round, ...frames, ...metrics, errors }
      results.push(result)
      console.log(JSON.stringify(result))
      await page.close()
    }
  }
  await fs.writeFile(
    output,
    JSON.stringify(
      {
        base,
        cpuThrottle,
        viewport: '1440x900',
        chrome: browser.version(),
        gpu: gpu.gpu.devices,
        results,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
