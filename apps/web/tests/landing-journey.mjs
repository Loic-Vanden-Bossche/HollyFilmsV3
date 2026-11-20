import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium } from 'playwright'

// Run from the repository root, passing a Vite production dist and an output JSON.
const [dist, output, comparisonDist] = process.argv.slice(2)
let activeDist = dist
const variants = comparisonDist
  ? [
      ['before', dist],
      ['after', comparisonDist],
    ]
  : [['current', dist]]
if (!dist || !output)
  throw new Error(
    'Expected: node landing-journey.mjs <dist> <output.json> [other-dist]',
  )
const rounds = Number(process.env.PERF_ROUNDS || 5)
const browser = await chromium.launch({ channel: 'chrome' })
const generation = await browser.newPage()
const encodedPosters = await generation.evaluate(() => {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 600
  const ctx = canvas.getContext('2d')
  const pixels = ctx.createImageData(400, 600)
  let seed = 161
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (1664525 * seed + 1013904223) >>> 0
    const tone = seed >>> 26
    pixels.data.set([tone + 90, tone + 60, tone + 75, 255], i)
  }
  ctx.putImageData(pixels, 0, 0)
  return Object.fromEntries(
    [160, 240, 320, 400].map((width) => {
      const small = document.createElement('canvas')
      small.width = width
      small.height = width * 1.5
      small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height)
      return [width, small.toDataURL('image/jpeg', 0.8).split(',')[1]]
    }),
  )
})
const posters = new Map(
  Object.entries(encodedPosters).map(([width, value]) => [
    width,
    Buffer.from(value, 'base64'),
  ]),
)
await generation.close()
const catalogue = Array.from({ length: 18 }, (_, i) => ({
  id: String(i + 1).padStart(32, '0'),
  kind: 'Film',
  title: i ? 'Film ' + i : 'Signal Test',
  year: 2026,
  poster: '/api/showcase/' + String(i + 1).padStart(32, '0') + '/poster',
}))
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}
const files = new Map()
const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost')
  const url = requestUrl.pathname
  const cache = (value) => res.setHeader('Cache-Control', value)
  const start = performance.now()
  try {
    if (url.startsWith('/api/')) {
      cache('no-store')
      if (url.endsWith('/poster')) {
        cache('public, max-age=300')
        res.setHeader('Content-Type', 'image/jpeg')
        res.setHeader(
          'Server-Timing',
          'app;dur=' + (performance.now() - start).toFixed(2),
        )
        res.end(posters.get(requestUrl.searchParams.get('width') || '400'))
      } else {
        res.setHeader('Content-Type', 'application/json')
        const data =
          url === '/api/showcase'
            ? { items: catalogue }
            : { googleStartUrl: '/api/auth/google/start' }
        res.setHeader(
          'Server-Timing',
          'app;dur=' + (performance.now() - start).toFixed(2),
        )
        res.end(JSON.stringify(data))
      }
      return
    }
    const file = path.resolve(
      activeDist,
      '.' + (url === '/' ? '/index.html' : url),
    )
    if (!file.startsWith(path.resolve(activeDist) + path.sep))
      throw new Error('Invalid path')
    if (!files.has(file)) {
      const identity = await readFile(file)
      const compressible =
        url.startsWith('/assets/') &&
        /\.(?:js|css|wasm|svg|ttf)$/.test(url) &&
        identity.length > 1024
      files.set(file, {
        identity,
        gzip: compressible ? gzipSync(identity) : null,
      })
    }
    const { identity, gzip } = files.get(file)
    // The release at 161bc4f served identity even when the browser accepted gzip.
    const encoded =
      gzip &&
      (!comparisonDist || activeDist === comparisonDist) &&
      /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')
    cache(
      url.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    )
    res.setHeader(
      'Content-Type',
      types[path.extname(file)] || 'application/octet-stream',
    )
    if (encoded) {
      res.setHeader('Content-Encoding', 'gzip')
      res.setHeader('Vary', 'Accept-Encoding')
    }
    res.end(encoded ? gzip : identity)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const url = 'http://127.0.0.1:' + server.address().port
const results = []
try {
  for (let round = 0; round < rounds; round++) {
    for (const [variant, directory] of round % 2
      ? [...variants].reverse()
      : variants) {
      activeDist = directory
      for (const device of ['desktop', 'mobile']) {
        const mobile = device === 'mobile'
        const context = await browser.newContext({
          viewport: mobile
            ? { width: 390, height: 844 }
            : { width: 1440, height: 900 },
          deviceScaleFactor: mobile ? 2 : 1,
          isMobile: mobile,
          hasTouch: mobile,
          locale: 'fr-FR',
          serviceWorkers: 'block',
          reducedMotion: 'no-preference',
        })
        try {
          const page = await context.newPage()
          const errors = []
          page.on('pageerror', (e) => errors.push(e.message))
          const cdp = await context.newCDPSession(page)
          await cdp.send('Network.enable')
          await cdp.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 80,
            downloadThroughput: 1500000,
            uploadThroughput: 750000,
          })
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 3 })
          await page.addInitScript(() => {
            const results = (window.landingMarks = { long: [] })
            new PerformanceObserver((list) => {
              for (const e of list.getEntries())
                results.long.push({ start: e.startTime, ms: e.duration })
            }).observe({ type: 'longtask', buffered: true })
            function sample() {
              const button = document.querySelector('.nav-signin')
              if (!results.button && button && !button.disabled) {
                const box = button.getBoundingClientRect()
                if (
                  box.width &&
                  button.contains(
                    document.elementFromPoint(
                      box.x + box.width / 2,
                      box.y + box.height / 2,
                    ),
                  )
                )
                  results.button = performance.now()
              }
              const lead = document.querySelector(
                '[data-position="lead"] img[data-ready]',
              )
              if (
                lead?.naturalWidth &&
                +getComputedStyle(lead).opacity >= 0.5 &&
                +getComputedStyle(lead.closest('.gallery-reveal')).opacity >=
                  0.5
              )
                results.visual ??= performance.now()
              if (!results.button || !results.visual)
                requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
          })
          for (const cache of ['cold', 'warm']) {
            await page.goto(url, { waitUntil: 'domcontentloaded' })
            await page.waitForFunction(
              () => window.landingMarks?.button && window.landingMarks?.visual,
            )
            const data = await page.evaluate(async () => {
              const m = window.landingMarks
              await Promise.all(
                Array.from(
                  document.querySelectorAll('.gallery-poster img'),
                  (image) => image.decode(),
                ),
              )
              const entries = performance.getEntriesByType('resource')
              const until = Math.max(m.visual, m.button)
              const bytes = entries
                .filter(
                  (e) =>
                    e.name.split('?')[0].endsWith('.js') &&
                    e.responseEnd <= until,
                )
                .reduce(
                  (a, e) => a + (e.transferSize ? e.encodedBodySize : 0),
                  0,
                )
              return {
                ...m,
                bytes,
                long: m.long.filter((t) => t.start < until),
                waterfall: entries.map((e) => ({
                  path: new URL(e.name).pathname + new URL(e.name).search,
                  start: e.startTime,
                  end: e.responseEnd,
                  encoded: e.encodedBodySize,
                  transfer: e.transferSize,
                  server: e.serverTiming.map((s) => s.duration),
                })),
              }
            })
            await page.locator('.nav-signin').click()
            await page.locator('dialog[open] input[type="password"]').waitFor()
            assert.deepEqual(errors, [])
            results.push({ variant, device, cache, round, ...data })
          }
        } finally {
          await context.close()
        }
      }
    }
  }
  // Outside the timed series, verify that the cinematic gallery can be paused
  // and that the primary poster and sign-in remain usable with reduced motion.
  activeDist = comparisonDist || dist
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ reducedMotion, locale: 'fr-FR' })
    await page.goto(url)
    await page.locator('[data-position="lead"] img[data-ready]').waitFor()
    const running = () =>
      Array.from(document.querySelectorAll('.gallery-drift'))
        .flatMap((el) => el.getAnimations())
        .some((animation) => animation.playState === 'running')
    if (reducedMotion === 'no-preference') {
      await page.waitForFunction(running)
      await page.locator('.animation-toggle').click()
      await page.waitForFunction(
        () =>
          document.querySelector('.catalogue-gallery')?.dataset.motion ===
          'paused',
      )
      assert.equal(await page.evaluate(running), false)
      await page.locator('.animation-toggle').click()
      await page.waitForFunction(running)
    } else assert.equal(await page.evaluate(running), false)
    await page.locator('.nav-signin').click()
    await page.locator('dialog[open] input[type="password"]').waitFor()
    await page.close()
  }
  await writeFile(
    output,
    JSON.stringify(
      {
        chrome: browser.version(),
        posterBytes: Object.fromEntries(
          [...posters].map(([width, blob]) => [width, blob.length]),
        ),
        results,
      },
      null,
      2,
    ),
  )
  for (const [variant] of variants)
    for (const device of ['desktop', 'mobile'])
      for (const cache of ['cold', 'warm']) {
        const runs = results.filter(
          (r) =>
            r.variant === variant && r.device === device && r.cache === cache,
        )
        const median = (fn) =>
          Math.round(
            runs.map(fn).sort((a, b) => a - b)[Math.floor(runs.length / 2)],
          )
        console.log({
          variant,
          device,
          cache,
          runs: runs.length,
          visual: median((r) => r.visual),
          button: median((r) => r.button),
          js: median((r) => r.bytes),
          longest: median((r) => Math.max(0, ...r.long.map((e) => e.ms))),
        })
      }
} finally {
  await browser.close()
  server.close()
}
