import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const envDir = fileURLToPath(new URL('../../', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, 'JELLYFIN_')
  const apiEnv = loadEnv(mode, envDir, 'HOLLYFILMS_API_')

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      exclude: ['jassub', 'libbitsub', 'abslink', 'abslink/w3c'],
      include: [
        'jassub > throughput',
        'jassub > rvfc-polyfill',
        'jassub > lfa-ponyfill',
        '@jellyfin/sdk/lib/utils/api/library-api.js',
        '@jellyfin/sdk/lib/utils/api/lyric-api.js',
        '@jellyfin/sdk/lib/utils/api/image-api.js',
        '@jellyfin/sdk/lib/utils/api/media-info-api.js',
        '@jellyfin/sdk/lib/utils/api/media-segment-api.js',
        '@jellyfin/sdk/lib/utils/api/session-api.js',
        '@jellyfin/sdk/lib/utils/api/show-api.js',
        '@jellyfin/sdk/lib/utils/api/sync-play-api.js',
        '@jellyfin/sdk/lib/utils/api/system-api.js',
        '@jellyfin/sdk/lib/utils/api/video-api.js',
        'hls.js',
      ],
    },
    worker: { format: 'es' },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      proxy: {
        '^/api(?:/|$)': {
          target: apiEnv.HOLLYFILMS_API_URL ?? 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
        '^/jellyfin(?:/|$)': {
          target: env.JELLYFIN_URL ?? 'http://127.0.0.1:8096',
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jellyfin/, ''),
        },
      },
    },
  }
})
