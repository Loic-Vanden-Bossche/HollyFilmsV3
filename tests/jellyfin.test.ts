import assert from 'node:assert/strict'
import test from 'node:test'
import { loadEnv } from 'vite'
import { getJellyfinServerInfo } from '../src/jellyfin.ts'

test('Jellyfin 12 répond sur son API publique', async () => {
  const env = loadEnv('development', process.cwd(), 'JELLYFIN_')
  const url = env.JELLYFIN_URL ?? 'http://127.0.0.1:8096'
  const info = await getJellyfinServerInfo(url)

  assert.match(info.ProductName ?? '', /^Jellyfin\b/i)
  assert.match(info.Version ?? '', /^12(?:\.|$)/)
})
