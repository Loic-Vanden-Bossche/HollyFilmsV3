// Run through tests/requests.e2e.mjs for a migrated, disposable PostgreSQL.
// The benchmark adds its own Jellyfin 12.4 and 18 generated movie/poster pairs.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api.js'
import {
  authenticateJellyfin,
  createJellyfinApi,
} from '@hollyfilms/shared/jellyfin'
import { createApp } from '../src/app.ts'

const exec = promisify(execFile)
const databaseUrl = process.env.HOLLYFILMS_TEST_DATABASE_URL
assert.ok(
  databaseUrl,
  'Start using node tests/requests.e2e.mjs tests/showcase-performance.mjs',
)
const container = 'hollyfilms-showcase-perf-' + randomBytes(6).toString('hex')
const docker = (...args) => exec('docker', args, { windowsHide: true })
await docker(
  'run',
  '-d',
  '--rm',
  '--name',
  container,
  '-p',
  '127.0.0.1::8096',
  'jellyfin/jellyfin:12.4',
)
let app
try {
  const backend =
    'http://' + (await docker('port', container, '8096/tcp')).stdout.trim()
  const password = randomBytes(20).toString('hex')
  const json = { 'Content-Type': 'application/json' }
  const post = async (url, body, headers = json) => {
    const response = await fetch(backend + url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    assert.ok(response.ok, `${url}: ${response.status}`)
  }
  async function until(check) {
    for (let attempt = 0; attempt < 240; attempt++) {
      if (await check().catch(() => false)) return
      await delay(250)
    }
    throw new Error('Disposable Jellyfin failed to become ready')
  }
  await until(async () => {
    const info = await (await fetch(backend + '/System/Info/Public')).json()
    return (
      /^12\.4\./.test(info.Version) && info.StartupWizardCompleted === false
    )
  })
  await fetch(backend + '/Startup/User')
  await post('/Startup/User', { Name: 'ShowcaseTest', Password: password })
  await post('/Startup/Complete')
  const { deviceId, accessToken } = await authenticateJellyfin(
    backend,
    'ShowcaseTest',
    password,
  )
  const keys = getAuthenticationApi(
    createJellyfinApi(backend, deviceId, accessToken),
  )
  await keys.createKey({ app: 'Showcase benchmark' })
  const key = (await keys.getKeys()).data.Items.find(
    (entry) => entry.AppName === 'Showcase benchmark',
  ).AccessToken
  const headers = { ...json, Authorization: `MediaBrowser Token="${key}"` }
  await docker(
    'exec',
    container,
    'sh',
    '-ec',
    `
    ff=/usr/lib/jellyfin-ffmpeg/ffmpeg
    "$ff" -loglevel error -f lavfi -i testsrc2=s=160x90:r=1:d=1 -threads 1 /tmp/film.mp4
    "$ff" -loglevel error -f lavfi -i testsrc2=s=600x900 -frames:v 1 -threads 1 /tmp/poster.jpg
    for i in $(seq 1 18); do
      title="Showcase $i (2026)"
      mkdir -p "/media/$title"
      cp /tmp/film.mp4 "/media/$title/$title.mp4"
      cp /tmp/poster.jpg "/media/$title/poster.jpg"
    done
  `,
  )
  await post(
    '/Library/VirtualFolders?name=Showcase&collectionType=movies&refreshLibrary=true',
    {
      LibraryOptions: {
        PathInfos: [{ Path: '/media' }],
        EnableRealtimeMonitor: false,
        TypeOptions: [
          { Type: 'Movie', MetadataFetchers: [], ImageFetchers: [] },
        ],
      },
    },
    headers,
  )
  await until(async () => {
    const res = await fetch(
      backend + '/Items?recursive=true&includeItemTypes=Movie',
      { headers },
    )
    const { Items } = await res.json()
    return (
      Items?.length === 18 && Items.every((item) => item.ImageTags?.Primary)
    )
  })
  app = await createApp({
    publicOrigin: 'http://localhost:5173',
    jellyfinApiKey: key,
    jellyfinUrl: backend,
    databaseUrl,
  })
  let handlerMs
  app.addHook('onResponse', async (_request, reply) => {
    handlerMs = reply.elapsedTime
  })
  const origin = await app.listen({ host: '127.0.0.1', port: 0 })
  const sample = async (url) => {
    const start = performance.now()
    const response = await fetch(origin + url)
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(response.status, 200)
    return { handlerMs, httpMs: performance.now() - start, bytes }
  }
  await sample('/api/auth/options')
  const results = []
  const rounds = Number(process.env.PERF_ROUNDS || 3)
  for (let i = 0; i < rounds; i++) {
    if (i) await delay(60_500) // Let the actual one-minute selection cache expire.
    let poster
    for (const cache of ['cold', 'warm']) {
      const { bytes, ...timing } = await sample('/api/showcase')
      const { items } = JSON.parse(bytes)
      assert.equal(items.length, 18)
      poster = items[0].poster
      assert.ok(poster)
      results.push({
        round: i + 1,
        path: 'selection',
        cache,
        bytes: bytes.length,
        ...timing,
      })
    }
    // First pass may create Jellyfin disk derivatives. Later passes reuse them.
    for (const width of [400, 240, 160]) {
      const { bytes, ...timing } = await sample(poster + '?width=' + width)
      assert.equal(bytes.readUInt16BE(), 0xffd8)
      results.push({
        round: i + 1,
        path: 'poster',
        width,
        bytes: bytes.length,
        ...timing,
      })
    }
    console.log(JSON.stringify(results.slice(-5)))
  }
  if (process.env.PERF_OUTPUT)
    await writeFile(process.env.PERF_OUTPUT, JSON.stringify(results, null, 2))
} finally {
  await app?.close()
  await docker('rm', '-f', container)
}
