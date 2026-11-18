// Vite substitutes the app release and its public, fingerprinted code/font files.
const cachePrefix = 'hollyfilms-pwa-'
const cacheName = cachePrefix + '__HOLLYFILMS_REVISION__'
const publicFiles = new Set(/* vite-public */ [])
const releaseAssets = new Set(/* vite-assets */ [])
const messages = new Map(/* vite-messages */ [])
const applicationPath =
  /^\/(?:(?:app(?:\/(?:movies|series|collections|favorites))?|notifications|profile|(?:admin\/)?requests|admin)\/?)?$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName)
      await cache.addAll(
        [...publicFiles].map(
          (path) =>
            new Request(path, {
              cache: 'reload',
              credentials: 'omit',
              redirect: 'error',
            }),
        ),
      )
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = (await caches.keys()).filter(
        (name) => name.startsWith(cachePrefix) && name !== cacheName,
      )
      // A second tab may still need bundles from the previous release.
      await Promise.all(names.slice(0, -1).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'HOLLYFILMS_ACTIVATE_UPDATE')
    event.waitUntil(self.skipWaiting())
  if (
    event.data?.type === 'HOLLYFILMS_PUSH_DELIVERY' &&
    typeof event.data.enabled === 'boolean'
  )
    event.waitUntil(
      updatePushDelivery(event.data).then(
        () => event.ports[0]?.postMessage(true),
        () => event.ports[0]?.postMessage(false),
      ),
    )
})

// Keep offline revocation across app updates, without storing an account ID or
// any message content. Each user's marker is independent on a shared device.
const deliveryCache = 'hollyfilms-notification-preferences'
async function muteKey(userId) {
  const normalized =
    typeof userId === 'string' && userId.replaceAll('-', '').toLowerCase()
  if (!normalized || normalized.length > 128) return null
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized),
  )
  return (
    '/.hollyfilms/muted/' +
    Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  )
}

async function updatePushDelivery({ userId, enabled }) {
  const key = await muteKey(userId)
  if (!key) return
  const cache = await caches.open(deliveryCache)
  if (enabled) await cache.delete(key)
  else await cache.put(key, new Response(null, { status: 204 }))
}

async function isMuted(userId) {
  const key = await muteKey(userId)
  return key && Boolean(await caches.match(key, { cacheName: deliveryCache }))
}

async function publicAsset(event, path) {
  const { request } = event
  const cache = await caches.open(cacheName).catch(() => null)
  const cached = await cache?.match(path).catch(() => undefined)
  if (cached) return cached
  const response = await fetch(new Request(request, { credentials: 'omit' }))
  if (
    cache &&
    response.ok &&
    response.type === 'basic' &&
    !response.redirected &&
    !/private|no-store/i.test(response.headers.get('cache-control') ?? '') &&
    !/text\/html/i.test(response.headers.get('content-type') ?? '')
  ) {
    event.waitUntil(cache.put(path, response.clone()).catch(() => {}))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (
    request.method !== 'GET' ||
    request.headers.has('range') ||
    request.headers.has('authorization') ||
    request.headers.has('x-emby-authorization')
  )
    return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate' && applicationPath.test(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await (
          await caches.open(cacheName)
        ).match('/offline.html')
        return offline ?? Response.error()
      }),
    )
  } else if (
    !url.search &&
    (publicFiles.has(url.pathname) || releaseAssets.has(url.pathname))
  ) {
    event.respondWith(publicAsset(event, url.pathname))
  } else if (
    !url.search &&
    /^\/assets\/[^/]+-[\w-]{8}\.(?:js|css|woff2?|ttf|otf)$/.test(url.pathname)
  ) {
    // A release that is still open can request one of its already cached chunks.
    event.respondWith(
      (async () => {
        for (const name of await caches.keys()) {
          if (!name.startsWith(cachePrefix) || name === cacheName) continue
          const previous = await (await caches.open(name)).match(url.pathname)
          if (previous) return previous
        }
        return fetch(request)
      })(),
    )
  }
})

function notificationUrl(path) {
  try {
    const url = new URL(path, self.location.origin)
    if (
      url.origin === self.location.origin &&
      applicationPath.test(url.pathname)
    ) {
      const subtitles =
        url.pathname === '/requests' &&
        url.searchParams.get('section') === 'subtitles'
      return url.pathname + (subtitles ? '?section=subtitles' : '')
    }
  } catch {
    // A notification should always open an actual application screen.
  }
  return '/notifications'
}

function localizePush(value) {
  const language =
    self.navigator.languages
      .map((item) => item.toLowerCase().split('-')[0])
      .find((item) => item === 'en' || item === 'fr' || item === 'zh') ?? 'en'
  return messages.get(value)?.[language] ?? value
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let message = {}
      try {
        message = event.data?.json() ?? {}
      } catch {
        // Malformed or empty payloads still produce a visible notification.
      }
      let userId = typeof message.userId === 'string' ? message.userId : null
      // Web Push requires a visible notification even for a final in-flight message.
      if (await isMuted(userId).catch(() => true)) {
        message = {}
        userId = null
      }
      await self.registration.showNotification(
        typeof message.title === 'string' && message.title
          ? localizePush(message.title)
          : 'HollyFilms',
        {
          body:
            typeof message.body === 'string' ? localizePush(message.body) : '',
          icon: '/pwa/icon-192.png',
          badge: '/pwa/badge.png',
          tag: typeof message.tag === 'string' ? message.tag : undefined,
          data: { url: notificationUrl(message.url), userId, id: message.id },
        },
      )
      if (!userId) return
      for (const client of await self.clients.matchAll({ type: 'window' })) {
        client.postMessage({ type: 'HOLLYFILMS_NOTIFICATION', userId })
      }
    })(),
  )
})

function matchesViewer(client, userId) {
  const channel = new MessageChannel()
  return new Promise((resolve) => {
    const finish = (matches) => {
      clearTimeout(timer)
      channel.port1.close()
      resolve(matches)
    }
    const timer = setTimeout(() => finish(false), 450)
    channel.port1.onmessage = ({ data }) => finish(data === true)
    try {
      client.postMessage({ type: 'HOLLYFILMS_MATCH_VIEWER', userId }, [
        channel.port2,
      ])
    } catch {
      finish(false)
    }
  })
}

function notificationClickUrl({ userId, id, url }) {
  const target = new URL(notificationUrl(url), self.location.origin)
  if (
    userId &&
    typeof id === 'string' &&
    /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)
  )
    target.searchParams.set('notice', id)
  return target.href
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      let data = event.notification.data ?? {}
      if (await isMuted(data.userId).catch(() => true)) data = {}
      const { userId } = data
      const target = notificationClickUrl(data)
      const windows = await self.clients.matchAll({ type: 'window' })
      const eligible = windows.filter((client) => {
        const url = new URL(client.url)
        return (
          applicationPath.test(url.pathname) && !url.searchParams.has('play')
        )
      })
      const permissions = await Promise.all(
        eligible.map((client) => matchesViewer(client, userId)),
      )
      const sameViewer = eligible.filter((_, index) => permissions[index])
      const existing =
        sameViewer.find((client) => client.url === target) ?? sameViewer[0]
      if (existing) {
        try {
          const destination =
            existing.url === target ? existing : await existing.navigate(target)
          if (destination) {
            await destination.focus()
            return
          }
        } catch {
          // The tab may have closed while the system notification was open.
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
