import { useEffect, useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, waitFor } from 'storybook/test'
import { ArtworkHeroProvider } from './ArtworkHero.tsx'
import { HomeCarousel } from './HomeCarousel.tsx'
import { MediaTile } from './MediaTile.tsx'
import { MediaDetails } from './MediaDetails.tsx'
import { PlayerShell } from './PlayerShell.tsx'
import { PlaybackRouteStatus } from './PlaybackRouteStatus.tsx'
import { PlayerArtwork } from './PlayerArtwork.tsx'
import { homeItems } from '../home-fixtures.ts'
import previewVideo from '../assets/hero-preview.webm?url'

type Startup = 'normal' | 'fast' | 'paused' | 'error'

function DemoPlayer({
  startup,
  deferred,
  onClose,
}: {
  startup: Startup
  deferred: boolean
  onClose: () => void
}) {
  const [shellReady, setShellReady] = useState(!deferred)
  const [streamReady, setStreamReady] = useState(
    startup === 'fast' || startup === 'paused',
  )
  const [frame, setFrame] = useState(false)
  const [failed, setFailed] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!deferred) return
    const timer = setTimeout(() => setShellReady(true), 200)
    return () => clearTimeout(timer)
  }, [deferred])
  useEffect(() => {
    if (startup === 'fast' || startup === 'paused') return
    const timer =
      startup === 'error'
        ? setTimeout(() => setFailed(true), 160)
        : setTimeout(() => setStreamReady(true), 1500)
    return () => clearTimeout(timer)
  }, [startup])
  useEffect(() => {
    const element = video.current
    if (!streamReady || !element) return
    const presented = () => setFrame(true)
    if (typeof element.requestVideoFrameCallback === 'function') {
      const callback = element.requestVideoFrameCallback(presented)
      return () => element.cancelVideoFrameCallback(callback)
    }
    if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) presented()
    else {
      element.addEventListener('loadeddata', presented, { once: true })
      return () => element.removeEventListener('loadeddata', presented)
    }
  }, [shellReady, startup, streamReady])

  if (!shellReady) return <PlaybackRouteStatus onClose={onClose} />
  return (
    <PlayerShell
      title={homeItems[0].title}
      state={
        failed
          ? 'error'
          : frame
            ? startup === 'paused'
              ? 'ready'
              : 'playing'
            : 'loading'
      }
      interrupted={frame}
      onClose={onClose}
      onRetry={() => {
        setFailed(false)
        setStreamReady(true)
      }}
    >
      <div className="player-stage">
        <video
          ref={video}
          className="player-video"
          src={streamReady ? previewVideo : undefined}
          muted
          preload="auto"
          autoPlay={startup !== 'paused'}
          playsInline
          loop
        />
        <PlayerArtwork
          source={homeItems[0].backdrop}
          visible={!frame && !failed}
        />
      </div>
    </PlayerShell>
  )
}

