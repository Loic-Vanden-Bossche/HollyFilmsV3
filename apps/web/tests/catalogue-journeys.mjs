// node apps/web/tests/catalogue-journeys.mjs <production dist> <results.json> [rounds]
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const [dist, output, rounds = '3'] = process.argv.slice(2)
if (!dist || !output)
  throw Error('Supply production dist and results.json paths')
const comparison = process.env.CATALOGUE_COMPARE_DIST
let servedDist = dist
const browser = await chromium.launch({ channel: 'chrome' })
const landscapeWidths = [
  192, 240, 256, 320, 384, 400, 420, 480, 512, 600, 640, 720, 768, 800, 960,
  1024, 1280, 1600, 1920, 2560, 3200, 3840,
]
const seed = await browser.newPage()
const jpegs = await seed.evaluate((widths) => {
  const result = {}
  for (const width of widths) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = Math.round((width * 9) / 16)
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createLinearGradient(0, 0, width, canvas.height)
    gradient.addColorStop(0, '#164b68')
    gradient.addColorStop(1, '#d28f60')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, canvas.height)
    for (let i = 0; i < 9800; i++) {
      ctx.fillStyle = 'rgba(20,30,45,0.14)'
      ctx.fillRect(
        (i * 1237) % width,
        (i * 1147) % canvas.height,
        2 + (i % 19),
        1 + (i % 9),
      )
    }
    ctx.fillStyle = 'white'
    ctx.font = width / 10 + 'px serif'
    ctx.fillText('Signal', width / 16, canvas.height * 0.65)
    result[width] = canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
  }
  return result
}, landscapeWidths)
await seed.close()
const catalogue = Array.from({ length: 72 }, (_, i) => ({
  Id: 'film-' + i,
  Name: i === 5 ? 'Signal Test' : 'Projection ' + String(i).padStart(2, '0'),
  Type: 'Movie',
  ProductionYear: 2026,
  Genres: [['Aventure', 'Comédie', 'Drame', 'Fantastique'][i % 4]],
  CommunityRating: 7 + (i % 25) / 10,
  Overview: 'Un film du catalogue de mesure.',
  LocationType: 'Virtual',
  ImageTags: { Primary: 'p1', Thumb: 't1' },
  BackdropImageTags: ['b1'],
  RunTimeTicks: 5400e7,
  UserData: { PlaybackPositionTicks: 0, Played: false },
}))
const resume = catalogue
  .slice(0, 12)
  .map((item) => ({ ...item, UserData: { PlaybackPositionTicks: 1350e7 } }))
