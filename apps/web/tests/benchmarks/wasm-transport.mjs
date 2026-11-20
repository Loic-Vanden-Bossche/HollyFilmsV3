import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
const exec = promisify(execFile)
const docker = (...args) => exec('docker', args, { windowsHide: true })
const [
  baseline,
  candidate,
  output,
  filename = 'jassub-worker-modern-fB_B5_2M.wasm',
] = process.argv.slice(2)
if (!baseline || !candidate || !output)
  throw new Error(
    'Expected: <baseline image> <candidate image> <output.json> [asset filename]',
  )
const pair = [
  ['before', baseline],
  ['after', candidate],
]
const asset = '/assets/' + encodeURIComponent(filename)
const folder = await mkdtemp(path.join(tmpdir(), 'holly-static-wasm-'))
const blank = path.join(folder, 'blank.html')
await writeFile(
  blank,
  '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Wasm</title></html>',
)
const containers = []
const origins = {}
const results = []
try {
  for (const [label, image] of pair) {
    const name =
      'holly-static-transport-' + label + '-' + randomBytes(4).toString('hex')
    await docker(
      'run',
      '--rm',
      '-d',
      '--name',
      name,
      '-p',
      '127.0.0.1::8080',
      '-e',
      'JELLYFIN_URL=http://127.0.0.1:8096',
      '--mount',
      'type=bind,source=' +
        blank +
        ',target=/usr/share/nginx/html/wasm-timing.html,readonly',
      image,
    )
    containers.push(name)
    const origin =
      'http://' + (await docker('port', name, '8080/tcp')).stdout.trim()
    origins[label] = origin
    for (let n = 0; n < 80; n++) {
      try {
        if ((await fetch(origin + '/healthz')).ok) break
      } catch {}
      await delay(100)
    }
  }
  for (let round = 0; round < 3; round++) {
    const ordered = round === 1 ? [...pair].reverse() : pair
    for (const [label] of ordered) {
      const browser = await chromium.launch({ channel: 'chrome' })
      try {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          serviceWorkers: 'block',
        })
        const page = await context.newPage()
        const cdp = await context.newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 80,
          downloadThroughput: 1_500_000,
          uploadThroughput: 750_000,
        })
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 3 })
        await page.goto(origins[label] + '/wasm-timing.html')
        for (const cache of ['cold', 'warm']) {
          const data = await page.evaluate(async (asset) => {
            performance.clearResourceTimings()
            const start = performance.now()
            const response = await fetch(asset)
            if (!response.ok) throw new Error('HTTP ' + response.status)
            const bytes = await response.arrayBuffer()
            const downloaded = performance.now()
            const mod = await WebAssembly.compile(bytes)
            const compiled = performance.now()
            const hash = await crypto.subtle.digest('SHA-256', bytes)
            const entry = performance.getEntriesByName(response.url).at(-1)
            return {
              fetchMs: downloaded - start,
              compileMs: compiled - downloaded,
              totalMs: compiled - start,
              sha256: Array.from(new Uint8Array(hash), (v) =>
                v.toString(16).padStart(2, '0'),
              ).join(''),
              transferSize: entry.transferSize,
              encodedBodySize: entry.encodedBodySize,
              decodedBodySize: entry.decodedBodySize,
              ce: response.headers.get('content-encoding'),
              vary: response.headers.get('vary'),
              cacheControl: response.headers.get('cache-control'),
              exports: WebAssembly.Module.exports(mod).length,
            }
          }, asset)
          assert.ok(data.decodedBodySize > 0 && data.exports > 0)
          assert.equal(data.transferSize === 0, cache === 'warm')
          if (results.length) assert.equal(data.sha256, results[0].sha256)
          const sample = {
            round: round + 1,
            asset,
            label,
            cache,
            browser: browser.version(),
            ...data,
          }
          results.push(sample)
          console.log(JSON.stringify(sample))
        }
      } finally {
        await browser.close()
      }
    }
  }
  await writeFile(output, JSON.stringify(results, null, 2))
} finally {
  for (const name of containers) await docker('rm', '-f', name)
  await rm(folder, { recursive: true, force: true })
}