function Demo({
  startup = 'normal',
  homepage = true,
  deferred = false,
}: {
  startup?: Startup
  homepage?: boolean
  deferred?: boolean
}) {
  const [details, setDetails] = useState(false)
  const [player, setPlayer] = useState(false)
  return (
    <div
      className={homepage ? 'home-page' : undefined}
      style={{ minHeight: '100vh', padding: '60px 6vw' }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>
        Une image, un mouvement continu
      </h1>
      <div
        style={{
          display: 'flex',
          gap: 32,
          alignItems: 'start',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ width: 190 }}>
          <MediaTile item={homeItems[0]} onSelect={() => setDetails(true)} />
        </div>
        <div style={{ width: 'min(460px, 100%)' }}>
          <MediaTile
            item={homeItems[0]}
            wide
            onSelect={() => setDetails(true)}
            onPlay={() => setPlayer(true)}
          />
        </div>
      </div>
      {details && (
        <MediaDetails
          item={homeItems[0]}
          onClose={() => setDetails(false)}
          onPlay={() => {
            setDetails(false)
            setPlayer(true)
          }}
        />
      )}
      {player && (
        <DemoPlayer
          startup={startup}
          deferred={deferred}
          onClose={() => setPlayer(false)}
        />
      )}
    </div>
  )
}

function DecoratedHeroDemo() {
  const [details, setDetails] = useState(false)
  return (
    <div
      className="home-page hero-treatment-demo"
      style={{ minHeight: '100vh' }}
    >
      <style>{`
        .hero-treatment-demo .hero-backdrop img {
          filter: saturate(0.4) brightness(0.72);
          object-position: 72% 35%;
        }
        .hero-treatment-demo .detail-art-reveal img {
          filter: saturate(1.25);
          object-position: 35% 65%;
        }
      `}</style>
      <HomeCarousel
        items={[homeItems[0]]}
        active={false}
        skipEntrance
        onSelect={() => setDetails(true)}
      />
      {details && (
        <MediaDetails item={homeItems[0]} onClose={() => setDetails(false)} />
      )}
    </div>
  )
}

const meta = {
  title: 'UI/Transitions des images',
  component: ArtworkHeroProvider,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof ArtworkHeroProvider>
export default meta
type Story = StoryObj<typeof meta>
const afterPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.dataset.performance === 'light'
const settledArtwork = () =>
  waitFor(() =>
    expect(document.querySelector('[data-artwork-flight]')).toBeNull(),
  )
const waitForDialogReveal = async (dialog: HTMLElement) => {
  await waitFor(() => {
    if (getComputedStyle(dialog).opacity === '0')
      throw new Error('La fiche commence son apparition')
  })
  await expect(dialog).toBeVisible()
}

async function measureFlight(
  artwork: () => Element | null,
  interact: () => Promise<void>,
) {
  const frames: DOMRect[] = []
  const sampleBounds = () => {
    const node = artwork()
    if (!node) return
    const rect = node.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    // The return frame may be larger than the picture painted inside its
    // animated inset. Read the clip in the browser on each frame.
    const clip = getComputedStyle(node).clipPath
    if (clip.startsWith('inset(')) {
      const edges = clip
        .slice(6, -1)
        .split(' round ')[0]
        .split(/\s+/)
        .map(parseFloat)
      const [top, right = top, bottom = top, left = right] = edges
      frames.push(
        new DOMRect(
          rect.left + left,
          rect.top + top,
          rect.width - left - right,
          rect.height - top - bottom,
        ),
      )
    } else {
      frames.push(rect)
    }
  }
  const sample = () => {
    sampleBounds()
    raf = requestAnimationFrame(sample)
  }
  let raf = requestAnimationFrame(sample)
  const mounted = new MutationObserver(sampleBounds)
  mounted.observe(document.body, { subtree: true, childList: true })
  try {
    await interact()
    await afterPaint()
  } finally {
    cancelAnimationFrame(raf)
    mounted.disconnect()
  }
  return frames
}

async function expectBoundedFlight(
  frames: DOMRect[],
  from: DOMRect,
  to: DOMRect,
) {
  // A single oversize frame is visible, even when both endpoints look right.
  for (const axis of ['left', 'top', 'width', 'height'] as const) {
    const sizes = frames.map((rect) => rect[axis])
    await expect(
      Math.abs(sizes[0] - from[axis]),
      `Départ du visuel (${axis})`,
    ).toBeLessThan(3)
    await expect(
      Math.max(...sizes),
      `Maximum du visuel (${axis})`,
    ).toBeLessThanOrEqual(Math.max(from[axis], to[axis]) + 2)
    await expect(
      Math.min(...sizes),
      `Minimum du visuel (${axis})`,
    ).toBeGreaterThanOrEqual(Math.min(from[axis], to[axis]) - 2)
  }
  const axis =
    Math.abs(from.width - to.width) > Math.abs(from.height - to.height)
      ? 'width'
      : 'height'
  const first = from[axis]
  const last = to[axis]
  await expect(
    frames.some((rect) => {
      const progress = (rect[axis] - first) / (last - first)
      return progress > 0.02 && progress < 0.98
    }),
  ).toBe(true)
}

export const SharedArtwork: Story = {
  name: 'De la carte à la fiche et retour',
  args: { children: <Demo /> },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('img')?.naturalWidth).toBeGreaterThan(
        0,
      ),
    )
    for (const card of canvas.getAllByRole('button', {
      name: /Voir la fiche de/,
    })) {
      const slot = card.closest<HTMLElement>('.artwork-preview')!
      const cover = card.querySelector('img')!
      const frame = slot.querySelector<HTMLElement>('.artwork-card-frame')!
      await expect(frame).toContainElement(cover)
      const resting = slot.getBoundingClientRect()
      let sourceBounds = resting
      const wide = card.closest<HTMLElement>(
        '.artwork-preview[data-wide="true"]',
      )
      let trigger = card
      if (wide && window.matchMedia('(hover: hover)').matches) {
        await userEvent.hover(wide)
        await waitFor(() => {
          const panel = wide.querySelector<HTMLElement>(
            '.artwork-preview-panel',
          )
          expect(panel?.style.getPropertyValue('--preview-progress')).toBe('1')
        })
        sourceBounds = wide
          .querySelector('.artwork-preview-hero')!
          .getBoundingClientRect()
        trigger = wide.querySelector<HTMLElement>('.artwork-preview-open')!
      }
      const art = () =>
        document.querySelector('.media-dialog[open] .media-detail-art')
      const openingFrames = await measureFlight(art, async () => {
        await userEvent.click(trigger)
        await canvas.findByRole('dialog')
        await settledArtwork()
      })
      const dialog = canvas.getByRole('dialog')
      const heroBounds = art()!.getBoundingClientRect()
      if (!reducedMotion())
        await expectBoundedFlight(openingFrames, sourceBounds, heroBounds)
      await expect(dialog).toHaveAttribute('open')
      await expect(dialog).toContainElement(frame)
      await expect(frame).toContainElement(
        dialog.querySelector('.media-detail-body'),
      )
      await expect(slot.querySelector('.artwork-card-frame')).toBeNull()
      await expect(slot.getBoundingClientRect().height).toBeCloseTo(
        resting.height,
        0,
      )
      const closingFrames = await measureFlight(
        () => slot.querySelector('.artwork-card-frame'),
        async () => {
          await userEvent.keyboard('{Escape}')
          await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
          await waitFor(() => expect(frame).not.toHaveAttribute('popover'))
          await settledArtwork()
        },
      )
      if (!reducedMotion() && typeof frame.showPopover === 'function')
        await expectBoundedFlight(closingFrames, heroBounds, resting)
      await expect(card).toHaveFocus()
      await expect(card).toHaveAttribute('aria-expanded', 'false')
      await expect(slot.querySelector('.artwork-card-frame')).toBe(frame)
      await expect(slot.querySelector('.artwork-preview-trigger img')).toBe(
        cover,
      )
      const returned = slot.getBoundingClientRect()
      await expect(returned.left).toBeCloseTo(resting.left, 0)
      await expect(returned.top).toBeCloseTo(resting.top, 0)
      await expect(returned.width).toBeCloseTo(resting.width, 0)
      await expect(returned.height).toBeCloseTo(resting.height, 0)
    }
  },
}

