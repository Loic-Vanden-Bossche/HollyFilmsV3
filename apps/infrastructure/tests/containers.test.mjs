import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const apiImage =
  process.env.HOLLYFILMS_TEST_API_IMAGE || 'hollyfilms-infra-api:qa'
const webImage =
  process.env.HOLLYFILMS_TEST_WEB_IMAGE || 'hollyfilms-infra-web:qa'
const fixture = fileURLToPath(new URL('./upstream.mjs', import.meta.url))
function docker(...args) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check) {
  for (let n = 0; n < 60; n++) {
    try {
      if (await check()) return
    } catch {
      /* the isolated service is starting */
    }
    await delay(500)
  }
  throw new Error('Service did not become ready within 30 seconds')
}

test(
  'production containers: migrations, SPA, secrets, API, video Range and WebSocket',
  { timeout: 180000 },
  async (t) => {
    const name = `hollyfilms-infra-test-${process.pid}`
    const names = []
    docker('network', 'create', name)
    t.after(() => {
      for (const container of names.reverse()) {
        try {
          docker('rm', '-f', '-v', container)
        } catch {
          /* already stopped */
        }
      }
      docker('network', 'rm', name)
    })
    function start(suffix, args) {
      const container = `${name}-${suffix}`
      names.push(container)
      docker('run', '-d', '--name', container, ...args)
      return container
    }
    const pg = start('pg', [
      '--network',
      name,
      '-e',
      'POSTGRES_PASSWORD=isolated-test-password',
      '-e',
      'POSTGRES_USER=hollyfilms',
      '-e',
      'POSTGRES_DB=hollyfilms',
      'postgres:18.7-alpine',
    ])
    await until(() => {
      docker('exec', pg, 'pg_isready', '-U', 'hollyfilms')
      return true
    })
    const database = `DATABASE_URL=postgresql://hollyfilms:isolated-test-password@${pg}:5432/hollyfilms`
    const migrate = () =>
      docker(
        'run',
        '--rm',
        '--network',
        name,
        '-e',
        database,
        apiImage,
        'node',
        'node_modules/prisma/build/index.js',
        'migrate',
        'deploy',
        '--config',
        'apps/api/prisma.config.ts',
      )
    assert.match(migrate(), /successfully applied|No pending migrations/)
    assert.match(migrate(), /No pending migrations/)
    const upstream = start('upstream', [
      '--network',
      name,
      '--mount',
      `type=bind,source=${fixture},target=/tmp/upstream.mjs,readonly`,
      apiImage,
      'node',
      '/tmp/upstream.mjs',
    ])
    const api = start('api', [
      '--network',
      name,
      '-p',
      '127.0.0.1::8080',
      '--read-only',
      '--tmpfs',
      '/tmp',
      '-e',
      database,
      '-e',
      `JELLYFIN_URL=http://${upstream}:8096`,
      '-e',
      'JELLYFIN_API_KEY=server-only-test-value',
      '-e',
      'PUBLIC_ORIGIN=https://hollyfilms-v3.chbrx.com',
      '-e',
      'TRUST_PROXY=loopback',
      apiImage,
    ])
    start('web', [
      '--network',
      `container:${api}`,
      '--read-only',
      '--tmpfs',
      '/tmp',
      '-e',
      `JELLYFIN_URL=http://${upstream}:8096`,
      webImage,
    ])
    const port = docker('port', api, '8080/tcp').split(':').at(-1)
    const base = `http://127.0.0.1:${port}`
    try {
      await until(
        async () =>
          (
            await fetch(base + '/api/health', {
              signal: AbortSignal.timeout(1000),
            })
          ).ok,
      )
    } catch (error) {
      for (const container of names) {
        const logs = spawnSync('docker', ['logs', '--tail', '20', container], {
          encoding: 'utf8',
        })
        console.error(container, logs.stdout, logs.stderr)
      }
      throw error
    }
    const home = await fetch(base + '/')
    const html = await home.text()
    assert.match(html, /HollyFilms/)
    assert.ok(!html.includes('server-only-test-value'))
    assert.equal(await (await fetch(base + '/app')).text(), html)
    assert.equal(await (await fetch(base + '/notifications')).text(), html)
    const manifest = await fetch(base + '/manifest.webmanifest')
    assert.match(
      manifest.headers.get('content-type'),
      /application\/manifest\+json/,
    )
    const { icons, display } = await manifest.json()
    assert.equal(display, 'standalone')
    for (const icon of icons) {
      assert.equal((await fetch(new URL(icon.src, manifest.url))).status, 200)
    }
    const worker = await fetch(base + '/sw.js')
    assert.match(worker.headers.get('content-type'), /javascript/)
    assert.match(worker.headers.get('cache-control'), /no-cache/)
    assert.equal((await fetch(base + '/api/notifications')).status, 401)
    assert.match(
      (await fetch(base + '/index.html')).headers.get('cache-control'),
      /no-store/,
    )
    const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)[1]
    assert.match(
      (await fetch(base + asset)).headers.get('cache-control'),
      /immutable/,
    )
    assert.equal((await fetch(base + '/assets/missing.js')).status, 404)
    assert.equal(
      (
        await fetch(
          base + '/api/media/11111111111111111111111111111111/reviews',
        )
      ).status,
      401,
    )
    const upstreamInfo = await (
      await fetch(base + '/jellyfin/System/Info/Public', {
        headers: { Authorization: 'MediaBrowser Token="user-test"' },
      })
    ).json()
    assert.equal(upstreamInfo.path, '/System/Info/Public')
    assert.equal(upstreamInfo.authorization, 'MediaBrowser Token="user-test"')
    const video = await fetch(
      base + '/jellyfin/Videos/demo/stream?token=demo%2Ftoken',
      { headers: { Range: 'bytes=2-5' } },
    )
    assert.equal(video.status, 206)
    assert.equal(video.headers.get('content-range'), 'bytes 2-5/10')
    assert.equal(await video.text(), '2345')
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(
        base.replace('http:', 'ws:') + '/jellyfin/socket?token=demo',
      )
      const timer = setTimeout(() => {
        socket.close()
        reject(new Error('WebSocket timeout'))
      }, 5000)
      socket.onmessage = (event) => {
        clearTimeout(timer)
        socket.close()
        try {
          assert.equal(event.data, 'ok')
          resolve()
        } catch (error) {
          reject(error)
        }
      }
      socket.onerror = () => {
        clearTimeout(timer)
        reject(new Error('WebSocket failed'))
      }
    })
    // The image must fail startup instead of serving an API without its server key.
    assert.throws(
      () => docker('run', '--rm', '-e', database, apiImage),
      (error) => String(error.stderr).includes('JELLYFIN_API_KEY'),
    )
    console.log(
      'Production images validated without using any real credential or writing to the existing infrastructure.',
    )
  },
)
