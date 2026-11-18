import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'

const web = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(web, process.argv[2] ?? 'dist')
const worker = await readFile(join(dist, 'sw.js'), 'utf8')
async function until(check) {
  const deadline = Date.now() + 10_000
  while (!(await check())) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for browser state')
    await delay(30)
  }
}
let revision = 1
let disconnected = false
const fixture = await preview({
  configFile: false,
  root: web,
  build: { outDir: dist },
  preview: { host: '127.0.0.1', port: 0 },
  plugins: [
    {
      name: 'pwa-test-origin',
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          if (disconnected) return request.socket.destroy()
          const { pathname } = new URL(request.url, 'http://localhost')
          if (pathname === '/sw.js') {
            response.setHeader('Content-Type', 'text/javascript')
            response.setHeader('Cache-Control', 'no-cache')
            // Some headless OS notification centers immediately discard displayed notices.
            // Observe the native promise after it succeeds so the same assertions work there.
            return response.end(
              worker +
                `
            const showNative = self.registration.showNotification.bind(self.registration)
            self.registration.showNotification = async (title, options) => {
              await showNative(title, options)
              for (const client of await self.clients.matchAll({type:'window'})) {
                client.postMessage({ type: 'TEST_PUSH_DISPLAYED', title, options })
              }
            }
            // fixture release ` +
                revision,
            )
          }
          if (!/^\/(?:api|jellyfin)\//.test(pathname)) return next()
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Cache-Control', 'no-store')
          response.end(
            JSON.stringify(pathname === '/api/showcase' ? { items: [] } : {}),
          )
        })
      },
    },
  ],
})