export const InterruptedCard: Story = {
  name: 'Fermeture pendant l’ouverture depuis la bibliothèque',
  args: { children: <Demo homepage={false} /> },
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getAllByRole('button', {
      name: /Voir la fiche de/,
    })[0]
    const slot = trigger.closest<HTMLElement>('.artwork-preview')!
    const frame = slot.querySelector<HTMLElement>('.artwork-card-frame')!
    const resting = slot.getBoundingClientRect()
    await waitFor(() =>
      expect(trigger.querySelector('img')?.naturalWidth).toBeGreaterThan(0),
    )
    await userEvent.click(trigger)
    const dialog = await canvas.findByRole('dialog')
    await expect(dialog).toContainElement(frame)
    if (!reducedMotion()) {
      // A close event queued before StrictMode reopened this same dialog must
      // leave the new animation running.
      dialog.dispatchEvent(new Event('close'))
      await expect(document.documentElement).toHaveAttribute(
        'data-artwork-destination',
        'details',
      )
      await waitFor(() =>
        expect(
          dialog.querySelector('.media-detail-art')!.getBoundingClientRect()
            .width,
        ).toBeGreaterThan(resting.width + 8),
      )
    }
    let interrupted = resting
    dialog.addEventListener(
      'keydown',
      () => {
        interrupted = dialog
          .querySelector('.media-detail-art')!
          .getBoundingClientRect()
      },
      { capture: true, once: true },
    )
    const frames = await measureFlight(
      () => slot.querySelector('.artwork-card-frame'),
      async () => {
        await userEvent.keyboard('{Escape}')
        await waitFor(() => {
          expect(canvas.queryByRole('dialog')).toBeNull()
          expect(document.querySelector('[data-artwork-flight]')).toBeNull()
          expect(frame).not.toHaveAttribute('popover')
          expect(slot.querySelector('.artwork-card-frame')).toBe(frame)
          expect(trigger).toHaveFocus()
        })
      },
    )
    if (!reducedMotion() && typeof frame.showPopover === 'function')
      await expectBoundedFlight(frames, interrupted, resting)
    await userEvent.keyboard('{Enter}')
    await expect(await canvas.findByRole('dialog')).toContainElement(frame)
  },
}

