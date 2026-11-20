// Run from @hollyfilms/web with Chrome, ffmpeg and clang (wasm32 + wasm-ld).
// No API keys or existing media required. Compiled artefacts are temporary.
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const folder = await mkdtemp(path.join(tmpdir(), 'hollyfilms-intervals-'))
const file = (name) => path.join(folder, name)
let browser
let server
try {
  execFileSync(process.env.CLANG ?? 'clang', [
    '--target=wasm32',
    '-O3',
    '-nostdlib',
    '-Wl,--no-entry',
    '-Wl,--export=intervals',
    '-Wl,--export=__heap_base',
    '-Wl,--strip-all',
    '-o',
    file('intervals.wasm'),
    path.join(here, 'intervals.c'),
  ])
  execFileSync(process.env.FFMPEG ?? 'ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=s=32x32:r=1/10:d=7200',
    '-c:v',
    'libvpx-vp9',
    '-threads',
    '1',
    '-g',
    '1',
    file('film.webm'),
  ])

  const assets = new Map([
    [
      '/browser.mjs',
      ['text/javascript', await readFile(path.join(here, 'browser.mjs'))],
    ],
    [
      '/calculator.mjs',
      ['text/javascript', await readFile(path.join(here, 'calculator.mjs'))],
    ],
    [
      '/shared.mjs',
      [
        'text/javascript',
        Buffer.from(
          stripTypeScriptTypes(
            await readFile(
              new URL(
                '../../../../shared/src/subtitle-sync.ts',
                import.meta.url,
              ),
              'utf8',
            ),
          ),
        ),
      ],
    ],
    [
      '/intervals.wasm',
      ['application/wasm', await readFile(file('intervals.wasm'))],
    ],
    ['/film.webm', ['video/webm', await readFile(file('film.webm'))]],
    [
      '/',
      [
        'text/html; charset=utf-8',
        Buffer.from(
          '<!doctype html><meta name="viewport" content="width=device-width"><video muted width="160" height="90"></video><output></output><button disabled>Décaler</button><script type="module" src="/browser.mjs"></script>',
        ),
      ],
    ],
  ])
  server = createServer((request, response) => {
    const asset = assets.get(new URL(request.url, 'http://localhost').pathname)
    if (!asset) {
      response.writeHead(404).end()
      return
    }
    const [type, bytes] = asset
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '')
    const start = range ? Number(range[1]) : 0
    const end = range?.[2]
      ? Math.min(Number(range[2]), bytes.length - 1)
      : bytes.length - 1
    response
      .writeHead(range ? 206 : 200, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Accept-Ranges': 'bytes',
        ...(range && {
          'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
        }),
      })
      .end(bytes.subarray(start, end + 1))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  const runs = []
  const rounds = Number(process.env.PERF_ROUNDS || 5)
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (let round = 0; round < rounds; round++) {
    for (const mobile of [false, true]) {
      const modes = ['js', 'wasm', 'worker']
      for (let index = 0; index < modes.length; index++) {
        const mode = modes[(index + round) % modes.length]
        const context = await browser.newContext({
          viewport: mobile
            ? { width: 390, height: 844 }
            : { width: 1440, height: 900 },
          deviceScaleFactor: mobile ? 2 : 1,
          isMobile: mobile,
          hasTouch: mobile,
        })
        try {
          const page = await context.newPage()
          const cdp = await context.newCDPSession(page)
          await cdp.send('Network.enable')
          await cdp.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 80,
            downloadThroughput: 1500000,
            uploadThroughput: 750000,
          })
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 3 })
          await page.goto(`${base}/?mode=${mode}`)
          const button = page.getByRole('button', { name: 'Décaler' })
          for (const cache of ['cold', 'warm']) {
            await button.click()
            const metrics = await page.evaluate(() => window.timingResult)
            runs.push({ round, mobile, mode, cache, ...metrics })
          }
        } finally {
          await context.close()
        }
      }
    }
  }
  const result = {
    browser: browser.version(),
    rounds,
    wasmBytes: assets.get('/intervals.wasm')[1].length,
    workerBytes: assets.get('/calculator.mjs')[1].length,
    runs,
  }
  if (process.env.PERF_OUTPUT)
    await writeFile(process.env.PERF_OUTPUT, JSON.stringify(result, null, 2))
  else console.log(JSON.stringify(result, null, 2))
} finally {
  await browser?.close()
  if (server) await new Promise((resolve) => server.close(resolve))
  await rm(folder, { recursive: true, force: true })
}
