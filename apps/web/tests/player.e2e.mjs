// Uses a disposable Jellyfin 12.4 instance, synthetic media and a real browser.
// No access to the developer's account, media library, API key or database.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import test from 'node:test'
import { chromium } from 'playwright'

const exec = promisify(execFile)
const require = createRequire(import.meta.url)
const workspace = fileURLToPath(new URL('..', import.meta.url))
const root = path.resolve(workspace, '../..')

async function until(check, description, timeout = 60_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await check().catch(() => false)
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out: ${description}`)
}

async function port() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const number = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return number
}

async function writeInContainer(name, destination, text) {
  await new Promise((resolve, reject) => {
    const process = spawn(
      'docker',
      ['exec', '-i', name, 'sh', '-c', 'cat > "$1"', 'sh', destination],
      { windowsHide: true },
    )
    process.on('error', reject)
    process.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Fixture write failed')),
    )
    process.stdin.end(text)
  })
}

test(
  'HollyFilms player decodes video, changes streams, resumes and controls other sessions',
  { timeout: 240_000 },
  async (t) => {
    const name = `hollyfilms-player-e2e-${process.pid}`
    await exec('docker', [
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      '-p',
      '127.0.0.1::8096',
      'jellyfin/jellyfin:12.4',
    ])
    t.after(() => exec('docker', ['rm', '-f', name]).catch(() => {}))
    const published = (
      await exec('docker', ['port', name, '8096/tcp'])
    ).stdout.trim()
    const backend = `http://${published}`
    const api = async (endpoint, options = {}) => {
      const response = await fetch(backend + endpoint, options)
      assert(
        response.ok,
        `${options.method ?? 'GET'} ${endpoint.split('?')[0]}: ${response.status}`,
      )
      return response
    }
    const info = await until(async () => {
      const result = await (await fetch(backend + '/System/Info/Public')).json()
      return result.Version ? result : false
    }, 'Jellyfin startup')
    assert.match(info.Version, /^12\.4\./)
    assert.equal(info.StartupWizardCompleted, false)
    const password = randomBytes(24).toString('hex')
    const json = { 'Content-Type': 'application/json' }
    await api('/Startup/User')
    await api('/Startup/User', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ Name: 'PlayerTest', Password: password }),
    })
    await api('/Startup/Complete', { method: 'POST' })
    const authorization =
      'MediaBrowser Client="HollyFilms", Device="Player test", DeviceId="player-e2e", Version="3.0.0"'
    const auth = await (
      await api('/Users/AuthenticateByName', {
        method: 'POST',
        headers: { ...json, Authorization: authorization },
        body: JSON.stringify({ Username: 'PlayerTest', Pw: password }),
      })
    ).json()
    const headers = {
      ...json,
      Authorization: `${authorization}, Token="${auth.AccessToken}"`,
    }
    const config = await (
      await api('/System/Configuration', { headers })
    ).json()
    config.MinResumeDurationSeconds = 0
    await api('/System/Configuration', {
      method: 'POST',
      headers,
      body: JSON.stringify(config),
    })
    await exec('docker', [
      'exec',
      name,
      'mkdir',
      '-p',
      '/media/Signal Test (2026)',
    ])
    await writeInContainer(
      name,
      '/tmp/chapters',
      ';FFMETADATA1\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=60000\ntitle=Ouverture\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=60000\nEND=180000\ntitle=Deuxième acte\n',
    )
    await writeInContainer(
      name,
      '/media/Signal Test (2026)/Signal Test (2026).fr.srt',
      '1\n00:00:00,000 --> 00:02:59,000\nHollyFilms — sous-titres de test\n\n2\n00:00:01,000 --> 00:00:02,000\nHollyFilms — cue courte\n',
    )
    await writeInContainer(
      name,
      '/media/Signal Test (2026)/Signal Test (2026).en.ass',
      [
        '[Script Info]',
        'ScriptType: v4.00+',
        'PlayResX: 640',
        'PlayResY: 360',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        'Style: Default,Arial,32,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,20,1',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Dialogue: 0,0:00:00.00,0:02:59.00,Default,,0,0,0,,ASS subtitle fixture',
        '',
      ].join('\n'),
    )
    await exec('docker', [
      'exec',
      name,
      '/usr/lib/jellyfin-ffmpeg/ffmpeg',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=640x360:rate=24:duration=180',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=180',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=880:duration=180',
      '-f',
      'ffmetadata',
      '-i',
      '/tmp/chapters',
      '-map',
      '0:v',
      '-map',
      '1:a',
      '-map',
      '2:a',
      '-map_metadata',
      '3',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '36',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '64k',
      '-metadata:s:a:0',
      'language=fra',
      '-metadata:s:a:1',
      'language=eng',
      '-movflags',
      '+faststart',
      '/media/Signal Test (2026)/Signal Test (2026).mp4',
    ])
    await exec('docker', [
      'exec',
      name,
      '/usr/lib/jellyfin-ffmpeg/ffmpeg',
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      '1',
      '-i',
      '/media/Signal Test (2026)/Signal Test (2026).mp4',
      '-frames:v',
      '1',
      '/media/Signal Test (2026)/backdrop.jpg',
    ])
    await api(
      '/Library/VirtualFolders?name=Player%20Test&collectionType=movies&refreshLibrary=true',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          LibraryOptions: {
            PathInfos: [{ Path: '/media' }],
            EnableRealtimeMonitor: false,
            EnableTrickplayImageExtraction: true,
            ExtractTrickplayImagesDuringLibraryScan: true,
          },
        }),
      },
    )
    const item = await until(async () => {
      const result = await (
        await api(
          `/Items?userId=${auth.User.Id}&recursive=true&includeItemTypes=Movie`,
          { headers },
        )
      ).json()
      return result.Items[0]
    }, 'media scan')
    await until(async () => {
      const details = await (
        await api(`/Users/${auth.User.Id}/Items/${item.Id}`, { headers })
      ).json()
      return Object.keys(details.Trickplay ?? {}).length > 0
    }, 'generated trickplay frames')
    const httpPort = await port()
    const origin = `http://127.0.0.1:${httpPort}`
    const vite = spawn(
      process.execPath,
      [
        path.join(
          path.dirname(require.resolve('vite/package.json')),
          'bin/vite.js',
        ),
        ...(process.env.HOLLYFILMS_PLAYER_PREVIEW === '1' ? ['preview'] : []),
        '--port',
        String(httpPort),
        '--host',
        '127.0.0.1',
        '--strictPort',
      ],
      {
        cwd: workspace,
        windowsHide: true,
        stdio: 'ignore',
        env: { ...process.env, JELLYFIN_URL: backend },
      },
    )
    t.after(() => vite.kill())
    await until(async () => (await fetch(origin + '/app')).ok, 'Vite')
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
      headless: true,
      args: ['--disable-gpu'],
    })
    t.after(() => browser.close())
    const page = await browser.newPage({
      locale: 'fr-FR',
      viewport: { width: 1440, height: 900 },
    })
    await page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (
          this instanceof HTMLVideoElement &&
          sessionStorage.getItem('blockAutoplayOnce')
        ) {
          sessionStorage.removeItem('blockAutoplayOnce')
          this.autoplay = false
          return Promise.reject(
            new DOMException('Autoplay blocked by test', 'NotAllowedError'),
          )
        }
        return play.call(this)
      }
    })
    const errors = []
    let stage = 'initial playback'
    const reports = []
    page.on('pageerror', (error) => errors.push({ stage, stack: error.stack }))
    page.on('console', (message) => {
      if (message.text().startsWith('ASS subtitle renderer:'))
        errors.push({ stage, stack: message.text() })
      if (
        message.type() === 'error' &&
        message.text().startsWith('HLS Error:') &&
        /internalException|Fatal: true/.test(message.text())
      ) {
        errors.push({ stage, stack: message.text() })
      }
    })
    page.on('request', (request) => {
      if (
        request.url().includes('/Sessions/Playing') &&
        request.method() === 'POST'
      )
        reports.push({
          path: new URL(request.url()).pathname,
          data: request.postDataJSON(),
        })
    })
    await page.goto(origin)
    await page.evaluate(
      (accessToken) =>
        sessionStorage.setItem(
          'hollyfilms.jellyfin.session',
          JSON.stringify({ accessToken, deviceId: 'player-e2e' }),
        ),
      auth.AccessToken,
    )
    await page.goto(origin + '/app')
    const playbackInfo = '**/jellyfin/Items/*/PlaybackInfo*'
    const releasePlayback = Promise.withResolvers()
    let playbackRequested = false
    let negotiationReleasedAt = 0
    await page.route(
      playbackInfo,
      async (route) => {
        playbackRequested = true
        await releasePlayback.promise
        await route.continue()
      },
      { times: 1 },
    )
    await until(
      () =>
        page
          .locator('.home-hero-media img')
          .first()
          .evaluate((image) => image.complete && image.naturalWidth > 0),
      'source artwork decoded before opening the player',
    )
    await page.getByRole('button', { name: 'Lire', exact: true }).click()
    await page
      .locator('[data-artwork-destination="player"]')
      .waitFor({ timeout: 1500 })
    const playerView = page.locator('.player-shell')
    try {
      await until(async () => playbackRequested, 'playback negotiation', 30_000)
      assert.equal(
        await page.locator('.player-viewport').getAttribute('data-state'),
        'loading',
      )
      assert.equal(
        await page.locator('.player-status').count(),
        0,
        'no opening splash',
      )
      assert.equal(await playerView.locator('iframe').count(), 0)
      const preparation = playerView.getByRole('progressbar', {
        name: 'Préparation de la lecture',
      })
      await preparation.waitFor()
      assert.equal(await preparation.getAttribute('aria-valuenow'), '25')
      assert.equal(await playerView.locator('.player-spinner').count(), 0)
      await until(
        () =>
          playerView
            .locator('.player-artwork-hero img')
            .evaluate((image) => image.complete && image.naturalWidth > 0),
        'artwork visible while negotiation is pending',
        10000,
      )
    } finally {
      negotiationReleasedAt = performance.now()
      releasePlayback.resolve()
    }
    await page
      .locator('.player-viewport[data-state="playing"]')
      .waitFor({ timeout: 30_000 })
    await playerView
      .getByRole('progressbar', { name: 'Préparation de la lecture' })
      .waitFor({ state: 'detached', timeout: 2000 })
    t.diagnostic(
      'Direct playback after releasing the negotiation request: ' +
        Math.round(performance.now() - negotiationReleasedAt) +
        ' ms on the local fixture.',
    )
    assert.equal(new URL(page.url()).pathname, '/app')
    assert.equal(new URL(page.url()).searchParams.get('play'), item.Id)
    const playbackHistoryLength = await page.evaluate(() => history.length)
    await until(
      () =>
        playerView
          .locator('video')
          .evaluate(
            (video) => video.currentTime > 0.5 && video.readyState >= 3,
          ),
      'decoded video',
    )
    await playerView
      .locator('.player-artwork-hero')
      .waitFor({ state: 'detached' })
    await page.locator('[data-artwork-flight]').waitFor({ state: 'detached' })
    const heading = playerView.locator('.player-heading')
    assert(await heading.getByText('HollyFilms', { exact: true }).isVisible())
    await page.mouse.move(700, 450)
    await page.waitForFunction(
      () =>
        ['.player-heading', '.player-controls-layer'].every((selector) => {
          const overlay = document.querySelector(selector)
          return overlay?.inert && getComputedStyle(overlay).opacity === '0'
        }),
      undefined,
      { timeout: 8000 },
    )
    await page.mouse.move(710, 450)
    await playerView.locator('.player-heading[data-visible="true"]').waitFor()
    const timeline = playerView.getByRole('slider', {
      name: 'Position de lecture',
    })
    await timeline.hover({ position: { x: 90, y: 12 } })
    const previewImage = playerView.getByRole('img', {
      name: 'Aperçu de la position de lecture',
    })
    await until(
      () =>
        previewImage.evaluate(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      'decoded timeline preview',
    )
    assert((await previewImage.getAttribute('src')).startsWith('blob:'))
    await page.mouse.move(700, 700)
    await playerView
      .getByRole('button', { name: 'Plein écran', exact: true })
      .click()
    await page.waitForFunction(() =>
      document.fullscreenElement?.classList.contains('player-viewport'),
    )
    const leaveFullscreen = playerView.getByRole('button', {
      name: 'Quitter le plein écran',
      exact: true,
    })
    // Clicking dismisses a tooltip until the pointer leaves its trigger.
    await page.mouse.move(700, 400)
    await leaveFullscreen.hover()
    await playerView
      .getByRole('tooltip', { name: 'Quitter le plein écran' })
      .waitFor()
    assert(
      await page
        .locator('.player-viewport:fullscreen [role="tooltip"]')
        .count(),
      'tooltip is inside the fullscreen surface',
    )
    await leaveFullscreen.click()
    await page.waitForFunction(() => !document.fullscreenElement)
    await playerView.getByRole('button', { name: 'Pause', exact: true }).click()
    assert(await playerView.locator('video').evaluate((video) => video.paused))
    // The animated volume meter preserves native range keys and actual video volume.
    const volume = playerView.getByRole('slider', {
      name: 'Volume',
      exact: true,
    })
    await volume.focus()
    await page.keyboard.press('Home')
    await until(
      () => playerView.locator('video').evaluate((video) => video.volume === 0),
      'keyboard volume minimum',
    )
    await until(
      async () => (await volume.getAttribute('aria-valuetext')) === '0 %',
      'keyboard volume minimum committed',
    )
    await page.keyboard.press('ArrowRight')
    await until(
      () =>
        playerView
          .locator('video')
          .evaluate((video) => Math.abs(video.volume - 0.01) < 0.001),
      'keyboard volume step',
    )
    // The media element updates before React commits the accessible label.
    await until(
      async () => (await volume.getAttribute('aria-valuetext')) === '1 %',
      'keyboard volume accessible value',
    )
    await page.keyboard.press('End')
    await until(
      () => playerView.locator('video').evaluate((video) => video.volume === 1),
      'keyboard volume maximum',
    )
    assert.equal(
      await page.locator('.catalogue-backdrop canvas').count(),
      0,
      'decorative shader is unmounted during playback',
    )
    // Hold media acknowledgements: the timeline must respond before loading
    // finishes, and rapid steps must accumulate from the requested position.
    stage = 'optimistic timeline while media events are delayed'
    await playerView.locator('video').evaluate((video) => {
      const events = ['timeupdate', 'seeking', 'seeked', 'progress']
      const hold = (event) => event.stopImmediatePropagation()
      for (const event of events) video.addEventListener(event, hold, true)
      window.releaseTimelineEvents = () => {
        for (const event of events) video.removeEventListener(event, hold, true)
        video.dispatchEvent(new Event('seeked'))
      }
    })
    try {
      await timeline.focus()
      await page.keyboard.press('Home')
      await until(
        async () => (await timeline.inputValue()) === '0',
        'immediate seek to start',
        2000,
      )
      await playerView
        .getByRole('button', { name: 'Avancer de 30 secondes' })
        .click()
      await until(
        async () => Number(await timeline.inputValue()) === 30,
        'first immediate skip',
        2000,
      )
      await playerView
        .getByRole('button', { name: 'Avancer de 30 secondes' })
        .click()
      await until(
        async () => Number(await timeline.inputValue()) === 60,
        'accumulated skip',
        2000,
      )
      await playerView
        .getByRole('button', { name: 'Reculer de 10 secondes' })
        .click()
      await until(
        async () => Number(await timeline.inputValue()) === 50,
        'immediate backward skip',
        2000,
      )
      const bounds = await timeline.boundingBox()
      await timeline.click({
        position: { x: bounds.width * 0.7, y: bounds.height / 2 },
      })
      await until(
        async () => {
          const selected = Number(await timeline.inputValue())
          const duration = Number(await timeline.getAttribute('max'))
          return Math.abs(selected / duration - 0.7) < 0.02
        },
        'immediate pointer seek',
        2000,
      )
      await until(
        () =>
          playerView.locator('.player-elapsed').evaluate((bar) => {
            const progress = new DOMMatrixReadOnly(
              getComputedStyle(bar).transform,
            ).a
            return progress > 0.68 && progress < 0.72
          }),
        'animated progress settles before media acknowledgement',
        2000,
      )
    } finally {
      await page.evaluate(() => {
        window.releaseTimelineEvents()
        delete window.releaseTimelineEvents
      })
    }
    // Verify a seek through the player's keyboard shortcuts.
    await playerView.locator('video').focus()
    await page.keyboard.press('l')
    await until(
      () =>
        playerView.locator('video').evaluate((video) => video.currentTime > 20),
      'keyboard seek',
    )
    const decoded = await playerView.locator('video').evaluate((video) => {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 18
      const context = canvas.getContext('2d')
      context.drawImage(video, 0, 0, 32, 18)
      const pixels = context.getImageData(0, 0, 32, 18).data
      return {
        width: video.videoWidth,
        colored: pixels.some((byte, index) => index % 4 !== 3 && byte > 40),
      }
    })
    assert(
      decoded.width > 0 && decoded.colored,
      'the visible video contains decoded image pixels',
    )
    stage = 'audio and subtitle changes'
    const options = () =>
      playerView.getByRole('region', { name: 'Options du lecteur' })
    await playerView
      .getByRole('button', { name: 'Paramètres de lecture' })
      .click()
    await options()
      .getByRole('button', { name: 'Chapitres', exact: true })
      .click()
    await options()
      .getByRole('button', { name: /Deuxième acte/ })
      .click()
    await until(
      () =>
        playerView
          .locator('video')
          .evaluate((video) => video.currentTime >= 59),
      'chapter seek',
    )
    await playerView
      .getByRole('button', { name: 'Paramètres de lecture' })
      .click()
    const audio = options().getByLabel('Audio', { exact: true })
    await audio.click()
    await page.getByRole('option').nth(1).click()
    await page.locator('.player-viewport[data-state="ready"]').waitFor()
    await options()
      .getByRole('button', { name: 'Sous-titres', exact: true })
      .click()
    const language = options().getByLabel('Langue', { exact: true })
    await language.click()
    await page
      .getByRole('option')
      .filter({ hasText: /French|Français|SRT/i })
      .first()
      .click()
    await until(
      async () =>
        (
          await playerView
            .locator('.player-captions')
            .textContent({ timeout: 1500 })
        ).includes('HollyFilms'),
      'rendered subtitle',
    )
    await until(
      () =>
        playerView.evaluate((root) => {
          const caption = root.querySelector('.player-captions')
          const controls = root.querySelector('.player-controls')
          return (
            caption &&
            controls &&
            caption.getBoundingClientRect().bottom <
              controls.getBoundingClientRect().top - 8
          )
        }),
      'text subtitles clear the visible playback controls',
    )
    assert(
      await language.locator('img').count(),
      'subtitle select includes a flag',
    )
    const originalCue = await playerView
      .locator('video track')
      .evaluate((track) => {
        window.subtitleOffsetTrack = track
        return track.track.cues[0].startTime
      })
    await options()
      .getByRole('button', { name: /Régler le décalage/ })
      .click()
    const offsetPanel = playerView.getByRole('region', {
      name: 'Décalage des sous-titres',
    })
    const offsetSlider = offsetPanel.getByRole('slider')
    await offsetPanel
      .getByRole('button', { name: 'Retarder de 0,1 seconde' })
      .click()
    await until(
      () =>
        playerView
          .locator('video track')
          .evaluate(
            (track, start) =>
              track === window.subtitleOffsetTrack &&
              Math.abs(track.track.cues[0].startTime - start - 0.1) < 0.001,
            originalCue,
          ),
      'live subtitle offset without reload',
    )
    await offsetSlider.focus()
    await page.keyboard.press('Home')
    await until(
      () =>
        playerView
          .locator('video track')
          .evaluate(
            (track) =>
              track.track.cues.length === 1 &&
              track.track.cues[0].endTime === 59,
          ),
      'negative offset removes expired cues',
    )
    await offsetPanel
      .getByRole('button', { name: 'Réinitialiser le décalage' })
      .click()
    await until(
      () =>
        playerView
          .locator('video track')
          .evaluate(
            (track, start) =>
              track === window.subtitleOffsetTrack &&
              track.track.cues.length === 2 &&
              track.track.cues[0].startTime === start,
            originalCue,
          ),
      'reset restores cues without reload or drift',
    )
    await page.keyboard.press('Escape')
    await offsetPanel.waitFor({ state: 'detached' })
    assert(
      await playerView.isVisible(),
      'Escape closes offset panel, not playback',
    )
    await playerView
      .getByRole('button', { name: 'Sous-titres', exact: true })
      .click()
    await language.click()
    await page
      .getByRole('option')
      .filter({ hasText: /English|Anglais|ASS/i })
      .first()
      .click()
    try {
      await until(
        async () =>
          page
            .workers()
            .some(
              (worker) =>
                /jassub|worker[.-]/i.test(worker.url()) &&
                !worker.url().includes('hls.worker'),
            ),
        'ASS worker',
        10000,
      )
    } catch {
      assert.fail(
        'ASS worker unavailable. ' +
          (await options().innerText()) +
          ' ' +
          JSON.stringify(errors),
      )
    }
    await until(
      async () => (await playerView.locator('canvas').count()) > 0,
      'ASS overlay',
    )
    await until(
      () =>
        playerView.evaluate((root) => {
          const canvas = root.querySelector('.player-subtitle-canvas')
          const controls = root.querySelector('.player-controls')
          return (
            canvas &&
            controls &&
            canvas.getBoundingClientRect().height > 0 &&
            canvas.getBoundingClientRect().bottom <
              controls.getBoundingClientRect().top - 8
          )
        }),
      'ASS subtitle plane clears controls without clipping top captions',
    )
    await language.click()
    await page
      .getByRole('option')
      .filter({ hasText: /French|Français|SRT/i })
      .first()
      .click()
    await options().getByRole('button', { name: 'Fermer les options' }).click()
    stage = 'HLS quality change'
    await playerView
      .getByRole('button', { name: 'Paramètres de lecture' })
      .click()
    await options().getByLabel('Qualité').click()
    await page.locator('[role="option"][data-value="420000"]').click()
    await page.locator('.player-viewport[data-state="ready"]').waitFor()
    await until(
      () =>
        playerView
          .locator('video')
          .evaluate(
            (video) =>
              video.readyState >= 2 && video.currentSrc.includes('blob:'),
          ),
      'HLS transcode',
    )
    await page.mouse.move(700, 650)
    await mkdir(path.join(root, '.playwright-mcp'), { recursive: true })
    await page.screenshot({
      path: path.join(root, '.playwright-mcp/player-verified.png'),
    })
    const persistedToken = await page.evaluate(
      (token) =>
        Object.values(localStorage).some((value) => value.includes(token)),
      auth.AccessToken,
    )
    assert.equal(persistedToken, false)
    stage = 'closing playback'
    const releaseStop = Promise.withResolvers()
    await page.route(
      '**/jellyfin/Sessions/Playing/Stopped',
      async (route) => {
        await releaseStop.promise
        await route.continue()
      },
      { times: 1 },
    )
    await page.getByRole('button', { name: 'Retour au catalogue' }).click()
    try {
      await page
        .locator('.player-shell')
        .waitFor({ state: 'detached', timeout: 1000 })
    } finally {
      releaseStop.resolve()
    }
    await until(async () => {
      const saved = await (
        await api(`/Users/${auth.User.Id}/Items/${item.Id}`, { headers })
      ).json()
      return saved.UserData.PlaybackPositionTicks > 200_000_000
    }, 'background progress saving')
    assert(
      reports.some(
        (report) =>
          report.path.endsWith('/Stopped') &&
          report.data.PositionTicks > 200_000_000,
      ),
      'stop report contains the seek position',
    )
    const saved = await (
      await api(`/Users/${auth.User.Id}/Items/${item.Id}`, { headers })
    ).json()
    assert(
      saved.UserData.PlaybackPositionTicks > 200_000_000,
      'Jellyfin persisted progress',
    )
    stage = 'resume after reload'
    await page.reload()
    // Negotiate a real HLS stream on startup, as happens with an unsupported
    // source codec, instead of testing HLS only through a quality change.
    await page.route(
      playbackInfo,
      (route) => {
        const body = route.request().postDataJSON()
        return route.continue({
          postData: {
            ...body,
            EnableDirectPlay: false,
            EnableDirectStream: false,
          },
        })
      },
      { times: 1 },
    )
    await page.evaluate(() =>
      sessionStorage.setItem('blockAutoplayOnce', 'true'),
    )
    await page.getByRole('button', { name: 'Reprendre', exact: true }).click()
    await page.locator('.player-viewport[data-state="ready"]').waitFor()
    const video = playerView.locator('video')
    assert(await video.evaluate((element) => element.paused))
    await playerView
      .getByRole('button', { name: 'Démarrer la lecture' })
      .click()
    await page.locator('.player-viewport[data-state="playing"]').waitFor()
    await until(
      () =>
        playerView
          .locator('video')
          .evaluate(
            (video) =>
              video.currentSrc.startsWith('blob:') &&
              video.currentTime > 20 &&
              !video.paused,
          ),
      'HLS resume after reload',
    )
    assert(page.workers().some((worker) => worker.url().includes('hls.worker')))
    stage = 'restoring active playback from the URL'
    await video.evaluate((element) => element.pause())
    await until(
      async () => new URL(page.url()).searchParams.get('paused') === '1',
      'pause reflected in URL',
    )
    const savedTime = Number(new URL(page.url()).searchParams.get('t'))
    assert(savedTime > 20, 'the URL contains the current playback position')
    const historyBeforeReload = await page.evaluate(() => history.length)
    assert.equal(
      historyBeforeReload,
      playbackHistoryLength + 2,
      'only close and reopen add history entries, never playback progress',
    )
    await page.reload()
    await page.locator('.player-viewport[data-state="ready"]').waitFor()
    assert(
      await playerView.locator('video').evaluate((element) => element.paused),
      'reload preserves pause',
    )
    await until(
      async () =>
        Math.abs(
          Number(
            await playerView
              .getByRole('slider', { name: 'Position de lecture' })
              .inputValue(),
          ) - savedTime,
        ) < 2,
      'reload restores the saved timestamp',
    )
    assert.equal(await page.evaluate(() => history.length), historyBeforeReload)
    await page.goBack()
    await page.locator('.player-shell').waitFor({ state: 'detached' })
    await page.goForward()
    await page.locator('.player-viewport[data-state="ready"]').waitFor()
    assert.equal(new URL(page.url()).searchParams.get('play'), item.Id)
    stage = 'closing playback'
    await page.getByRole('button', { name: 'Retour au catalogue' }).click()
    await page.locator('.player-shell').waitFor({ state: 'detached' })
    assert.notEqual(
      await page.evaluate(() => getComputedStyle(document.body).overflowY),
      'hidden',
      'homepage scrolling is restored after player return',
    )
    stage = 'episode queue'
    await exec('docker', [
      'exec',
      name,
      'mkdir',
      '-p',
      '/shows/Orbit Test/Season 01',
    ])
    for (const episode of ['01', '02']) {
      await exec('docker', [
        'exec',
        name,
        'cp',
        '/media/Signal Test (2026)/Signal Test (2026).mp4',
        `/shows/Orbit Test/Season 01/Orbit Test S01E${episode}.mp4`,
      ])
    }
    await api(
      '/Library/VirtualFolders?name=Series%20Test&collectionType=tvshows&refreshLibrary=true',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          LibraryOptions: {
            PathInfos: [{ Path: '/shows' }],
            EnableRealtimeMonitor: false,
          },
        }),
      },
    )
    await until(async () => {
      const result = await (
        await api(
          `/Items?userId=${auth.User.Id}&recursive=true&includeItemTypes=Episode`,
          { headers },
        )
      ).json()
      return result.Items.length === 2
    }, 'episode scan')
    await page.reload()
    await page.getByRole('button', { name: 'Séries', exact: true }).click()
    await page
      .getByRole('button', { name: /Voir la fiche de Orbit Test/ })
      .click()
    const seriesId = new URL(page.url()).searchParams.get('media')
    assert(seriesId)
    await page.reload()
    await page.getByRole('button', { name: 'Fermer la fiche' }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/app/series')
    assert.equal(new URL(page.url()).searchParams.get('media'), seriesId)
    await page.getByRole('button', { name: 'Lire la série' }).click()
    await until(
      () =>
        playerView.locator('video').evaluate((video) => video.readyState >= 3),
      'first episode',
    )
    const startsBefore = reports.filter((report) =>
      report.path.endsWith('/Playing'),
    ).length
    await page.mouse.move(700, 650)
    await playerView
      .getByRole('button', { name: 'Suivant', exact: true })
      .click()
    await until(
      async () =>
        reports.filter((report) => report.path.endsWith('/Playing')).length >
        startsBefore,
      'next episode',
    )
    assert.equal(
      await page.locator('.player-shell').count(),
      1,
      'queue transitions must not close the player',
    )
    await until(
      () =>
        playerView.locator('video').evaluate((video) => video.readyState >= 3),
      'second episode',
    )
    assert.notEqual(
      new URL(page.url()).searchParams.get('play'),
      seriesId,
      'URL follows the actual episode, not its parent series',
    )
    await page.getByRole('button', { name: 'Retour au catalogue' }).click()
    await page.locator('.player-shell').waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Fermer la fiche' }).click()
    stage = 'backend failure and retry'
    await page.locator('.media-dialog').waitFor({ state: 'detached' })
    assert.notEqual(
      await page.evaluate(() => getComputedStyle(document.body).overflowY),
      'hidden',
      'returning through media details releases the final scroll lock',
    )
    await page.route(
      playbackInfo,
      (route) => route.fulfill({ status: 503, body: '' }),
      { times: 1 },
    )
    await page
      .getByRole('button', { name: /Voir la fiche de Orbit Test/ })
      .click()
    await page.getByRole('button', { name: 'Lire la série' }).click()
    await page.getByRole('alert').waitFor()
    await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
    await until(
      () =>
        playerView.locator('video').evaluate((video) => video.readyState >= 3),
      'retry',
    )
    await page.getByRole('button', { name: 'Retour au catalogue' }).click()
    await page.locator('.player-shell').waitFor({ state: 'detached' })
    stage = 'remote playback'
    await page.getByRole('button', { name: 'Fermer la fiche' }).click()
    const secondDevice = 'player-receiver'
    const receiverAuthorization = authorization.replace(
      'player-e2e',
      secondDevice,
    )
    const receiverAuth = await (
      await api('/Users/AuthenticateByName', {
        method: 'POST',
        headers: { ...json, Authorization: receiverAuthorization },
        body: JSON.stringify({ Username: 'PlayerTest', Pw: password }),
      })
    ).json()
    const receiver = await browser.newPage({
      reducedMotion: 'reduce',
      locale: 'fr-FR',
    })
    receiver.on('pageerror', (error) =>
      errors.push({ stage, stack: error.stack }),
    )
    await receiver.goto(origin)
    await receiver.evaluate(
      (session) =>
        sessionStorage.setItem(
          'hollyfilms.jellyfin.session',
          JSON.stringify(session),
        ),
      {
        accessToken: receiverAuth.AccessToken,
        deviceId: secondDevice,
      },
    )
    await receiver.goto(origin + '/app')
    await until(async () => {
      const sessions = await (await api('/Sessions', { headers })).json()
      return sessions.some(
        (device) =>
          device.DeviceId === secondDevice && device.SupportsMediaControl,
      )
    }, 'receiver registered')
    async function openMovie(client) {
      const closeDetails = client.getByRole('button', {
        name: 'Fermer la fiche',
      })
      if (await closeDetails.isVisible()) await closeDetails.click()
      await client.getByRole('button', { name: 'Films', exact: true }).click()
      await client
        .getByRole('button', { name: /Voir la fiche de Signal Test/ })
        .click()
      await client
        .locator('.media-dialog')
        .getByRole('button', { name: /^(Lire|Reprendre)$/ })
        .click()
      await client
        .locator(
          '.player-viewport[data-state="playing"], .player-viewport[data-state="ready"], .player-viewport[data-state="error"]',
        )
        .waitFor({ timeout: 20000 })
      const start = client.getByRole('button', { name: 'Démarrer la lecture' })
      if (await start.isVisible()) await start.click()
      await client
        .locator('.player-viewport[data-state="playing"]')
        .waitFor({ timeout: 15000 })
    }
    await openMovie(page)
    await page.mouse.move(710, 650)
    await playerView
      .getByRole('button', { name: 'Paramètres de lecture' })
      .click()
    await playerView
      .locator('.player-heading')
      .getByRole('button', { name: 'Chromecast et appareils' })
      .click()
    await options().locator('button.player-menu-list').first().click()
    await receiver
      .locator('.player-viewport[data-state="playing"]')
      .waitFor({ timeout: 20000 })
    await playerView.getByRole('button', { name: 'Pause', exact: true }).click()
    await until(
      () => receiver.locator('video').evaluate((element) => element.paused),
      'remote pause',
    )
    await options().getByRole('button', { name: 'Reprendre ici' }).click()
    await receiver.locator('.player-shell').waitFor({ state: 'detached' })
    await page
      .locator('.player-viewport[data-state="playing"]')
      .waitFor({ timeout: 20000 })

    stage = 'SyncPlay'
    await openMovie(receiver)
    async function openSync(client) {
      await client.mouse.move(600, 500)
      await client
        .getByRole('button', { name: 'Paramètres de lecture' })
        .click()
      await client
        .locator('.player-heading')
        .getByRole('button', { name: 'SyncPlay', exact: true })
        .click()
    }
    await openSync(page)
    await options().getByLabel('Nom du groupe').fill('Séance test')
    await options().getByRole('button', { name: 'Créer un groupe' }).click()
    await options().getByRole('button', { name: 'Quitter le groupe' }).waitFor()
    await openSync(receiver)
    await receiver
      .getByRole('button', { name: 'Séance test', exact: true })
      .click()
    await receiver.getByRole('button', { name: 'Quitter le groupe' }).waitFor()
    await options().getByRole('button', { name: 'Fermer les options' }).click()
    await playerView.locator('video').focus()
    await page.keyboard.press('l')
    await until(
      async () => {
        const a = await page
          .locator('video')
          .evaluate((element) => element.currentTime)
        const b = await receiver
          .locator('video')
          .evaluate((element) => element.currentTime)
        return a > 20 && Math.abs(a - b) < 2
      },
      'synchronized seek on both devices',
      15000,
    )
    await receiver.getByRole('button', { name: 'Retour au catalogue' }).click()
    await receiver.locator('.player-shell').waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Retour au catalogue' }).click()
    await page.locator('.player-shell').waitFor({ state: 'detached' })
    stage = 'library destinations'
    await api(`/UserFavoriteItems/${item.Id}?userId=${auth.User.Id}`, {
      method: 'POST',
      headers,
    })
    await page.goto(origin + '/app/favorites')
    const favoriteCard = page.getByRole('article', {
      name: item.Name,
      exact: true,
    })
    await favoriteCard.hover()
    await favoriteCard
      .getByRole('button', { name: 'Retirer des favoris' })
      .click()
    await favoriteCard.waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Films', exact: true }).click()
    await page.getByRole('combobox', { name: 'Trier les titres' }).click()
    await page.getByRole('option', { name: 'Titre A–Z' }).click()
    await page.reload()
    assert.equal(new URL(page.url()).pathname, '/app/movies')
    assert.equal(
      await page
        .getByRole('combobox', { name: 'Trier les titres' })
        .innerText(),
      'Titre A–Z',
    )
    const created = await (
      await api(
        '/Collections?' +
          new URLSearchParams({ name: 'Collection Test', ids: item.Id }),
        { method: 'POST', headers },
      )
    ).json()
    assert(created.Id)
    await api(`/Collections/${created.Id}/Items?ids=${item.Id}`, {
      method: 'POST',
      headers,
    })
    const collectionItems = await (
      await api(
        '/Items?' +
          new URLSearchParams({
            parentId: created.Id,
            userId: auth.User.Id,
            recursive: 'true',
            includeItemTypes: 'Movie,Series',
          }),
        { headers },
      )
    ).json()
    assert(
      collectionItems.Items.some((entry) => entry.Id === item.Id),
      'the test collection contains its movie: ' +
        JSON.stringify(collectionItems),
    )
    await page.getByRole('button', { name: 'Collections', exact: true }).click()
    await page.getByRole('button', { name: /Collection Test/ }).click()
    await page.getByRole('heading', { name: 'Collection Test.' }).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('collection'), created.Id)
    await page.reload()
    await page
      .getByRole('button', { name: /Voir la fiche de Signal Test/ })
      .waitFor({ timeout: 10000 })
      .catch(async (error) => {
        t.diagnostic(
          'Collection page: ' + (await page.locator('body').innerText()),
        )
        throw error
      })
    await page.getByRole('button', { name: 'Toutes les collections' }).click()
    await page.getByRole('heading', { name: 'Les collections.' }).waitFor()
    await page.goBack()
    await page.getByRole('heading', { name: 'Collection Test.' }).waitFor()
    await page.getByRole('button', { name: 'Accueil', exact: true }).click()
    await page.getByRole('region', { name: 'À l’affiche' }).waitFor()
    assert.deepEqual(errors, [])
    t.diagnostic(
      'Verified on Jellyfin 12.4: decoded video, audio, SRT, HLS, resume, episode queue, retry, remote playback, SyncPlay, favorites, sorting and collection URL restoration.',
    )
  },
)