export const DelayedBackdrop: Story = {
  name: 'La fiche reste utilisable pendant le chargement du décor',
  args: { children: <Demo /> },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getAllByRole('button', {
      name: /Voir la fiche de/,
    })[0]
    await waitFor(() =>
      expect(trigger.querySelector('img')?.naturalWidth).toBeGreaterThan(0),
    )

    // Hold only this image's decode promise. Its real load and the card's
    // decode complete normally, with no dependency on network timing.
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const holdBackdrop = (event: Event) => {
      const img = event.target
      if (
        !(img instanceof HTMLImageElement) ||
        !img.closest('.media-detail-art')
      )
        return
      const decode = img.decode.bind(img)
      img.decode = () => held.then(decode)
    }
    canvasElement.addEventListener('load', holdBackdrop, true)
    try {
      await userEvent.click(trigger)
      const dialog = await canvas.findByRole('dialog')
      const art = dialog.querySelector('.media-detail-art')!
      const close = canvas.getByRole('button', { name: 'Fermer la fiche' })
      // Keep the backdrop pending beyond the opening motion and its former timeout.
      await new Promise((resolve) => setTimeout(resolve, 1100))
      await expect(art.querySelector('[data-decoded]')).toBeNull()
      await expect(document.documentElement).not.toHaveAttribute(
        'data-artwork-flight',
      )
      const bounds = art.getBoundingClientRect()
      if (!reducedMotion()) {
        const picture = art.querySelector('canvas')!
        await expect(picture).toBeVisible()
        await expect(getComputedStyle(picture).opacity).toBe('1')
        await expect(bounds.width).toBeCloseTo(dialog.clientWidth, 0)
      }
      const button = close.getBoundingClientRect()
      await expect(
        close.contains(
          document.elementFromPoint(
            button.left + button.width / 2,
            button.top + button.height / 2,
          ),
        ),
      ).toBe(true)
      await expect(close).toBeEnabled()
      release()
      await waitFor(() => {
        expect(art.querySelector('[data-decoded] img')).toBeVisible()
        expect(art.querySelector('canvas')).toBeNull()
      })
      await expect(art.getBoundingClientRect().height).toBeCloseTo(
        bounds.height,
        0,
      )
      await userEvent.click(close)
      await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
      await expect(trigger).toHaveFocus()
    } finally {
      release()
      canvasElement.removeEventListener('load', holdBackdrop, true)
    }
  },
}

export const DecoratedHero: Story = {
  name: 'Du visuel habillé à la fiche et retour',
  args: { children: <DecoratedHeroDemo /> },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Voir la fiche' })
    const source =
      canvasElement.querySelector<HTMLImageElement>('.hero-backdrop img')!
    await waitFor(() => expect(source.naturalWidth).toBeGreaterThan(0))
    await waitFor(() =>
      expect(
        canvasElement.querySelector<HTMLImageElement>('.hero-logo img')
          ?.naturalWidth,
      ).toBeGreaterThan(0),
    )
    const backdrop = source.closest('.hero-backdrop')!
    await waitFor(() => expect(getComputedStyle(backdrop).opacity).toBe('1'))
    const sourceFilter = getComputedStyle(source).filter
    const sourcePosition = getComputedStyle(source).objectPosition
    const sourceBounds = source
      .closest('.home-hero-media')!
      .getBoundingClientRect()
    const art = () =>
      document.querySelector('.media-dialog[open] .media-detail-art')
    const frames = await measureFlight(art, async () => {
      await userEvent.click(trigger)
      await canvas.findByRole('dialog')
      await settledArtwork()
    })
    const dialog = canvas.getByRole('dialog')
    if (!reducedMotion())
      await expectBoundedFlight(
        frames,
        sourceBounds,
        art()!.getBoundingClientRect(),
      )
    await waitFor(() => {
      const target = dialog.querySelector<HTMLImageElement>(
        '.detail-art-reveal img',
      )!
      expect(target.naturalWidth).toBeGreaterThan(0)
      expect(getComputedStyle(target).filter).not.toBe(sourceFilter)
      expect(getComputedStyle(target).objectPosition).not.toBe(sourcePosition)
    })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(canvas.queryByRole('dialog')).toBeNull()
      expect(document.querySelector('[data-artwork-flight]')).toBeNull()
    })
    await expect(trigger).toHaveFocus()
    await expect(
      canvas.getByRole('heading', { name: homeItems[0].title }),
    ).toBeVisible()
    await expect(getComputedStyle(source).filter).toBe(sourceFilter)
  },
}

