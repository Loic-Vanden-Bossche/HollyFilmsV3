import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { chromium } from 'playwright'

// Exercise native ResizeObserver and resolution media queries on fixed-size cards.
const source = await readFile(
  new URL('../src/ui/artwork-resources.ts', import.meta.url),
  'utf8',
)
const moduleUrl =
  'data:text/javascript;base64,' +
  Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--window-size=800,600'],
})
try {
  const page = await browser.newPage({ viewport: null })
  const cdp = await page.context().newCDPSession(page)
  const { windowId } = await cdp.send('Browser.getWindowForTarget')
  await cdp.send('Emulation.addScreen', {
    left: 3000,
    top: 0,
    width: 2160,
    height: 1600,
    devicePixelRatio: 2,
    label: 'DPR 2',
  })
  const setDensity = async (deviceScaleFactor) => {
    // Moving the native window generates real media-query change events.
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: {
        left: deviceScaleFactor === 2 ? 3020 : 20,
        top: 20,
        width: 700,
        height: 520,
        windowState: 'normal',
      },
    })
    await page.waitForFunction(
      (density) => window.devicePixelRatio === density,
      deviceScaleFactor,
    )
  }
  await setDensity(1)
  await page.setContent(
    '<div id="cover" style="width:180px;height:60px"></div><div id="badge" style="width:40px;height:24px"></div>',
  )
  await page.evaluate(async (url) => {
    const { observeArtworkSize, subscribeArtworkDensity } = await import(url)
    const matchMedia = window.matchMedia.bind(window)
    window.densityChecks = { queries: 0, heroUpdates: 0, cover: [], badge: [] }
    window.matchMedia = (query) => {
      if (query.startsWith('(resolution:')) window.densityChecks.queries++
      return matchMedia(query)
    }
    const stops = ['cover', 'badge'].map((id) =>
      observeArtworkSize(document.getElementById(id), (pixels) =>
        window.densityChecks[id].push(pixels),
      ),
    )
    stops.push(
      subscribeArtworkDensity(() => window.densityChecks.heroUpdates++),
    )
    window.stopSizeObservers = () => stops.forEach((stop) => stop())
  }, moduleUrl)
  const read = () => page.evaluate(() => window.densityChecks)
  await page.waitForFunction(() => window.densityChecks.badge.length === 1)
  assert.deepEqual(await read(), {
    queries: 1,
    heroUpdates: 0,
    cover: [240],
    badge: [160],
  })
  await setDensity(2)
  await page.waitForFunction(() => window.densityChecks.cover.length === 2)
  assert.deepEqual(await read(), {
    queries: 2,
    heroUpdates: 1,
    cover: [240, 400],
    badge: [160],
  })
  assert.equal(
    await page.locator('#cover').evaluate((node) => node.clientWidth),
    180,
  )
  await setDensity(1)
  await page.waitForFunction(() => window.densityChecks.cover.length === 3)
  await page.evaluate(() => window.stopSizeObservers())
  await setDensity(2)
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  )
  assert.deepEqual(await read(), {
    queries: 3,
    heroUpdates: 2,
    cover: [240, 400, 240],
    badge: [160],
  })
  console.log(
    'Artwork switches resolution at constant CSS width and releases its shared DPR listener.',
  )
} finally {
  await browser.close()
}
