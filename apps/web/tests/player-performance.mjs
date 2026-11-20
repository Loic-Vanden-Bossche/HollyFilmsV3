// From the repository root, point HOLLYFILMS_PLAYER_PERF at an absolute Vite
// production outDir and run corepack yarn test:player. Repeat with the other
// build using this same harness. HOLLYFILMS_PERF_OUTPUT saves the raw JSON.
// Each cold/warm pair shares its HTTP cache. A fresh context starts the next
// pair. The Docker fixture regenerates the same three-minute H.264/AAC film.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile } from 'node:fs/promises'

const exec = promisify(execFile)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Evaluated inside the page before any application code runs.
function instrument({ session, fallback, subtitle }) {
  localStorage.setItem('hollyfilms.jellyfin.session', JSON.stringify(session))
  const metrics = (window.playbackMeasurement = { stalls: [], long: [] })
  if (fallback) {
    // Reproduce the player's explicit burn-in settings on the initial POST so
    // both rendering methods start from the same click with the same track.
    const send = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.send = function (body) {
      if (typeof body === 'string' && body.includes('"DeviceProfile"')) {
        const request = JSON.parse(body)
        Object.assign(request, {
          SubtitleStreamIndex: subtitle,
          EnableDirectPlay: false,
          EnableDirectStream: false,
          AllowVideoStreamCopy: false,
          AlwaysBurnInSubtitleWhenTranscoding: true,
        })
        for (const profile of request.DeviceProfile.SubtitleProfiles)
          profile.Method = 'Encode'
        body = JSON.stringify(request)
      }
      return send.call(this, body)
    }
  }
  new PerformanceObserver((list) => {
    for (const event of list.getEntries())
      metrics.long.push([event.startTime, event.duration])
  }).observe({ type: 'longtask', buffered: true })
  document.addEventListener(
    'click',
    (e) => {
      if (e.target.closest?.('[data-artwork-open="player"]'))
        metrics.click = performance.now()
    },
    true,
  )
  new MutationObserver((_, observer) => {
    const video = document.querySelector('.player-shell video')
    if (!video || metrics.click === undefined) return
    observer.disconnect()
    metrics.video = performance.now()
    let waiting
    video.addEventListener('waiting', () => {
      if (metrics.frame !== undefined && waiting === undefined)
        waiting = performance.now()
    })
    video.addEventListener('playing', () => {
      if (waiting !== undefined)
        metrics.stalls.push(performance.now() - waiting)
      waiting = undefined
    })
    const capture = () => {
      metrics.frame ??= performance.now()
    }
    if (video.requestVideoFrameCallback)
      video.requestVideoFrameCallback(capture)
    else video.addEventListener('playing', capture, { once: true })
  }).observe(document, { childList: true, subtree: true })
}

async function sampleCpu(name) {
  const { stdout } = await exec(
    'docker',
    ['exec', name, 'cat', '/sys/fs/cgroup/cpu.stat'],
    { windowsHide: true },
  )
  return Number(stdout.match(/usage_usec (\d+)/)[1]) / 1000
}

function readBrowserSample() {
  const m = window.playbackMeasurement
  const v = document.querySelector('.player-shell video')
  const q = v.getVideoPlaybackQuality()
  const resources = performance.getEntriesByType('resource')
  // The fixture contains a visible ASS cue throughout this interval. Read its
  // transparent overlay separately from the film and player controls.
  const overlay = document.querySelector('.player-subtitle-canvas')
  let subtitlePixels
  if (overlay?.width && overlay.height) {
    const probe = new OffscreenCanvas(160, 90)
    const context = probe.getContext('2d')
    context.drawImage(overlay, 0, 0, probe.width, probe.height)
    const rgba = context.getImageData(0, 0, probe.width, probe.height).data
    subtitlePixels = 0
    for (let i = 3; i < rgba.length; i += 4) {
      if (rgba[i] > 0) subtitlePixels++
    }
  }
  const requests = resources
    .filter((r) => r.startTime >= m.click - 1 && r.startTime <= m.frame)
    .map((r) => ({
      name: new URL(r.name).pathname.split('/').at(-1),
      start: Math.round(r.startTime - m.click),
      duration: Math.round(r.duration),
      ttfb: Math.round(r.responseStart - r.requestStart),
      bytes: r.encodedBodySize,
      transferred: r.transferSize,
    }))
  const playerChunk = resources.find((entry) =>
    /\/PlaybackPlayer-[^/]+\.js$/.test(new URL(entry.name).pathname),
  )
  return {
    firstMs: Math.round(m.frame - m.click),
    elementMs: Math.round(m.video - m.click),
    marker: v.requestVideoFrameCallback ? 'rVFC' : 'playing',
    video: [v.videoWidth, v.videoHeight],
    subtitlePixels,
    chunk: playerChunk && {
      start: Math.round(playerChunk.startTime - m.click),
      body: playerChunk.encodedBodySize,
      transferred: playerChunk.transferSize,
    },
    playbackTime: v.currentTime,
    dropped: q.droppedVideoFrames,
    frames: q.totalVideoFrames,
    stalls: m.stalls.length,
    stallMs: Math.round(m.stalls.reduce((a, b) => a + b, 0)),
    longMs: Math.round(
      m.long
        .filter(([t]) => t >= m.click && t <= m.frame)
        .reduce((s, [, d]) => s + d, 0),
    ),
    requests,
  }
}