async function expectProjection(host: string) {
  if (reducedMotion()) {
    await expect(document.querySelector('.player-projection')).toBeNull()
    await expect(document.documentElement).not.toHaveAttribute(
      'data-artwork-destination',
      'player',
    )
    return
  }
  await waitFor(() => {
    const projection = document.querySelector<HTMLElement>('.player-projection')
    expect(projection).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute(
      'data-artwork-destination',
      'player',
    )
    expect(projection!.closest(host)).not.toBeNull()
    expect(projection).toHaveAttribute('aria-hidden', 'true')
    expect(getComputedStyle(projection!).pointerEvents).toBe('none')
    expect(
      projection!.querySelector('button, [role="button"], iframe'),
    ).toBeNull()
    const picture = projection!.querySelector<HTMLCanvasElement>(
      '.player-projection-aperture canvas',
    )
    expect(picture?.width).toBeGreaterThan(0)
    expect(picture?.height).toBeGreaterThan(0)
    const pixel = picture!
      .getContext('2d')!
      .getImageData(
        Math.floor(picture!.width / 2),
        Math.floor(picture!.height / 2),
        1,
        1,
      ).data
    expect(pixel[3]).toBeGreaterThan(0)
  })
}

const firstFrame: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
}) => {
  await waitFor(() =>
    expect(
      canvasElement.querySelector<HTMLImageElement>('.media-tile-wide img')
        ?.naturalWidth,
    ).toBeGreaterThan(0),
  )
  await userEvent.click(
    canvas.getAllByRole('button', { name: /Voir la fiche de/ })[1],
  )
  await waitForDialogReveal(await canvas.findByRole('dialog'))
  await userEvent.click(canvas.getByRole('button', { name: 'Lire la série' }))
  await waitFor(
    () => {
      const viewport = canvasElement.querySelector('.player-viewport')
      expect(viewport).toHaveAttribute('data-has-frame', 'true')
      const video = viewport!.querySelector('video')!
      expect(video.videoWidth).toBeGreaterThan(0)
      expect(viewport).toHaveAttribute(
        'data-state',
        video.paused ? 'ready' : 'playing',
      )
    },
    { timeout: 5000 },
  )
  await afterPaint()
  await expect(document.querySelector('.player-projection')).toBeNull()
  await expect(
    document.querySelector('[data-artwork-destination="player"]'),
  ).toBeNull()
  await userEvent.click(
    canvas.getByRole('button', { name: 'Retour au catalogue' }),
  )
  await expect(canvas.queryByRole('dialog')).toBeNull()
}

export const FastPlayback: Story = {
  name: 'Première image immédiate',
  args: { children: <Demo startup="fast" /> },
  play: firstFrame,
}

export const PausedFirstFrame: Story = {
  name: 'Première image en pause',
  args: { children: <Demo startup="paused" /> },
  play: firstFrame,
}

export const PlayerRoundTrip: Story = {
  name: 'De la fiche au lecteur',
  args: { children: <Demo /> },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getAllByRole('button', { name: /Voir la fiche de/ })[1],
    )
    const dialog = await canvas.findByRole('dialog')
    await waitForDialogReveal(dialog)
    await waitFor(() =>
      expect(
        dialog.querySelector<HTMLImageElement>('.media-detail-art img')
          ?.naturalWidth,
      ).toBeGreaterThan(0),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Lire la série' }))
    await expectProjection('.player-stage')
    const back = canvas.getByRole('button', { name: 'Retour au catalogue' })
    const rect = back.getBoundingClientRect()
    await expect(
      back.contains(
        document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        ),
      ),
    ).toBe(true)
    await userEvent.click(back)
    await afterPaint()
    await expect(canvasElement.querySelector('.player-viewport')).toBeNull()
    await expect(document.querySelector('.player-projection')).toBeNull()
    await expect(document.querySelector('[data-artwork-flight]')).toBeNull()
  },
}

