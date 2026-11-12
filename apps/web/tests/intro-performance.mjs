import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const output =
  process.env.PERF_OUTPUT || '.playwright-mcp/intro-performance.json'
const base = process.env.PERF_BASE_URL || 'http://127.0.0.1:6007'
const rate = Number(process.env.PERF_CPU || 4)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
try {
  for (let round = 0; round < 3; round++) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    })
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate })
    await page.addInitScript(() => {
      const sample = (window.__introSample = {
        frames: [],
        tasks: [],
        start: 0,
        arrival: 0,
      })
      new PerformanceObserver((list) => {
        sample.tasks.push(
          ...list
            .getEntries()
            .map((e) => ({ start: e.startTime, duration: e.duration })),
        )
      }).observe({ type: 'longtask', buffered: true })
      let previous
      const frame = (now) => {
        if (!sample.start && document.querySelector('.home-page'))
          sample.start = now
        if (!sample.arrival && document.querySelector('.home-carousel'))
          sample.arrival = now
        if (sample.start && previous)
          sample.frames.push({ time: now, duration: now - previous })
        previous = now
        if (!sample.start || now - sample.start < 5000)
          requestAnimationFrame(frame)
        else sample.done = true
      }
      requestAnimationFrame(frame)
    })
    await page.goto(
      base + '/iframe.html?id=hollyfilms-accueil--delayed-hero&viewMode=story',
    )
    await page.waitForFunction(
      () => window.__introSample?.done,
      {},
      { timeout: 20000 },
    )
    const sample = await page.evaluate(() => window.__introSample)
    const summarize = (from, to) => {
      const frames = sample.frames
        .filter((f) => f.time >= from && f.time < to)
        .map((f) => f.duration)
        .sort((a, b) => a - b)
      const tasks = sample.tasks.filter((t) => t.start >= from && t.start < to)
      return {
        p95: frames[Math.floor(frames.length * 0.95)],
        max: Math.max(...frames),
        over33: frames.filter((n) => n > 33.5).length,
        tasks: tasks.length,
        longestTask: Math.max(0, ...tasks.map((t) => t.duration)),
      }
    }
    const result = {
      round,
      opening: summarize(sample.start, sample.start + 2000),
      settled: summarize(sample.start + 2000, sample.start + 5000),
      mountedCards: await page.locator('.media-tile').count(),
    }
    results.push(result)
    console.log(JSON.stringify(result))
    await page.close()
  }
  await fs.writeFile(
    output,
    JSON.stringify({ rate, chrome: browser.version(), results }, null, 2),
  )
} finally {
  await browser.close()
}
