import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { preview } from 'vite'

// Exercise actual storage events, React Query and the compiled routes. The
// loopback fixture deliberately reuses both deviceId and image keys between users.
const web = fileURLToPath(new URL('../', import.meta.url))
const sharedDevice = 'shared-fixture-device'
const storageKey = 'hollyfilms.jellyfin.session'
const accounts = {
  alpha: { id: '1'.repeat(32), title: 'Premier catalogue privé' },
  beta: { id: '2'.repeat(32), title: 'Deuxième catalogue privé' },
}
const calls = []
const oldImage = Promise.withResolvers()
const newIdentity = Promise.withResolvers()
const server = await preview({
  configFile: false,
  root: web,
  build: { outDir: resolve(web, process.argv[2] || 'dist') },
  preview: { host: '127.0.0.1', port: 0 },
  plugins: [
    {
      name: 'session-isolation-fixtures',
      configurePreviewServer(app) {
        app.middlewares.use(async (request, response, next) => {
          const { pathname } = new URL(request.url, 'http://localhost')
          if (!/^\/(?:jellyfin|api)\//.test(pathname)) return next()
          const headers = Object.values(request.headers).join(' ')
          const token = /opaque-(alpha|beta|denied)/.exec(headers)?.[1]
          const viewer = accounts[token]
          calls.push({ token, pathname })
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('Content-Type', 'application/json')
          if (
            (pathname.startsWith('/jellyfin/') ||
              pathname === '/api/profile') &&
            !viewer
          ) {
            response.writeHead(401).end()
            return
          }
          let body = {}
          if (pathname.endsWith('/Users/Me')) {
            if (token === 'beta') await newIdentity.promise
            body = {
              Id: viewer.id,
              Name: token,
              Policy: { IsAdministrator: false },
            }
          } else if (pathname.endsWith('/Items')) {
            body = {
              TotalRecordCount: 2,
              Items: ['3', '4'].map((digit, index) => ({
                Id: digit.repeat(32),
                Type: 'Movie',
                Name: index ? viewer.title + ' II' : viewer.title,
                ImageTags: { Primary: 'same-tag' },
                UserData: {},
                ProductionYear: 2024,
              })),
            }
          } else if (pathname.includes('/Images/')) {
            // One painted tile can travel; another private image stays pending.
            if (token === 'alpha' && pathname.includes('4'.repeat(32)))
              await oldImage.promise
            response.setHeader('Content-Type', 'image/svg+xml')
            response.end(
              '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="30"><rect width="20" height="30" fill="' +
                (token === 'alpha' ? 'red' : 'blue') +
                '"/></svg>',
            )
            return
          } else if (pathname === '/api/profile')
            body = {
              id: viewer.id,
              name: token,
              isAdministrator: false,
              canEdit: false,
              hasPassword: true,
            }
          else if (pathname === '/api/notifications')
            body = { items: [], unreadCount: 0 }
          else if (pathname === '/api/showcase') body = { items: [] }
          else if (pathname.endsWith('/providers'))
            body = {
              status: 'unconfigured',
              region: 'FR',
              regions: [],
              providers: [],
            }
          else if (pathname.endsWith('/reviews'))
            body = {
              items: [],
              own: null,
              total: 0,
              hasMore: false,
              external: 'unconfigured',
            }
          response.end(JSON.stringify(body))
        })
      },
    },
  ],
})
let browser
try {
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  browser = await chromium.launch({ channel: 'chrome' })
  const context = await browser.newContext({
    locale: 'fr-FR',
    serviceWorkers: 'block',
  })
  const writer = await context.newPage()
  await writer.goto(origin + '/')
  async function changeIdentity(token) {
    await writer.evaluate(
      ({ storageKey, sharedDevice, token }) => {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            deviceId: sharedDevice,
            accessToken: 'opaque-' + token,
          }),
        )
      },
      { storageKey, sharedDevice, token },
    )
  }
  const movies = async () => {
    const page = await context.newPage()
    await page.goto(origin + '/app/movies')
    await page
      .getByRole('heading', { name: accounts.alpha.title, exact: true })
      .waitFor()
    return page
  }
  await writer.evaluate(
    ({ server, accounts }) => {
      const prefix =
        'hollyfilms:performance:v1:' + encodeURIComponent(server) + ':'
      localStorage.setItem(prefix + accounts.alpha.id, 'essential')
      localStorage.setItem(prefix + accounts.beta.id, 'light')
    },
    { server: origin + '/jellyfin', accounts },
  )
  await changeIdentity('alpha')
  const settings = await context.newPage()
  await settings.goto(origin + '/profile')
  const modes = settings.getByRole('group', { name: 'Mode de performance' })
  const cinema = modes.getByRole('radio', { name: 'Cinéma', exact: true })
  const light = modes.getByRole('radio', { name: 'Léger', exact: true })
  await settings.locator('html[data-performance="light"]').waitFor()
  assert.ok(await light.isChecked(), 'Respect the member’s saved legacy mode')
  assert.equal(await modes.getByRole('radio').count(), 2)
  await cinema.check()
  await settings.locator('html[data-performance="cinema"]').waitFor()
  await settings.reload()
  await cinema.waitFor()
  assert.ok(await cinema.isChecked(), 'A member can save a mode across reload')
  const a = await movies()
  const b = await movies()
  const has = (token, suffix) =>
    calls.some((call) => call.token === token && call.pathname.includes(suffix))
  const tile = a.locator('.artwork-preview-trigger.media-tile-select').first()
  await tile.locator('.media-artwork[data-decoded] img').first().waitFor()
  assert.ok(
    has('alpha', '4'.repeat(32) + '/Images/'),
    'Old private image is pending',
  )
  await a.bringToFront()
  // Freeze the real artwork animation so the account changes mid-flight,
  // independently of browser speed. Session cleanup must release the canvas.
  await a.evaluate(() => {
    const observer = new MutationObserver(() => {
      const dialog = document.querySelector('.media-dialog[open]')
      if (!dialog?.querySelector('.detail-morph-picture')) return
      for (const animation of dialog.getAnimations({ subtree: true }))
        animation.pause()
      observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await tile.click()
  await a.locator('.media-dialog[open] .detail-morph-picture').waitFor()
  // Hold the new identity response so an accidental reuse of the prior session
  // remains observable even on a fast machine.
  await changeIdentity('beta')
  await a.waitForFunction(
    () => !document.documentElement.dataset.artworkFlight,
    null,
    { timeout: 2_000 },
  )
  for (const page of [a, b]) {
    await page
      .getByRole('heading', { name: accounts.alpha.title, exact: true })
      .waitFor({ state: 'detached', timeout: 5000 })
    assert.equal(await page.locator('.media-tile').count(), 0)
  }
  assert.ok(has('beta', '/Users/Me'))
  assert.equal(await a.locator('.detail-morph-picture').count(), 0)
  // Return to the same catalogue URL as the other tab before comparing bytes.
  await a.goto(origin + '/app/movies')
  newIdentity.resolve()
  oldImage.resolve()
  await settings.locator('html[data-performance="light"]').waitFor()
  assert.ok(await light.isChecked(), 'A second account restores its own mode')
  for (const page of [a, b]) {
    await page
      .getByRole('heading', { name: accounts.beta.title, exact: true })
      .waitFor()
    const image = page.locator('.media-artwork[data-decoded] img').first()
    await image.waitFor()
    const pixel = await image.evaluate((element) => {
      const canvas = document.createElement('canvas')
      canvas.height = canvas.width = 1
      const ctx = canvas.getContext('2d')
      ctx.drawImage(element, 0, 0, 1, 1)
      return [...ctx.getImageData(0, 0, 1, 1).data]
    })
    assert.deepEqual(pixel, [0, 0, 255, 255], 'Only Beta artwork is shown')
    assert.equal(
      await page
        .getByRole('heading', { name: accounts.alpha.title, exact: true })
        .count(),
      0,
    )
  }
  assert.ok(
    has('beta', '/Images/'),
    'The new member fetches its own authenticated bytes',
  )
  await b.reload()
  await b
    .getByRole('heading', { name: accounts.beta.title, exact: true })
    .waitFor()
  const otherOrigin = await context.newPage()
  await otherOrigin.goto(
    origin.replace('127.0.0.1', 'localhost') + '/app/movies',
  )
  await otherOrigin.locator('.showcase').waitFor()
  assert.equal(
    await otherOrigin.evaluate((key) => localStorage.getItem(key), storageKey),
    null,
  )
  await otherOrigin.close()
  await b.getByRole('button', { name: 'Se déconnecter', exact: true }).click()
  for (const page of [a, b]) {
    await page.locator('.showcase').waitFor()
    assert.equal(await page.locator('.media-tile').count(), 0)
  }
  await a.reload()
  await a.locator('.showcase').waitFor()
  assert.equal(
    await a.evaluate((key) => localStorage.getItem(key), storageKey),
    'null',
  )
  // Either tab may reject the token first. Its sign-out also cancels the
  // identity request in the other tab.
  const rejected = context.waitForEvent(
    'response',
    (response) =>
      response.url().endsWith('/Users/Me') && response.status() === 401,
  )
  await changeIdentity('denied')
  await rejected
  await a.waitForFunction(
    (key) => localStorage.getItem(key) === 'null',
    storageKey,
  )
  for (const page of [a, b]) {
    await page.locator('.showcase').waitFor()
    assert.equal(await page.locator('.media-tile').count(), 0)
  }
  assert.ok(has('denied', '/Users/Me'))
  assert.equal(has('denied', '/Items'), false)
  console.log(
    'Session switch, late image, cross-tab sign-out, reload and rejected identity passed against the production bundle.',
  )
} finally {
  newIdentity.resolve()
  oldImage.resolve()
  await browser?.close()
  await server.close()
}