const launchCard: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
}) => {
  await waitFor(() =>
    expect(
      canvasElement.querySelector<HTMLImageElement>('.media-tile-wide img')
        ?.naturalWidth,
    ).toBeGreaterThan(0),
  )
  const card = canvas.getAllByRole('article')[1]
  await userEvent.hover(card)
  await waitFor(() => expect(card).toHaveAttribute('data-active', 'true'))
  await userEvent.click(canvas.getByRole('button', { name: /^Lire / }))
}

function largestUncoveredEdge(aperture: Element, travel: Animation) {
  const canvas = aperture.querySelector('canvas')!
  const camera = canvas.getAnimations()[0]
  const originalTravel = travel.currentTime
  const originalCamera = camera.currentTime
  const duration = Number(travel.effect!.getComputedTiming().duration)
  const edges = document.createElement('div').style
  const box = aperture.getBoundingClientRect()
  let gap = 0
  // Sample both animations on the same beat and restore them before the next paint.
  try {
    for (const fraction of [0.22, 0.54]) {
      travel.currentTime = camera.currentTime = duration * fraction
      const clip = getComputedStyle(aperture).clipPath
      if (!clip.startsWith('inset('))
        throw new Error('Expected a moving inset aperture')
      edges.inset = clip.slice(6, -1).split(' round ')[0]
      const image = canvas.getBoundingClientRect()
      gap = Math.max(
        gap,
        image.left - (box.left + parseFloat(edges.left)),
        image.top - (box.top + parseFloat(edges.top)),
        box.right - parseFloat(edges.right) - image.right,
        box.bottom - parseFloat(edges.bottom) - image.bottom,
      )
    }
  } finally {
    camera.currentTime = originalCamera
    travel.currentTime = originalTravel
  }
  return gap
}

export const HomepageToPlayer: Story = {
  name: 'De la carte au lecteur',
  args: { children: <Demo deferred /> },
  play: async (context) => {
    await launchCard(context)
    await expectProjection('.playback-route-status')
    const initial = document.querySelector('.player-projection')
    const aperture = initial?.querySelector('.player-projection-aperture')
    const travel = aperture?.getAnimations()[0]
    if (!reducedMotion()) {
      await expect(travel).toBeDefined()
      await expect(
        largestUncoveredEdge(aperture!, travel!),
      ).toBeLessThanOrEqual(1)
      const frames = (travel!.effect as KeyframeEffect).getKeyframes()
      await expect(frames[0].clipPath).not.toBe(frames.at(-1)?.clipPath)
      await expect(
        document
          .getAnimations()
          .some((animation) =>
            (
              animation.effect as KeyframeEffect | null
            )?.pseudoElement?.includes('view-transition'),
          ),
      ).toBe(false)
    }
    await context.canvas.findByRole('button', { name: 'Retour au catalogue' })
    await expectProjection('.player-stage')
    if (!reducedMotion()) {
      await expect(document.querySelector('.player-projection')).toBe(initial)
      await expect(aperture!.getAnimations()).toContain(travel)
    }
    await waitFor(
      () => expect(document.querySelector('.player-projection')).toBeNull(),
      { timeout: 2500 },
    )
    await context.userEvent.click(
      context.canvas.getByRole('button', { name: 'Retour au catalogue' }),
    )
  },
}

export const OtherOrigins: Story = {
  name: 'Depuis la bibliothèque',
  args: { children: <Demo homepage={false} /> },
  play: async (context) => {
    await launchCard(context)
    await expectProjection('.player-stage')
    await context.userEvent.click(
      context.canvas.getByRole('button', { name: 'Retour au catalogue' }),
    )
    await afterPaint()
    await expect(document.querySelector('.player-projection')).toBeNull()
  },
}

export const FailedPlayback: Story = {
  name: 'Erreur pendant l’ouverture',
  args: { children: <Demo startup="error" /> },
  play: async (context) => {
    await launchCard(context)
    await context.canvas.findByRole('alert')
    await afterPaint()
    await expect(document.querySelector('.player-projection')).toBeNull()
    const retry = context.canvas.getByRole('button', { name: 'Réessayer' })
    const errorUrl = location.href
    await context.userEvent.click(retry)
    await expect(location.href).toBe(errorUrl)
    await expect(context.canvas.queryByRole('alert')).toBeNull()
    await expect(document.querySelector('.player-projection')).toBeNull()
    await waitFor(() =>
      expect(
        context.canvasElement.querySelector('.player-viewport'),
      ).toHaveAttribute('data-state', 'playing'),
    )
  },
}
