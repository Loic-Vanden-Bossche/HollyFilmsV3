import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'JELLYFIN_')
  const apiEnv = loadEnv(mode, process.cwd(), 'HOLLYFILMS_API_')

  return {
    plugins: [react(), tailwindcss()],
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
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jellyfin/, ''),
        },
      },
    },
  }
})
