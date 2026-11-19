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
import { createApp } from '../../api/src/app.ts'

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
      '1\n00:00:00,000 --> 00:01:10,000\nHollyFilms — sous-titres de test\nDeuxième ligne\n\n2\n00:01:20,000 --> 00:02:59,000\nHollyFilms — sous-titres de test\n',
    )
    await writeInContainer(
      name,
      '/media/Signal Test (2026)/Signal Test (2026).zh.srt',
      '1\n00:00:00,000 --> 00:02:59,000\nHollyFilms — 中文字幕测试\n',
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
    const databaseUrl = process.env.HOLLYFILMS_TEST_DATABASE_URL
    assert.ok(
      databaseUrl,
      'Run yarn test:player with its isolated PostgreSQL container',
    )
    const accountApi = await createApp({
      databaseUrl,
      jellyfinUrl: backend,
      jellyfinApiKey: auth.AccessToken,
      publicOrigin: origin,
    })
    const apiOrigin = await accountApi.listen({ port: 0, host: '127.0.0.1' })
    t.after(() => accountApi.close())
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
        env: {
          ...process.env,
          JELLYFIN_URL: backend,
          HOLLYFILMS_API_URL: apiOrigin,
        },
      },
    )
    t.after(() => vite.kill())
    await until(async () => (await fetch(origin + '/app')).ok, 'Vite')
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
      headless: true,
      // Drive the real Media Session handlers below without unrelated commands
      // from the host's hardware or other media applications.
      args: ['--disable-gpu', '--disable-features=HardwareMediaKeyHandling'],
    })
    t.after(() => browser.close())
    const page = await browser.newPage({
      locale: 'fr-FR',
      viewport: { width: 1440, height: 900 },
    })
    await page.addInitScript(() => {
      const mediaActions = new Map()
      window.testMediaActions = mediaActions
      const mediaSession = navigator.mediaSession
      const register = mediaSession.setActionHandler.bind(mediaSession)
      mediaSession.setActionHandler = (action, handler) => {
        register(action, handler)
        if (handler) mediaActions.set(action, handler)
        else mediaActions.delete(action)
      }
      if (new URLSearchParams(location.search).has('play')) {
        const visibleSurfaces = new Set()
        window.testPlayerRestoreSurfaces = visibleSurfaces
        const sampleFrame = () => {
          for (const selector of [
            '.home-page',
            '.home-topbar',
            '.home-intro',
            '.media-dialog',
            '.showcase-nav',
          ]) {
            if (
              document.querySelector(selector)?.checkVisibility({
                opacityProperty: true,
                visibilityProperty: true,
              })
            )
              visibleSurfaces.add(selector)
          }
          const video = document.querySelector('.player-shell video')
          if (
            (!video || video.readyState < 2) &&
            new URLSearchParams(location.search).has('play')
          )
            requestAnimationFrame(sampleFrame)
        }
        requestAnimationFrame(sampleFrame)
      }
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
    page.on('pageerror', (error) =>
      errors.push({ stage, stack: error.stack || error.message }),
    )
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
    // Provider transport is simulated; installation and track refresh use this
    // disposable Jellyfin's real files/metadata and the real HTML video element.

    await page.route('**/api/media/*/subtitles', async (route) => {
      const id = new URL(route.request().url()).pathname.split('/')[3]
      const data = await (
        await api(`/Items/${id}?userId=${auth.User.Id}`, { headers })
      ).json()
      const sources = data.MediaSources?.length
        ? data.MediaSources
        : [{ Id: data.Id, Name: data.Name, MediaStreams: data.MediaStreams }]
      await route.fulfill({
        json: {
          administrator: true,
          languages: [
            { code: 'fra', iso2: 'fr', name: 'French' },
            { code: 'deu', iso2: 'de', name: 'German' },
            { code: 'zho', iso2: 'zh', name: 'Chinese' },
          ],
          versions: sources.map((source) => ({
            id: source.Id,
            name: source.Name || data.Name,
            tracks: (source.MediaStreams ?? [])
              .filter((track) => track.Type === 'Subtitle')
              .map((track) => ({
                index: track.Index,
                title: track.DisplayTitle || track.Language,
                language: track.Language,
                codec: track.Codec,
                external: !!track.IsExternal,
              })),
          })),
          requests: [],
        },
      })
    })
    await page.route('**/api/admin/media/*/subtitles/search?*', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'fixture_german',
              name: 'German test release',
              provider: 'Simulated subtitle provider',
              language: 'deu',
              format: 'srt',
              hashMatch: true,
              forced: false,
              hearingImpaired: false,
              machineTranslated: false,
            },
          ],
        },
      }),
    )
    await page.route(
      '**/api/admin/media/*/subtitles/download',
      async (route) => {
        await writeInContainer(
          name,
          '/media/Signal Test (2026)/Signal Test (2026).de.srt',
          '1\n00:00:00,000 --> 00:02:59,000\nHollyFilms — neu geladene Untertitel\n',
        )
        await api(
          `/Items/${item.Id}/Refresh?metadataRefreshMode=FullRefresh&imageRefreshMode=None`,
          { method: 'POST', headers },
        )
        await until(async () => {
          const data = await (
            await api(`/Items/${item.Id}?userId=${auth.User.Id}`, { headers })
          ).json()
          return data.MediaSources?.some((source) =>
            source.MediaStreams?.some(
              (track) =>
                track.Type === 'Subtitle' &&
                /deu|ger/.test(track.Language ?? ''),
            ),
          )
        }, 'downloaded subtitle indexed by Jellyfin')
        await route.fulfill({
          json: {
            id: 'fixture-operation',
            itemId: item.Id,
            sourceId: item.Id,
            itemName: item.Name,
            sourceName: item.Name,
            language: 'deu',
            status: 'DOWNLOADED',
            createdAt: new Date().toISOString(),
          },
        })
      },
    )
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
    const video = playerView.locator('video')
    async function expectContinuousPlayback(description) {
      const start = await video.evaluate((element) => element.currentTime)
      await until(
        () =>
          video.evaluate(
            (element, from) =>
              !element.paused && element.currentTime > from + 2,
            start,
          ),
        description,
        8000,
      )
    }
    const mediaCommands = (actions) =>
      video.evaluate(
        (element, commands) =>
          commands.map((action) => {
            const handler = window.testMediaActions.get(action)
            if (!handler)
              throw new Error('No Media Session handler for ' + action)
            handler({ action })
            return element.paused
          }),
        actions,
      )
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
      await playerView
        .getByText('Préparation de la lecture…', { exact: true })
        .first()
        .waitFor()
      assert.equal(await playerView.getByRole('progressbar').count(), 0)
      // Deliver decoded media normally while withholding individual startup
      // notifications from the player.
      await video.evaluate((element) => {
        for (const type of ['loadedmetadata', 'playing'])
          element.addEventListener(
            type,
            (event) => event.stopImmediatePropagation(),
            {
              capture: true,
              once: true,
            },
          )
      })
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
      .locator('.player-loading')
      .waitFor({ state: 'detached', timeout: 1000 })
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
    await expectContinuousPlayback('video advances without the playing event')
    // Reproduce the first keystroke after launching a film. No player control
    // has been clicked or focused since the viewer pressed Lire.
    await page.keyboard.press('Space')
    assert.equal(
      new URL(page.url()).searchParams.get('play'),
      item.Id,
      'Space at launch must keep the movie open',
    )
    assert(await video.evaluate((element) => element.paused), 'Space pauses')
    const mutedAtLaunch = await video.evaluate((element) => element.muted)
    await page.keyboard.press('m')
    assert.equal(
      await video.evaluate((element) => element.muted),
      !mutedAtLaunch,
    )
    await page.keyboard.press('m')
    await page.keyboard.press('Space')
    await expectContinuousPlayback(
      'Space resumes from the initial player focus',
    )
    assert.equal(
      reports.filter((report) => report.path.endsWith('/Playing')).length,
      1,
      'the stream reports its start once',
    )
    await playerView
      .locator('.player-artwork-hero')
      .waitFor({ state: 'detached' })
    // Hold only the observations exposed by Chrome during a buffer gap. Let
    // the decoder run underneath so releasing the clock gives real progress.
    await video.evaluate((element) => {
      const position = element.currentTime
      Object.defineProperties(element, {
        currentTime: { configurable: true, get: () => position },
        readyState: {
          configurable: true,
          get: () => HTMLMediaElement.HAVE_CURRENT_DATA,
        },
      })
      element.dispatchEvent(new Event('waiting'))
    })
    try {
      await playerView
        .locator('.player-loading[data-operation="buffering"]')
        .waitFor({ timeout: 2500 })
      assert.equal(
        await playerView.locator('.player-artwork-hero').count(),
        0,
        'the decoded picture stays on screen during buffering',
      )
    } finally {
      await video.evaluate((element) => {
        delete element.currentTime
        delete element.readyState
        element.dispatchEvent(new Event('timeupdate'))
      })
    }
    await playerView
      .locator('.player-loading')
      .waitFor({ state: 'detached', timeout: 1000 })
    await page.locator('[data-artwork-flight]').waitFor({ state: 'detached' })
    const heading = playerView.locator('.player-heading')
    assert(await heading.getByText('HollyFilms', { exact: true }).isVisible())
    await playerView
      .getByRole('button', { name: /^(Couper|Rétablir) le son$/ })
      .click()
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
    await page.keyboard.press('Space')
    assert(
      await video.evaluate((element) => element.paused),
      'Space still pauses after the clicked volume control becomes inert',
    )
    await page.keyboard.press('m')
    await page.keyboard.press('Space')
    await expectContinuousPlayback('Space resumes after controls auto-hide')
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
    if (
      await video.evaluate(
        (element) =>
          document.pictureInPictureEnabled &&
          typeof element.requestPictureInPicture === 'function',
      )
    ) {
      await playerView
        .getByRole('button', { name: 'Incrustation vidéo' })
        .click()
      await page.waitForFunction(
        () =>
          document.pictureInPictureElement ===
          document.querySelector('.player-shell video'),
        undefined,
        { timeout: 5000 },
      )
      const leavePip = playerView.getByRole('button', {
        name: 'Quitter l’incrustation',
      })
      assert.equal(await leavePip.getAttribute('aria-pressed'), 'true')
      await leavePip.click()
      await page.waitForFunction(() => !document.pictureInPictureElement)
      t.diagnostic(
        'Native picture-in-picture entered and exited from the player controls.',
      )
    } else {
      t.diagnostic('Native picture-in-picture was unavailable in this browser.')
    }
    assert.deepEqual(
      await mediaCommands(['pause', 'pause', 'play', 'play']),
      [true, true, false, false],
      'consecutive explicit Media Session commands are idempotent even before React renders',
    )
    await playerView.getByRole('button', { name: 'Pause', exact: true }).click()
    assert(await playerView.locator('video').evaluate((video) => video.paused))
    assert.deepEqual(
      await mediaCommands(['play']),
      [false],
      'system play still resumes',
    )
    await playerView.getByRole('button', { name: 'Pause', exact: true }).click()
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
      const seekStatus = playerView.locator('.player-seek-status')
      await seekStatus
        .filter({ hasText: 'Recherche à 1:00…' })
        .waitFor({ timeout: 2000 })
      await playerView
        .getByRole('button', { name: 'Reculer de 10 secondes' })
        .click()
      await until(
        async () => Number(await timeline.inputValue()) === 50,
        'immediate backward skip',
        2000,
      )
      await seekStatus
        .filter({ hasText: 'Recherche à 0:50…' })
        .waitFor({ timeout: 2000 })
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
    assert.equal(
      await playerView
        .locator('video')
        .evaluate((video) => getComputedStyle(video).outlineStyle),
      'none',
      'focusing the video does not outline the player',
    )
    assert.equal(
      await playerView.evaluate(
        (dialog) => getComputedStyle(dialog).outlineStyle,
      ),
      'none',
      'the fullscreen dialog has no focus outline',
    )
    await page.keyboard.press('l')
    await playerView.locator('.player-stage[data-response="seek"]').waitFor()
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
    await options().evaluate((panel) => {
      window.testSettingsPanel = panel
    })
    await options()
      .getByRole('button', { name: 'Chapitres', exact: true })
      .click()
    assert(
      await options().evaluate((panel) => panel === window.testSettingsPanel),
      'the anchored panel retains its surface when changing to chapters',
    )
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
    await page
      .locator('.holly-select-popup[data-open]')
      .getByRole('option')
      .nth(1)
      .click()
    await page.locator('.player-viewport[data-state="ready"]').waitFor()
    await options()
      .getByRole('button', { name: 'Sous-titres', exact: true })
      .click()
    const language = options().getByLabel('Langue', { exact: true })
    const selectTrack = async (field, name) => {
      await field.click()
      await page
        .locator('.holly-select-popup[data-open]')
        .getByRole('option')
        .filter({ hasText: name })
        .click()
    }
    const frenchTrack = /French|Français/i
    const chineseTrack = /Chinese|Chinois|中文/i
    await selectTrack(language, frenchTrack)
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
    stage = 'bilingual subtitles'
    const secondLanguage = options().getByRole('combobox', {
      name: 'Deuxième piste',
      exact: true,
    })
    const selectSecondLanguage = (name) => selectTrack(secondLanguage, name)
    const primarySync = options().getByRole('button', {
      name: 'Corriger la synchronisation Piste principale',
      exact: true,
    })
    const secondarySync = options().getByRole('button', {
      name: 'Corriger la synchronisation Deuxième piste',
      exact: true,
    })
    const offsetPanel = playerView.getByRole('region', {
      name: 'Corriger la synchronisation',
    })
    assert(await primarySync.isVisible())
    assert.equal(await secondarySync.count(), 0)
    await selectSecondLanguage(chineseTrack)
    await until(
      async () =>
        (
          await playerView
            .locator('[data-subtitle-slot="secondary"]')
            .textContent()
        ).includes('中文字幕测试'),
      'Chinese secondary subtitles appear alongside French',
    )
    assert(
      (
        await playerView.locator('[data-subtitle-slot="primary"]').textContent()
      ).includes('sous-titres de test'),
      'French primary subtitles remain visible',
    )
    await until(
      () =>
        page.evaluate(() =>
          /^\d+$/.test(new URLSearchParams(location.search).get('sub2') ?? ''),
        ),
      'the second track is saved in the URL',
    )
    stage = 'independent subtitle timing and appearance'
    const mainCue = playerView.locator('p[data-subtitle-slot="primary"]')
    const secondCue = playerView.locator('p[data-subtitle-slot="secondary"]')
    const movie = playerView.locator('video')
    const resumeTime = await movie.evaluate((video) => {
      video.pause()
      return video.currentTime
    })
    const gapTime = await movie.evaluate((video) => {
      const french = Array.from(video.textTracks).find((track) =>
        Array.from(track.cues ?? []).some((cue) =>
          cue.text.includes('Deuxième ligne'),
        ),
      )
      if (!french || french.cues.length !== 2)
        throw Error('Expected two timed French cues')
      return (french.cues[0].endTime + french.cues[1].startTime) / 2
    })
    await secondCue.evaluate(async (cue) => {
      await Promise.all(
        cue.parentElement
          .getAnimations()
          .map((animation) => animation.finished),
      )
    })
    const secondBaseline = await secondCue.evaluate(
      (cue) => cue.getBoundingClientRect().bottom,
    )
    const gap =
      (await mainCue.evaluate((cue) => cue.getBoundingClientRect().top)) -
      secondBaseline
    assert.ok(
      gap >= 0 && gap <= 8,
      `The two text tracks should read as a pair (gap ${gap}px)`,
    )
    for (const [time, expected] of [
      [gapTime + 10, 'sous-titres de test'],
      [gapTime, null],
      [resumeTime, 'sous-titres de test'],
    ]) {
      await movie.evaluate((video, t) => {
        video.currentTime = t
      }, time)
      if (expected) await mainCue.filter({ hasText: expected }).waitFor()
      else await mainCue.waitFor({ state: 'detached' })
      const baseline = await secondCue.evaluate(
        (cue) => cue.getBoundingClientRect().bottom,
      )
      assert.ok(
        Math.abs(baseline - secondBaseline) < 1,
        `Chinese baseline at ${time}s: expected ${secondBaseline}, got ${baseline}`,
      )
    }
    const appearance = options().getByRole('button', {
      name: 'Apparence des sous-titres',
    })
    await appearance.click()
    await options()
      .getByRole('button', { name: 'Secondaire', exact: true })
      .click()
    await options().getByRole('button', { name: 'Jaune', exact: true }).click()
    const fontSlider = options().getByRole('slider', { name: 'Taille' })
    await fontSlider.press('ArrowRight')
    await fontSlider.press('ArrowRight')
    const readCaptionStyle = (el) => ({
      color: getComputedStyle(el).color,
      size: parseFloat(getComputedStyle(el).fontSize),
    })
    const chosenStyle = await secondCue.evaluate(readCaptionStyle)
    const mainStyle = await mainCue.evaluate(readCaptionStyle)
    assert.equal(chosenStyle.color, 'rgb(255, 224, 102)')
    assert.equal(mainStyle.color, 'rgb(255, 255, 255)')
    assert.ok(Math.abs(chosenStyle.size / mainStyle.size - 1.2) < 0.01)
    await appearance.click()
    stage = 'download subtitles without restarting playback'
    const beforeInstall = await playerView
      .locator('video')
      .evaluate((video) => {
        window.subtitleInstallVideo = video
        return {
          src: video.currentSrc,
          time: video.currentTime,
          paused: video.paused,
        }
      })
    const startsBeforeInstall = reports.filter((report) =>
      /\/Sessions\/Playing$/.test(report.path),
    ).length
    const externalTools = options().getByRole('button', {
      name: 'Sous-titres externes Rechercher ou demander des sous-titres',
    })
    assert.equal(await externalTools.getAttribute('aria-expanded'), 'false')
    assert.equal(await options().locator('.subtitle-panel').count(), 0)
    assert.ok(
      await options()
        .getByRole('combobox', { name: 'Langue', exact: true })
        .isVisible(),
    )
    assert.ok(
      await options()
        .getByRole('combobox', { name: 'Deuxième piste', exact: true })
        .isVisible(),
    )
    await externalTools.click()
    assert.equal(await externalTools.getAttribute('aria-expanded'), 'true')
    const externalPanel = options().getByRole('region', {
      name: 'Sous-titres externes',
    })
    const languageField = externalPanel.getByRole('combobox', {
      name: 'Langue des sous-titres',
    })
    await languageField.waitFor()
    assert.ok(
      await languageField.evaluate((field) => {
        const control = field.closest('.holly-select-native') ?? field
        return (
          Math.abs(
            control.getBoundingClientRect().width -
              field.closest('label').getBoundingClientRect().width,
          ) < 2
        )
      }),
      'external subtitle language uses all available field width in the player',
    )
    await languageField.click()
    await page
      .locator('.holly-select-popup[data-open]')
      .getByRole('option')
      .filter({ hasText: /allemand|German/i })
      .click()
    await externalPanel
      .getByRole('button', { name: 'Rechercher des sous-titres' })
      .click()
    // Folding retains the chosen language and results without restarting a search.
    await externalTools.click()
    assert.equal(await externalTools.getAttribute('aria-expanded'), 'false')
    await externalTools.click()
    assert.match(
      await externalPanel
        .getByRole('combobox', { name: 'Langue des sous-titres' })
        .innerText(),
      /allemand|German/i,
    )
    await externalPanel
      .getByRole('button', { name: 'Télécharger ce sous-titre' })
      .click()
    // The native confirmation owns keyboard input; player shortcuts stay idle.
    const beforeConfirmationKeys = await playerView
      .locator('video')
      .evaluate((video) => ({ time: video.currentTime, muted: video.muted }))
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('m')
    const afterConfirmationKeys = await playerView
      .locator('video')
      .evaluate((video) => ({ time: video.currentTime, muted: video.muted }))
    assert.deepEqual(afterConfirmationKeys, beforeConfirmationKeys)
    await externalPanel
      .getByRole('button', { name: 'Confirmer le téléchargement' })
      .click()
    await externalPanel
      .getByText('Sous-titre installé', { exact: true })
      .waitFor()
    await externalPanel
      .getByRole('dialog')
      .getByRole('button', { name: 'Fermer', exact: true })
      .click()
    await externalPanel.getByRole('dialog').waitFor({ state: 'detached' })
    await until(
      async () =>
        (
          await playerView
            .locator('[data-subtitle-slot="primary"]')
            .textContent()
        ).includes('sous-titres de test') &&
        (
          await playerView
            .locator('[data-subtitle-slot="secondary"]')
            .textContent()
        ).includes('中文字幕测试'),
      'both selected languages survive the live track refresh',
      10000,
    ).catch(async (error) => {
      console.log(
        'Live subtitle refresh diagnostic:',
        JSON.stringify(
          await playerView.evaluate((root) => ({
            primary: root.querySelector('[data-subtitle-slot="primary"]')
              ?.textContent,
            secondary: root.querySelector('[data-subtitle-slot="secondary"]')
              ?.textContent,
            captionTracks: Array.from(root.querySelectorAll('video track')).map(
              (t) => ({
                language: t.srclang,
                path: new URL(t.src).pathname,
                state: t.readyState,
              }),
            ),
            selectors: Array.from(
              root.querySelectorAll('.holly-select-trigger'),
            ).map((e) => ({
              label: e.getAttribute('aria-label'),
              text: e.textContent,
            })),
            alerts: Array.from(root.querySelectorAll('[role=alert]')).map(
              (e) => e.textContent,
            ),
          })),
        ),
      )
      throw error
    })
    const afterInstall = await playerView
      .locator('video')
      .evaluate((video) => ({
        sameElement: window.subtitleInstallVideo === video,
        src: video.currentSrc,
        time: video.currentTime,
        paused: video.paused,
      }))
    assert.equal(afterInstall.sameElement, true)
    assert.equal(afterInstall.src, beforeInstall.src)
    assert.equal(afterInstall.paused, beforeInstall.paused)
    assert.ok(afterInstall.time >= beforeInstall.time - 0.25)
    assert.equal(
      reports.filter((report) => /\/Sessions\/Playing$/.test(report.path))
        .length,
      startsBeforeInstall,
      'no new playback negotiation/session is needed',
    )
    await options().getByLabel('Langue', { exact: true }).click()
    await page
      .locator('.holly-select-popup[data-open]')
      .getByRole('option')
      .filter({ hasText: /German|allemand/i })
      .waitFor()
    await page.keyboard.press('Escape')
    await page.reload()
    await until(
      async () =>
        (
          await playerView
            .locator('[data-subtitle-slot="secondary"]')
            .textContent()
        ).includes('中文字幕测试') &&
        (
          await playerView
            .locator('[data-subtitle-slot="primary"]')
            .textContent()
        ).includes('sous-titres de test'),
      'both languages restore after reloading',
    )
    await playerView
      .getByRole('button', { name: 'Sous-titres', exact: true })
      .click()
    assert.deepEqual(
      await secondCue.evaluate(readCaptionStyle),
      chosenStyle,
      'secondary appearance survives a reload',
    )
    assert.deepEqual(await mainCue.evaluate(readCaptionStyle), mainStyle)
    const chineseIndex = new URL(page.url()).searchParams.get('sub2')
    assert.match(chineseIndex ?? '', /^\d+$/)
    await secondarySync.click()
    await offsetPanel.getByText(chineseTrack).waitFor()
    await page.keyboard.press('Escape')
    await offsetPanel.waitFor({ state: 'detached' })
    await playerView
      .getByRole('button', { name: 'Sous-titres', exact: true })
      .click()
    await appearance.click()
    const secondaryStyle = options().getByRole('button', {
      name: 'Secondaire',
      exact: true,
    })
    await secondaryStyle.click()
    await selectSecondLanguage(/^Désactivée$/)
    await until(
      async () =>
        (await playerView
          .locator('[data-subtitle-slot="secondary"]')
          .count()) === 0,
      'disabling the second track removes its captions',
    )
    assert.equal(await secondaryStyle.count(), 0)
    assert.equal(await secondarySync.count(), 0)
    assert.equal(
      await options()
        .getByRole('button', { name: 'Blanc', exact: true })
        .getAttribute('aria-pressed'),
      'true',
    )
    await appearance.click()
    await selectSecondLanguage(chineseTrack)
    await secondarySync.waitFor()
    await selectTrack(language, /^Désactivés$/)
    await secondLanguage.waitFor({ state: 'detached' })
    assert.equal(await appearance.count(), 0)
    assert.equal(await primarySync.count(), 0)
    assert.equal(await secondarySync.count(), 0)
    await page.waitForURL(
      (url) =>
        url.searchParams.get('sub2') === '-1' &&
        url.searchParams.get('sub') === '-1',
    )
    // Older links could combine a disabled primary with a valid secondary.
    const staleLink = new URL(page.url())
    staleLink.searchParams.set('sub2', chineseIndex)
    await Promise.all([
      page.waitForEvent('domcontentloaded'),
      page.evaluate((url) => location.replace(url), staleLink.href),
    ])
    await playerView
      .getByRole('button', { name: 'Sous-titres', exact: true })
      .click()
    await language.waitFor()
    assert.equal(await secondLanguage.count(), 0)
    await selectTrack(language, frenchTrack)
    await secondLanguage.waitFor()
    assert.match(await secondLanguage.textContent(), /Désactivée/)
    assert.equal(await secondarySync.count(), 0)
    assert.equal(await secondCue.count(), 0)
    await until(
      () =>
        playerView
          .locator('video track')
          .evaluate((track) => Boolean(track.track.cues?.length)),
      'primary subtitle cue after toggling bilingual captions',
    )
    const originalCue = await playerView
      .locator('video track')
      .evaluate((track) => {
        window.subtitleOffsetTrack = track
        return track.track.cues[0].startTime
      })
    const syncLaunch = () => primarySync.click()
    await syncLaunch()
    const cueTime = async () =>
      playerView
        .locator('video track')
        .evaluate((track) =>
          track === window.subtitleOffsetTrack
            ? track.track.cues[0].startTime
            : null,
        )
    await offsetPanel
      .getByRole('button', { name: 'Recaler sur une réplique' })
      .click()
    assert.equal(await movie.evaluate((v) => v.paused), true)
    await offsetPanel.getByRole('searchbox').fill('Deuxième')
    await offsetPanel.getByRole('button', { name: /Deuxième ligne/ }).click()
    const capture = offsetPanel.getByRole('button', {
      name: 'C’est maintenant',
    })
    assert.equal(await capture.isEnabled(), false)
    await offsetPanel
      .getByRole('button', { name: 'Écouter le passage' })
      .click()
    await until(() => capture.isEnabled(), 'armed after real playback resumes')
    await capture.press('Enter')
    await offsetPanel
      .getByRole('button', { name: 'Rejouer pour vérifier' })
      .waitFor()
    await offsetPanel.getByRole('button', { name: 'Recommencer' }).click()
    await offsetPanel
      .getByRole('button', { name: 'Retour', exact: true })
      .click()
    await offsetPanel
      .getByRole('button', { name: 'Trop tôt', exact: true })
      .click()
    await until(
      async () => Math.abs((await cueTime()) - originalCue - 0.2) < 0.001,
      'live preview on the original track',
    )
    await offsetPanel
      .getByRole('button', { name: 'C’est bon', exact: true })
      .click()
    await offsetPanel.getByText('Réglage mémorisé pour ce film').waitFor()
    await offsetPanel.getByRole('button', { name: 'Fermer' }).first().click()
    await playerView
      .getByRole('button', { name: 'Sous-titres', exact: true })
      .click()
    await syncLaunch()
    await offsetPanel.getByText('Réglage précis', { exact: true }).click()
    await offsetPanel
      .getByRole('button', { name: 'Réinitialiser', exact: true })
      .click()
    await until(
      async () => Math.abs((await cueTime()) - originalCue) < 0.001,
      'reset previews original cues',
    )
    await page.keyboard.press('Escape')
    await offsetPanel.waitFor({ state: 'detached' })
    await until(
      async () => Math.abs((await cueTime()) - originalCue - 0.2) < 0.001,
      'cancel restores the committed correction',
    )
    assert(
      await playerView.isVisible(),
      'Escape closes sync without closing playback',
    )
    await page.reload()
    await playerView
      .getByRole('button', { name: 'Sous-titres', exact: true })
      .click()
    await syncLaunch()
    await offsetPanel.getByText('Affichage 0,2 s plus tard').waitFor()
    await page.keyboard.press('Escape')
    await playerView
      .getByRole('button', { name: 'Sous-titres', exact: true })
      .click()
    await language.click()
    await page
      .locator('.holly-select-popup[data-open]')
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
    await selectSecondLanguage(/French|Français/i)
    await until(
      async () =>
        (await playerView.locator('.player-captions').textContent()).includes(
          'ASS subtitle fixture',
        ) &&
        (await playerView.locator('.player-captions').textContent()).includes(
          'sous-titres de test',
        ),
      'ASS and SRT subtitles render together without overlapping canvases',
    )
    assert.equal(await playerView.locator('.player-subtitle-canvas').count(), 0)
    await selectSecondLanguage(/^Désactivée$/)
    await language.click()
    await page
      .locator('.holly-select-popup[data-open]')
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
    const tokenStorageKeys = await page.evaluate(
      (token) =>
        Object.keys(localStorage).filter((key) =>
          localStorage.getItem(key)?.includes(token),
        ),
      auth.AccessToken,
    )
    assert.deepEqual(tokenStorageKeys, ['hollyfilms.jellyfin.session'])
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
    assert(await video.evaluate((element) => element.paused))
    await playerView
      .getByRole('button', { name: 'Démarrer la lecture' })
      .waitFor()
    await page.keyboard.press('Space')
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
    const metadataGate = Promise.withResolvers()
    const restoredStreamGate = Promise.withResolvers()
    await page.route(
      playbackInfo,
      async (route) => {
        await restoredStreamGate.promise
        await route.continue()
      },
      { times: 1 },
    )
    let restoringMetadata = false
    await page.route(
      (url) => url.pathname.endsWith('/Items/' + item.Id),
      async (route) => {
        restoringMetadata = true
        await metadataGate.promise
        await route.continue()
      },
      { times: 1 },
    )
    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await until(
        async () => restoringMetadata,
        'deep link requested item details',
        8000,
      )
      await page.locator('.playback-route-status').waitFor()
      assert.deepEqual(
        await page.locator('.playback-route-status').boundingBox(),
        { x: 0, y: 0, ...page.viewportSize() },
      )
      assert.equal(
        await page.locator('.home-topbar, .home-intro, .media-dialog').count(),
        0,
      )
      await page
        .locator('.playback-route-status')
        .getByRole('button', { name: 'Détails', exact: true })
        .waitFor()
      metadataGate.resolve()
      await playerView.waitFor()
      // Pause before the source is attached. A newly mounted media element is
      // already paused, although the viewer's current intent is autoplay.
      await page.keyboard.press('Space')
      // The route has already spent four seconds opening this title.
      const details = playerView.getByRole('button', {
        name: 'Détails',
        exact: true,
      })
      await details.waitFor({ timeout: 1000 })
      await details.focus()
      await page.keyboard.press('Enter')
      assert.equal(await details.getAttribute('aria-expanded'), 'true')
    } finally {
      metadataGate.resolve()
      restoredStreamGate.resolve()
    }
    await page
      .locator('.player-viewport[data-state="ready"]')
      .waitFor({ timeout: 10_000 })
    assert(
      await video.evaluate(
        (element) => element.paused && element.readyState > 0,
      ),
      'the initial Space persists through stream negotiation',
    )
    await playerView.locator('.player-loading').waitFor({ state: 'detached' })
    assert(
      await video.evaluate((element) => document.activeElement === element),
      'focus returns to the player when playback dismisses Details',
    )
    await page.keyboard.press('Space')
    await page.locator('.player-viewport[data-state="playing"]').waitFor()
    await expectContinuousPlayback('video keeps advancing after reload')
    assert.deepEqual(
      await page.evaluate(() => [...window.testPlayerRestoreSurfaces]),
      [],
      'no catalogue, navigation or media detail appeared during player restoration',
    )
    assert.deepEqual(await mediaCommands(['pause']), [true])
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
    const back = playerView.getByRole('button', { name: 'Retour au catalogue' })
    await back.focus()
    const mutedBeforeBack = await video.evaluate((element) => element.muted)
    await page.keyboard.press('m')
    assert.equal(
      await video.evaluate((element) => element.muted),
      !mutedBeforeBack,
      'the mute shortcut also works from the player header',
    )
    await page.keyboard.press('Enter')
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
      errors.push({ stage, stack: error.stack || error.message }),
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
    // The dialog closes immediately, but Jellyfin may still be writing user
    // data from these two sessions. Seed the favorite after both writes finish.
    for (const client of [receiver, page]) {
      const [stopped] = await Promise.all([
        client.waitForResponse('**/jellyfin/Sessions/Playing/Stopped'),
        client.getByRole('button', { name: 'Retour au catalogue' }).click(),
      ])
      assert.ok(stopped.ok())
      await client.locator('.player-shell').waitFor({ state: 'detached' })
    }
    stage = 'library destinations'
    await api(`/UserFavoriteItems/${item.Id}?userId=${auth.User.Id}`, {
      method: 'POST',
      headers,
    })
    await page.goto(origin + '/app/favorites')
    // The grid renders a lightweight button until the poster enters view.
    const favoriteDetails = page.getByRole('button', {
      name: /Voir la fiche de Signal Test/,
    })
    await favoriteDetails.scrollIntoViewIfNeeded().catch(async (error) => {
      t.diagnostic(
        'Favorites page: ' + (await page.locator('body').innerText()),
      )
      throw error
    })
    const favoriteCard = page
      .getByRole('article')
      .filter({ has: favoriteDetails })
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
    // This fixture creates its collection directly through Jellyfin. Load a
    // fresh catalogue so a previously cached empty collection list can expire.
    await page.reload()
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
    stage = 'slow startup with measurable progress'
    const mediaRequest = (url) =>
      /\/Videos\/[^/]+\/(stream\.[^/]+|[^/]+\.m3u8)$/i.test(url.pathname)
    const waitForStream = () =>
      page.waitForRequest((request) => mediaRequest(new URL(request.url())), {
        timeout: 15_000,
      })
    const playbackKey = 'hollyfilms.playback.' + auth.User.Id
    await page.evaluate((key) => localStorage.removeItem(key), playbackKey)
    // The first audio track can play directly; start at a known position so
    // recovery requests can be checked against Jellyfin's actual input.
    const recoveryUrl = origin + '/app?play=' + item.Id + '&audio=1&sub=-1&t=42'
    const allowData = Promise.withResolvers()
    await page.route(
      mediaRequest,
      async (route) => {
        await allowData.promise
        await route.continue()
      },
      { times: 1 },
    )
    await page.clock.install()
    try {
      await Promise.all([
        waitForStream(),
        page.goto(recoveryUrl, { waitUntil: 'domcontentloaded' }),
      ])
      // Separate real data arrival and the browser's play acknowledgement.
      await video.evaluate((element) => {
        const play = element.play.bind(element)
        const gate = Promise.withResolvers()
        window.allowVideoPlay = () => gate.resolve()
        element.play = async () => {
          await gate.promise
          return play()
        }
      })
      await page.clock.fastForward(20_000)
      allowData.resolve()
      await until(
        () => video.evaluate((element) => element.readyState >= 2),
        'decoded data after a slow start',
      )
      await page.clock.fastForward(13_000)
      assert.equal(
        await playerView.locator('.player-viewport').getAttribute('data-state'),
        'loading',
        'new playable data buys time while Chrome prepares to play',
      )
      await page.evaluate(() => window.allowVideoPlay())
      await playerView
        .locator('.player-viewport[data-state="playing"]')
        .waitFor()
      await playerView.locator('.player-loading').waitFor({ state: 'detached' })
    } finally {
      allowData.resolve()
    }
    stage = 'stalled startup and recovery'
    const releaseStream = Promise.withResolvers()
    let holdStream = true
    await page.route(mediaRequest, async (route) => {
      if (!holdStream) return route.continue()
      await releaseStream.promise
      await route.abort()
    })
    try {
      await Promise.all([
        waitForStream(),
        page.goto(recoveryUrl, { waitUntil: 'domcontentloaded' }),
      ])
      await page.clock.fastForward(20_000)
      await video.evaluate((element) =>
        element.dispatchEvent(new Event('progress')),
      )
      await page.clock.fastForward(11_000)
      await playerView
        .getByRole('alert')
        .getByText('Le serveur met trop de temps à fournir la vidéo.')
        .waitFor()
      const [retry] = await Promise.all([
        page.waitForRequest(playbackInfo),
        waitForStream(),
        playerView
          .getByRole('button', { name: 'Réessayer', exact: true })
          .click(),
      ])
      const retryOptions = retry.postDataJSON()
      assert.equal(retryOptions.StartTimeTicks, 420_000_000)
      assert.equal(retryOptions.AudioStreamIndex, 1)
      assert.equal(retryOptions.SubtitleStreamIndex, -1)
      await page.clock.fastForward(8_100)
      const lower = playerView.getByRole('button', {
        name: /Réduire la qualité/,
      })
      await lower.waitFor()
      const offeredRate =
        Number(
          (await lower.innerText()).match(/[\d.,]+/)[0].replace(',', '.'),
        ) * 1_000_000
      holdStream = false
      const [replacement] = await Promise.all([
        page.waitForRequest(playbackInfo),
        lower.click(),
      ])
      const nextOptions = replacement.postDataJSON()
      assert.equal(nextOptions.MaxStreamingBitrate, offeredRate)
      assert.equal(nextOptions.StartTimeTicks, retryOptions.StartTimeTicks)
      assert.equal(nextOptions.AudioStreamIndex, retryOptions.AudioStreamIndex)
      assert.equal(
        nextOptions.SubtitleStreamIndex,
        retryOptions.SubtitleStreamIndex,
      )
      await playerView
        .locator('.player-viewport[data-state="playing"]')
        .waitFor()
      await until(
        () => video.evaluate((el) => el.currentTime >= 42 && !el.paused),
        'lower quality resumes at the requested scene',
      )
      assert.equal(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).bitrate,
          playbackKey,
        ),
        0,
        'lower quality recovery applies only to this viewing session',
      )
    } finally {
      releaseStream.resolve()
    }
    stage = 'audio-only playback'
    await exec('docker', ['exec', name, 'mkdir', '-p', '/music/Signal/Fixture'])
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
      'sine=frequency=440:duration=12',
      '-metadata',
      'title=Audio sample',
      '/music/Signal/Fixture/Audio sample.mp3',
    ])
    await api(
      '/Library/VirtualFolders?name=Player%20Audio&collectionType=music&refreshLibrary=true',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          LibraryOptions: {
            PathInfos: [{ Path: '/music' }],
            EnableRealtimeMonitor: false,
          },
        }),
      },
    )
    const audioItem = await until(async () => {
      const result = await (
        await api(
          `/Items?userId=${auth.User.Id}&recursive=true&includeItemTypes=Audio`,
          { headers },
        )
      ).json()
      return result.Items.find((entry) => entry.Name === 'Audio sample')
    }, 'audio fixture scan')
    await page.goto(origin + '/app?play=' + audioItem.Id)
    await playerView.locator('.player-viewport[data-state="playing"]').waitFor()
    await expectContinuousPlayback(
      'audio advances without a decoded video frame',
    )
    assert.equal(await video.evaluate((element) => element.videoWidth), 0)
    await playerView.locator('.player-artwork-hero').waitFor()
    assert.equal(await playerView.locator('.player-loading').count(), 0)
    assert.deepEqual(errors, [])
    t.diagnostic(
      'Verified on Jellyfin 12.4: decoded video, audio, SRT, HLS, resume, episode queue, retry, remote playback, SyncPlay, favorites, sorting and collection URL restoration.',
    )
  },
)
