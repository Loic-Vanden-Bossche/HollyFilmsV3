import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { getJellyfinServerInfo } from '@hollyfilms/shared/jellyfin'

test('Jellyfin 12 répond sur son API publique', async () => {
  const envDir = fileURLToPath(new URL('../../../', import.meta.url))
  const env = loadEnv('development', envDir, 'JELLYFIN_')
  const url = env.JELLYFIN_URL ?? 'http://127.0.0.1:8096'
  const info = await getJellyfinServerInfo(url)

  assert.match(info.ProductName ?? '', /^Jellyfin\b/i)
  assert.match(info.Version ?? '', /^12(?:\.|$)/)
})