async function readWasmDownloads(page) {
  const workers = page
    .workers()
    .filter((worker) =>
      /jassub|\/worker[-.]/i.test(new URL(worker.url()).pathname),
    )
  const wasmDownloads = (
    await Promise.all(
      workers.map((worker) =>
        worker.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .filter((entry) => new URL(entry.name).pathname.endsWith('.wasm'))
            .map((entry) => ({
              file: new URL(entry.name).pathname.split('/').at(-1),
              bytes: entry.transferSize,
              body: entry.decodedBodySize,
              duration: Math.round(entry.duration),
            })),
        ),
      ),
    )
  ).flat()
  return { wasmWorkers: workers.length, wasmDownloads }
}

async function measurePair({
  browser,
  origin,
  name,
  auth,
  item,
  api,
  headers,
  subtitle,
  profile,
  mode,
  round,
}) {
  const samples = []
  const mobile = profile === 'mobile'
  const ctx = await browser.newContext({
    locale: 'fr-FR',
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 2 : 1,
    serviceWorkers: 'block',
  })
  try {
    await ctx.addInitScript(instrument, {
      session: { accessToken: auth.AccessToken, deviceId: 'player-e2e' },
      fallback: mode === 'burn',
      subtitle,
    })
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 80,
      downloadThroughput: 1_500_000,
      uploadThroughput: 1_500_000,
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 3 })
    let source, method, options
    page.on('request', (req) => {
      if (
        req.method() === 'POST' &&
        new URL(req.url()).pathname.endsWith('/Sessions/Playing')
      )
        method = req.postDataJSON()?.PlayMethod
      if (
        req.method() === 'POST' &&
        new URL(req.url()).pathname.endsWith('/PlaybackInfo')
      )
        options = req.postDataJSON()
    })
    page.on('response', async (res) => {
      if (
        res.request().method() === 'POST' &&
        new URL(res.url()).pathname.endsWith('/PlaybackInfo')
      ) {
        try {
          source = (await res.json()).MediaSources?.[0]
        } catch {
          /* page closed */
        }
      }
    })
    for (const cache of ['cold', 'warm']) {
      source = method = options = undefined
      await page.goto(origin + '/app?media=' + item.Id, {
        waitUntil: 'domcontentloaded',
      })
      const button = page
        .locator('.media-play-actions [data-artwork-open="player"]')
        .first()
      await button.waitFor()
      await button.scrollIntoViewIfNeeded()
      if (!mobile) await button.hover()
      // Identical short dwell on the details page in each run.
      await sleep(350)
      const cpuStart = await sampleCpu(name)
      if (mobile) await button.tap()
      else await button.click()
      try {
        await page.waitForFunction(
          () => window.playbackMeasurement.frame !== undefined,
          undefined,
          { timeout: 35000 },
        )
        if (mode === 'local')
          await page
            .locator('.player-subtitle-canvas')
            .waitFor({ timeout: 20000 })
        // Cover the same playback interval for late stalls and dropped frames.
        await page.waitForFunction(
          () => {
            const v = document.querySelector('.player-shell video')
            return v?.currentTime >= 4 && !v.paused
          },
          undefined,
          { timeout: 30000 },
        )
      } catch (error) {
        console.error('Failed sample', profile, mode, cache, {
          method,
          subtitle: source?.DefaultSubtitleStreamIndex,
          codecs: source?.MediaStreams?.map((s) => s.Codec),
          frame: await page.evaluate(() => !!window.playbackMeasurement.frame),
        })
        throw error
      }
      const cpuMs = Math.round((await sampleCpu(name)) - cpuStart)
      const row = await page.evaluate(readBrowserSample)
      assert.deepEqual(row.video, [640, 360])
      assert.equal(source?.DefaultSubtitleStreamIndex, subtitle)
      const selectedAudio = source.MediaStreams.find(
        (s) => s.Index === source.DefaultAudioStreamIndex,
      )
      assert.equal(selectedAudio?.Type, 'Audio')
      assert.match(selectedAudio.Language, /fra|fre/)
      const target = new URL(source.TranscodingUrl || '/', origin)
      const server = await (await api('/Sessions', { headers })).json()
      const info = server.find(
        (s) => s.NowPlayingItem?.Id === item.Id,
      )?.TranscodingInfo
      const wasm = await readWasmDownloads(page)
      const result = {
        round,
        profile,
        mode,
        cache,
        ...row,
        cpuMs,
        method,
        videoDirect: info?.IsVideoDirect,
        audioDirect: info?.IsAudioDirect,
        subtitleDelivery: source.MediaStreams.find((s) => s.Index === subtitle)
          ?.DeliveryMethod,
        audio: source.DefaultAudioStreamIndex,
        subtitle,
        startTicks: options.StartTimeTicks,
        bitrate: options.MaxStreamingBitrate,
        ...wasm,
        ...(mode === 'burn' && {
          subtitleMethod: target.searchParams.get('SubtitleMethod'),
        }),
      }
      assert.equal(method, mode === 'burn' ? 'Transcode' : 'DirectPlay')
      assert.equal(
        result.subtitleDelivery,
        mode === 'burn' ? 'Encode' : 'External',
      )
      assert.equal(options.StartTimeTicks, 0)
      if (mode === 'burn') {
        assert.equal(result.subtitleMethod, 'Encode')
        assert.equal(result.videoDirect, false)
        assert.equal(result.audioDirect, true)
      }
      samples.push(result)
      console.log(JSON.stringify({ ...result, requests: undefined }))
      await page.goBack()
      await page.waitForFunction(
        () => !new URL(location.href).searchParams.has('play'),
      )
    }
    return samples
  } finally {
    await ctx.close()
  }
}