const assetCache = new Map()
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.html': 'text/html',
  '.webmanifest': 'application/manifest+json',
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const route = url.pathname
    if (route.startsWith('/api/') || route.startsWith('/jellyfin/')) {
      const start = performance.now()
      const jellyfin = route.startsWith('/jellyfin/')
      if (
        jellyfin &&
        !req.headers.authorization &&
        !req.headers['x-emby-authorization'] &&
        !url.searchParams.has('api_key')
      ) {
        res.writeHead(401)
        res.end()
        return
      }
      const term = url.searchParams.get('searchTerm') || ''
      const width = Number(url.searchParams.get('maxWidth')) || 640
      let data = {},
        type = 'application/json',
        ms = 8
      if (route.includes('/Images/')) {
        const candidate = landscapeWidths.find((w) => w >= width) || 3840
        data = Buffer.from(jpegs[candidate], 'base64')
        type = 'image/jpeg'
        ms = 16
      } else if (route.endsWith('/Users/Me'))
        data = {
          Id: 'fixture-user',
          Name: 'Profil de test',
          Policy: { IsAdministrator: false },
        }
      else if (route.endsWith('/Resume'))
        data = { Items: resume, TotalRecordCount: 12 }
      else if (route.endsWith('/Items')) {
        const filtered = catalogue.filter((item) =>
          item.Name.toLowerCase().includes(term.toLowerCase()),
        )
        data = {
          Items: filtered.slice(0, 36),
          TotalRecordCount: filtered.length,
        }
        ms = term === 'Projection' ? 330 : 22
      } else if (/\/Items\/film-\d+$/.test(route))
        data = catalogue.find((i) => route.endsWith('/' + i.Id))
      else if (route.endsWith('/LocalTrailers')) data = []
      else if (jellyfin) data = { Items: [], TotalRecordCount: 0 }
      else if (route.includes('notification')) data = { items: [], unread: 0 }
      else if (route.includes('profile')) data = { name: 'Profil de test' }
      else if (route.includes('discover')) data = { items: [], results: [] }
      else if (route.includes('provider'))
        data = { status: 'unconfigured', providers: [], regions: [] }
      else if (route.includes('reviews'))
        data = { items: [], total: 0, own: null, hasMore: false }
      await delay(ms)
      res.writeHead(200, {
        'content-type': type,
        'cache-control':
          type === 'image/jpeg' ? 'private, max-age=3600' : 'no-store',
        vary: 'Authorization, X-Emby-Authorization',
        'server-timing':
          'fixture;dur=' + (performance.now() - start).toFixed(1),
      })
      res.end(Buffer.isBuffer(data) ? data : JSON.stringify(data))
      return
    }
    const name = route.startsWith('/assets/')
      ? path.basename(route)
      : route.startsWith('/app')
        ? 'index.html'
        : path.basename(route)
    const file = path.join(
      servedDist,
      route.startsWith('/assets/') ? 'assets' : '',
      name,
    )
    if (!assetCache.has(file))
      assetCache.set(file, gzipSync(await readFile(file)))
    res.writeHead(200, {
      'content-type': mime[path.extname(file)] || 'application/octet-stream',
      'content-encoding': 'gzip',
      'cache-control': route.startsWith('/assets/')
        ? 'public,max-age=31536000,immutable'
        : 'no-store',
    })
    res.end(assetCache.get(file))
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const base = 'http://127.0.0.1:' + server.address().port
function transitionCosts(events) {
  const click = events.find((e) => e.name === 'card-click')
  const end = events.find((e) => e.name === 'usable-details')
  if (!click || !end) throw Error('Missing trace markers')
  const main = events.filter(
    (e) =>
      e.pid === click.pid &&
      e.tid === click.tid &&
      e.ph === 'X' &&
      e.ts < end.ts &&
      e.ts + e.dur > click.ts,
  )
  // Clip to the user-visible interval, taking the union of nested events.
  function elapsed(...names) {
    const slices = main
      .filter((e) => names.includes(e.name))
      .map((e) => [Math.max(e.ts, click.ts), Math.min(e.ts + e.dur, end.ts)])
      .sort((a, b) => a[0] - b[0])
    let total = 0,
      last = click.ts
    for (const [start, stop] of slices) {
      total += Math.max(0, stop - Math.max(last, start))
      last = Math.max(last, stop)
    }
    return +(total / 1000).toFixed(1)
  }
  return {
    script: elapsed('FunctionCall', 'EvaluateScript', 'RunMicrotasks'),
    layout: elapsed('Layout'),
    style: elapsed('UpdateLayoutTree'),
    paint: elapsed('Paint'),
  }
}
const rows = []
try {
  for (let run = 0; run < Number(rounds); run++)
    for (const mobile of [false, true]) {
      const builds = comparison ? [dist, comparison] : [dist]
      // Alternate build order on each pair to spread host temperature and load.
      if ((run + Number(mobile)) % 2) builds.reverse()
      for (const build of builds) {
        servedDist = build
        const context = await browser.newContext({
          reducedMotion: process.env.CATALOGUE_REDUCED
            ? 'reduce'
            : 'no-preference',
          locale: 'fr-FR',
          serviceWorkers: 'block',
          hasTouch: mobile,
          isMobile: mobile,
          deviceScaleFactor: mobile ? 2 : 1,
          viewport: mobile
            ? { width: 390, height: 844 }
            : { width: 1440, height: 900 },
        })
        try {
          const page = await context.newPage()
          if (process.env.CATALOGUE_DEBUG) {
            page.on('pageerror', (e) => console.error(e))
            page.on('response', (r) => {
              if (r.url().includes('/jellyfin/') || r.status() >= 400)
                console.error(r.status(), new URL(r.url()).pathname)
            })
          }
          page.setDefaultTimeout(18000)
          await page.addInitScript(() => {
            localStorage.setItem(
              'hollyfilms.jellyfin.session',
              JSON.stringify({
                deviceId: 'fixture-device',
                accessToken: 'fixture-only',
              }),
            )
            window.longTasks = []
            const push = history.pushState.bind(history)
            history.pushState = (...args) => {
              push(...args)
              if (new URL(location).searchParams.get('media') === 'film-5')
                performance.mark('details-url')
            }
            new PerformanceObserver((list) =>
              list
                .getEntries()
                .forEach((e) =>
                  window.longTasks.push([
                    Math.round(e.startTime),
                    Math.round(e.duration),
                  ]),
                ),
            ).observe({ type: 'longtask', buffered: true })
            addEventListener(
              'input',
              (e) => {
                if (e.target.value === 'Signal Test')
                  performance.mark('last-input')
              },
              true,
            )
            addEventListener(
              'click',
              (e) => {
                if (
                  e.target.closest(
                    '[data-media-id="film-5"] :is(.media-tile-select,.artwork-preview-open)',
                  )
                )
                  performance.mark('card-click')
              },
              true,
            )
          })
          const cdp = await context.newCDPSession(page)
          await cdp.send('Network.enable')
          await cdp.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 80,
            downloadThroughput: 1500000,
            uploadThroughput: 750000,
          })
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 3 })
          for (const cache of ['cold', 'warm']) {
            const trace =
              process.env.CATALOGUE_TRACE && run === 0 && cache === 'cold'
            if (trace)
              await context.tracing.start({
                screenshots: true,
                snapshots: true,
              })
            await page.goto(base + '/app', { waitUntil: 'domcontentloaded' })
            const rail = page.locator(
              '[data-home-shelf="resume"] .horizontal-rail-track',
            )
            await rail.waitFor()
            await rail.evaluate((el) =>
              el.scrollIntoView({ block: 'center', behavior: 'instant' }),
            )
            const home = await page
              .waitForFunction(() => {
                const track = document.querySelector('.home-resume-rail')
                const cards = [...track.querySelectorAll('article')].filter(
                  (c) => {
                    const r = c.getBoundingClientRect()
                    return r.left >= 0 && r.right <= innerWidth
                  },
                )
                if (
                  !cards.length ||
                  !cards.every(
                    (c) =>
                      c.querySelector('[data-decoded] img')?.complete &&
                      c.querySelector('.media-tile-select:enabled'),
                  )
                )
                  return false
                const r = cards[0].getBoundingClientRect()
                const target = document.elementFromPoint(
                  r.left + r.width / 2,
                  r.top + r.height / 2,
                )
                return (
                  cards[0].contains(target) && {
                    ready: Math.round(performance.now()),
                    art: Math.round(r.width),
                    cards: cards.length,
                  }
                )
              })
              .then((h) => h.jsonValue())
            const poster = page.locator(
              '[data-home-shelf="recent"] [data-media-id="film-5"] .media-tile-select',
            )
            await poster.scrollIntoViewIfNeeded()
            await poster.evaluate((el) => {
              el.scrollIntoView({
                block: 'center',
                inline: 'center',
                behavior: 'instant',
              })
            })
            await page.waitForTimeout(180)
            const position = () =>
              poster.evaluate((el) => ({
                y: Math.round(scrollY),
                x: Math.round(el.closest('.horizontal-rail-track').scrollLeft),
                focused: document.activeElement === el,
              }))
            if (mobile) await poster.tap()
            else if (process.env.CATALOGUE_KEYBOARD) await poster.focus()
            const saved = await position()
            const events = []
            const collect = ({ value }) => events.push(...value)
            cdp.on('Tracing.dataCollected', collect)
            await cdp.send('Tracing.start', {
              categories: 'devtools.timeline,blink.user_timing',
              transferMode: 'ReportEvents',
            })
            if (mobile)
              await page
                .locator(
                  '[data-media-id="film-5"][data-active="true"] .artwork-preview-open',
                )
                .tap({ position: { x: 14, y: 14 } })
            else if (process.env.CATALOGUE_KEYBOARD) await poster.press('Enter')
            else await poster.click()
            const details = await page
              .waitForFunction(() => {
                const play = document.querySelector(
                  'dialog[open] .media-play-actions [data-artwork-open="player"]',
                )
                if (
                  !play ||
                  document.querySelector('#media-detail-title')?.textContent !==
                    'Signal Test'
                )
                  return false
                play.scrollIntoView({ block: 'nearest', behavior: 'instant' })
                const b = play.getBoundingClientRect(),
                  hit = document.elementFromPoint(
                    b.x + b.width / 2,
                    b.y + b.height / 2,
                  )
                if (
                  !play.contains(hit) ||
                  play.disabled ||
                  !play.checkVisibility({ opacityProperty: true })
                )
                  return false
                performance.mark('usable-details')
                return Math.round(
                  performance.now() -
                    performance.getEntriesByName('card-click').at(-1).startTime,
                )
              })
              .then((h) => h.jsonValue())
            const finished = new Promise((resolve) =>
              cdp.once('Tracing.tracingComplete', resolve),
            )
            await cdp.send('Tracing.end')
            await finished
            cdp.off('Tracing.dataCollected', collect)
            const cpu = transitionCosts(events)
            const nav = await page.evaluate(() => {
              const click = performance
                .getEntriesByName('card-click')
                .at(-1).startTime
              return {
                url: Math.round(
                  performance.getEntriesByName('details-url').at(-1).startTime -
                    click,
                ),
                request: Math.round(
                  performance
                    .getEntriesByType('resource')
                    .find((e) =>
                      new URL(e.name).pathname.endsWith('/Items/film-5'),
                    )?.startTime - click,
                ),
              }
            })
            if (process.env.CATALOGUE_BACK) await page.goBack()
            else
              await page
                .getByRole('button', { name: 'Fermer la fiche' })
                .click()
            await page.locator('dialog[open]').waitFor({ state: 'hidden' })
            await page.waitForTimeout(650)
            const returned = await position()
            assert.deepEqual(returned, { ...saved, focused: true })
            const input = page.locator('.cinema-search input')
            await input.focus()
            await input.fill('Projection')
            await page.waitForTimeout(270)
            await input.fill('Signal Test')
            const search = await page
              .waitForFunction(() => {
                const results = document.querySelector(
                  '#home-search-results[aria-busy="false"]',
                )
                if (
                  !results ||
                  !results.querySelector(
                    '[data-media-id="film-5"] :is(.media-tile-select,.artwork-preview-open)',
                  ) ||
                  results.querySelectorAll('article').length !== 1
                )
                  return false
                return Math.round(
                  performance.now() -
                    performance.getEntriesByName('last-input').at(-1).startTime,
                )
              })
              .then((h) => h.jsonValue())
            await page.waitForTimeout(350)
            assert.equal(
              await page.locator('#home-search-results article').count(),
              1,
            )
            const timing = await page.evaluate(() => {
              const resources = performance
                .getEntriesByType('resource')
                .filter((e) => e.name.startsWith(location.origin))
              return {
                longTasks: window.longTasks,
                resources: resources.map((e) => {
                  const u = new URL(e.name)
                  return {
                    path: u.pathname,
                    term: u.searchParams.get('searchTerm') ?? undefined,
                    width: Number(u.searchParams.get('maxWidth')) || undefined,
                    start: Math.round(e.startTime),
                    end: Math.round(e.responseEnd),
                    transfer: e.transferSize,
                    body: e.encodedBodySize,
                    fixtureMs: e.serverTiming[0]?.duration,
                  }
                }),
              }
            })
            const result = {
              build: comparison
                ? build === dist
                  ? 'before'
                  : 'after'
                : undefined,
              run,
              profile: mobile ? 'mobile' : 'desktop',
              cache,
              home,
              details,
              search,
              cpu,
              nav,
              saved,
              returned,
              ...timing,
            }
            rows.push(result)
            console.log(
              JSON.stringify({
                run,
                profile: result.profile,
                cache,
                home,
                details,
                search,
                cpu,
                nav,
                saved,
                returned,
              }),
            )
            if (trace)
              await context.tracing.stop({
                path:
                  output +
                  '.' +
                  (result.build ?? 'single') +
                  '.' +
                  result.profile +
                  '.zip',
              })
            await writeFile(output, JSON.stringify(rows, null, 2))
          }
        } finally {
          await context.close()
        }
      }
    }
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