let context
try {
  context = await chromium.launchPersistentContext('', {
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    locale: 'en',
    permissions: ['notifications'],
  })
  const origin = 'http://127.0.0.1:' + fixture.httpServer.address().port
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  let registrationId
  cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
    registrationId =
      registrations.find((item) => item.scopeURL === origin + '/')
        ?.registrationId ?? registrationId
  })
  await cdp.send('ServiceWorker.enable')
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  const manifest = await cdp.send('Page.getAppManifest')
  assert.deepEqual(manifest.errors, [])
  assert.deepEqual(
    (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors,
    [],
  )
  const installed = JSON.parse(manifest.data)
  assert.equal(installed.start_url, '/app')
  assert.equal(installed.display, 'standalone')
  for (const icon of installed.icons) {
    const size = await page.evaluate(async (url) => {
      const image = new Image()
      image.src = url
      await image.decode()
      return image.naturalWidth + 'x' + image.naturalHeight
    }, icon.src)
    assert.equal(size, icon.sizes)
  }

  await page.evaluate(async () => {
    const sample = document.querySelector('script[type=module]').src
    const paths = [
      '/api/profile',
      '/jellyfin/Items/test?api_key=fixture',
      sample + '?session=fixture',
    ]
    await Promise.all(
      [...paths, sample].map(async (path) => (await fetch(path)).arrayBuffer()),
    )
  })
  await until(() =>
    page.evaluate(async () =>
      Boolean(
        await caches.match(document.querySelector('script[type=module]').src),
      ),
    ),
  )
  const cachedPrivateData = await page.evaluate(async () => {
    const names = await caches.keys()
    const entries = await (
      await caches.open(names.find((key) => key.startsWith('hollyfilms-pwa-')))
    ).keys()
    const urls = entries.map((entry) => new URL(entry.url))
    return urls.some(
      (url) => url.search || /^\/(?:api|jellyfin)\//.test(url.pathname),
    )
  })
  assert.equal(cachedPrivateData, false)

  await page.evaluate(() =>
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'HOLLYFILMS_NOTIFICATION')
        document.body.dataset.pushRecipient = event.data.userId
      if (event.data?.type === 'TEST_PUSH_DISPLAYED')
        window.lastNativePush = event.data
    }),
  )
  assert.ok(registrationId)
  for (const [url, expected] of [
    ['/requests?section=subtitles&ignored=1', '/requests?section=subtitles'],
    ['https://example.com/', '/notifications'],
  ]) {
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin,
      registrationId,
      data: JSON.stringify({
        title: 'HollyFilms',
        body: 'Test',
        tag: 'test',
        id: 'sample',
        userId: 'viewer',
        url,
      }),
    })
    await page.waitForFunction(
      (expected) =>
        window.lastNativePush?.options.body === 'Test' &&
        window.lastNativePush?.options.data.url === expected,
      expected,
    )
  }
  assert.equal(
    await page.locator('body').getAttribute('data-push-recipient'),
    'viewer',
  )

  const workerContext = context.serviceWorkers()[0]
  const notice = 'e582a69f-65a4-42ef-b258-17961e9f4309'
  const links = await workerContext.evaluate(
    (id) => [
      self.notificationClickUrl({
        userId: 'viewer',
        id,
        url: '/requests?section=subtitles&extra=1',
      }),
      self.notificationClickUrl({
        userId: 'viewer',
        id: 'test',
        url: '/profile',
      }),
      self.notificationClickUrl({ url: 'https://example.com/' }),
    ],
    notice,
  )
  assert.deepEqual(links, [
    origin + '/requests?section=subtitles&notice=' + notice,
    origin + '/profile',
    origin + '/notifications',
  ])

  async function setDelivery(enabled) {
    assert.equal(
      await page.evaluate(
        (enabled) =>
          new Promise((resolve) => {
            const channel = new MessageChannel()
            channel.port1.onmessage = (event) => {
              channel.port1.close()
              resolve(event.data)
            }
            navigator.serviceWorker.controller.postMessage(
              {
                type: 'HOLLYFILMS_PUSH_DELIVERY',
                userId: 'viewer',
                enabled,
              },
              [channel.port2],
            )
          }),
        enabled,
      ),
      true,
    )
  }
  await setDelivery(false)
  revision++
  await page.evaluate(async () =>
    (await navigator.serviceWorker.ready).update(),
  )
  await until(() =>
    page.evaluate(async () =>
      Boolean((await navigator.serviceWorker.ready).waiting),
    ),
  )
  assert.equal(
    await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    ),
    1,
  )
  await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', resolve, {
        once: true,
      })
      ready.waiting.postMessage({ type: 'HOLLYFILMS_ACTIVATE_UPDATE' })
    })
  })

  for (const enabled of [false, true]) {
    if (enabled) await setDelivery(true)
    await page.evaluate(() => {
      window.lastNativePush = null
    })
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin,
      registrationId,
      data: JSON.stringify({
        title: 'A private title',
        body: 'A private request',
        userId: 'viewer',
        id: notice,
        url: '/requests',
      }),
    })
    await page.waitForFunction(() => Boolean(window.lastNativePush))
    const noticeShown = await page.evaluate(() => window.lastNativePush)
    assert.equal(noticeShown.title, enabled ? 'A private title' : 'HollyFilms')
    assert.equal(noticeShown.options.body, enabled ? 'A private request' : '')
    assert.equal(noticeShown.options.data.userId, enabled ? 'viewer' : null)
    assert.equal(
      noticeShown.options.data.url,
      enabled ? '/requests' : '/notifications',
    )
    assert.equal(noticeShown.options.data.id, enabled ? notice : undefined)
  }

  disconnected = true
  await context.setOffline(true)
  await page.goto(origin + '/app/favorites', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'You’re offline' }).waitFor()
  assert.equal(
    await page.locator('#retry').evaluate((link) => link.href),
    page.url(),
  )
  disconnected = false
  await context.setOffline(false)
  // Chrome may retain navigator.onLine=true for loopback despite a transport outage.
  if (await page.locator('#retry').count()) await page.locator('#retry').click()
  await page.locator('#root').waitFor({ state: 'attached' })
  assert.equal(new URL(page.url()).pathname, '/app/favorites')
  console.log(
    'Chrome verified installability, safe public caching, push presentation and destinations, a waiting update, offline deep links and reconnection.',
  )
} finally {
  await context?.close()
  await fixture.close()
}