export async function benchmarkPlayer({
  browser,
  origin,
  name,
  auth,
  item,
  api,
  headers,
}) {
  const tracks = (
    await (
      await api('/Items/' + item.Id + '?userId=' + auth.User.Id, { headers })
    ).json()
  ).MediaStreams
  const subtitle = tracks.find((t) => t.Codec.toLowerCase() === 'ass').Index
  await api('/Users/' + auth.User.Id + '/Configuration', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...auth.User.Configuration,
      AudioLanguagePreference: 'fra',
      SubtitleLanguagePreference: 'eng',
      SubtitleMode: 'Always',
    }),
  })
  const rows = []
  const rounds = Number(process.env.HOLLYFILMS_PERF_ROUNDS || 3)
  const profiles = process.env.HOLLYFILMS_PERF_PROFILES?.split(',') ?? [
    'desktop',
    'mobile',
  ]
  const modes = process.env.HOLLYFILMS_PERF_MODES?.split(',') ?? [
    'local',
    'burn',
  ]
  for (let round = 0; round < rounds; round++) {
    for (const profile of profiles) {
      for (const mode of modes) {
        const pair = await measurePair({
          browser,
          origin,
          name,
          auth,
          item,
          api,
          headers,
          subtitle,
          profile,
          mode,
          round,
        })
        rows.push(...pair)
        if (process.env.HOLLYFILMS_PERF_OUTPUT)
          await writeFile(
            process.env.HOLLYFILMS_PERF_OUTPUT,
            JSON.stringify(rows, null, 2),
          )
      }
    }
  }
  function median(values) {
    const sorted = values.toSorted((a, b) => a - b)
    const midpoint = (sorted.length - 1) / 2
    return (sorted[Math.floor(midpoint)] + sorted[Math.ceil(midpoint)]) / 2
  }
  console.table(
    Object.values(
      Object.groupBy(rows, (row) =>
        [row.profile, row.mode, row.cache].join('/'),
      ),
    ).map((samples) => ({
      profile: samples[0].profile,
      mode: samples[0].mode,
      cache: samples[0].cache,
      runs: samples.length,
      firstFrameMs: median(samples.map((row) => row.firstMs)),
      jellyfinCpuMs: median(samples.map((row) => row.cpuMs)),
      dropped: samples.reduce((count, row) => count + row.dropped, 0),
      frames: samples.reduce((count, row) => count + row.frames, 0),
      stalls: samples.reduce((count, row) => count + row.stalls, 0),
    })),
  )
}
