import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import en from '../src/i18n/en.ts'
import zh from '../src/i18n/zh-Hans.ts'

const publicFiles = [
  '/offline.html',
  '/manifest.webmanifest',
  '/pwa/offline.js',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/apple-touch-icon.png',
  '/pwa/badge.png',
]

// Include only copy that a server event can show on the lock screen.
const notificationCopy = [
  'Demande de média approuvée',
  'Demande de média refusée',
  'Demande de média relancée',
  'Sous-titres disponibles',
  'Demande de sous-titres refusée',
  'Notifications activées',
  'Cet appareil peut recevoir les notifications HollyFilms.',
  'Ouvre tes demandes pour consulter la mise à jour.',
] as const

function serviceWorker(assets: string[]) {
  const source = readFileSync(
    new URL('./service-worker.js', import.meta.url),
    'utf8',
  )
  const messages = JSON.stringify(
    notificationCopy.map((key) => [key, { en: en[key], zh: zh[key] }]),
  )
  const revision = createHash('sha256')
    .update(source)
    .update(assets.join('\n'))
    .update(messages)
  for (const file of publicFiles)
    revision.update(readFileSync(new URL('../public' + file, import.meta.url)))
  return source
    .replace('__HOLLYFILMS_REVISION__', revision.digest('hex').slice(0, 16))
    .replace('/* vite-public */ []', JSON.stringify(publicFiles))
    .replace('/* vite-assets */ []', JSON.stringify(assets))
    .replace('/* vite-messages */ []', messages)
}

export function hollyFilmsPwa(): Plugin {
  return {
    name: 'hollyfilms-pwa',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use('/sw.js', (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript')
        response.setHeader('Cache-Control', 'no-cache')
        response.end(serviceWorker([]))
      })
    },
    generateBundle(_options, bundle) {
      // Storybook also loads the workspace Vite config. Only the app has an HTML entry.
      if (
        !Object.values(bundle).some(
          (entry) =>
            entry.type === 'chunk' &&
            entry.isEntry &&
            entry.facadeModuleId?.endsWith('/index.html'),
        )
      )
        return
      const assets = Object.keys(bundle)
        .filter((name) =>
          /^assets\/[^/]+-[\w-]{8}\.(?:js|css|woff2?|ttf|otf)$/.test(name),
        )
        .sort()
        .map((name) => '/' + name)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorker(assets),
      })
    },
  }
}
