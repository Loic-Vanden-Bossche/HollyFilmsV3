import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, waitFor } from 'storybook/test'
import { ArtworkHeroProvider } from './ArtworkHero.tsx'
import { HomeCarousel } from './HomeCarousel.tsx'
import { MediaTile } from './MediaTile.tsx'
import { MediaDetails } from './MediaDetails.tsx'
import { PlayerShell } from './PlayerShell.tsx'
import { PlayerArtwork } from './PlayerArtwork.tsx'
import { homeItems } from '../home-fixtures.ts'

function Demo({
  instant = false,
  homepage = true,
}: {
  instant?: boolean
  homepage?: boolean
}) {
  const [details, setDetails] = useState(false)
  const [player, setPlayer] = useState(false)
  const [frame, setFrame] = useState(false)
  useEffect(() => {
    if (!player || !instant) return
    const timer = setTimeout(() => setFrame(true), 80)
    return () => clearTimeout(timer)
  }, [player, instant])
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
            onPlay={() => {
              setFrame(false)
              setPlayer(true)
            }}
          />
        </div>
      </div>
      {details && (
        <MediaDetails
          item={homeItems[0]}
          onClose={() => setDetails(false)}
          onPlay={() => {
            setDetails(false)
            setFrame(false)
            setPlayer(true)
          }}
        />
      )}
      {player && (
        <PlayerShell
          title={homeItems[0].title}
          state={frame ? 'playing' : 'loading'}
          onClose={() => setPlayer(false)}
          onRetry={() => {}}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#142e3d',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            Première image vidéo simulée
          </div>
          <PlayerArtwork source={homeItems[0].backdrop} visible={!frame} />
        </PlayerShell>
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
const canShareArtwork = () =>
  typeof document.startViewTransition === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
const expectPaintedTransition = async (
  destination: 'details' | 'player' | 'catalogue',
) => {
  if (!canShareArtwork()) {
    await expect(document.querySelector('[data-artwork-flight]')).toBeNull()
    return
  }
  await waitFor(() => {
    expect(
      document.querySelector(`[data-artwork-destination="${destination}"]`),
    ).toBeInTheDocument()
    const activeLayers = document
      .getAnimations()
      .map(
        (animation) =>
          (animation.effect as KeyframeEffect | null)?.pseudoElement,
      )
    // A raw image overlay would lose the grade, crop, logo and controls.
    expect(activeLayers).toContain('::view-transition-old(hollyfilms-artwork)')
    expect(activeLayers).toContain('::view-transition-new(hollyfilms-artwork)')
  })
}
const waitForDialogReveal = async (dialog: HTMLElement) => {
  await waitFor(() => {
    if (getComputedStyle(dialog).opacity === '0')
      throw new Error('La fiche commence son apparition')
  })
  await expect(dialog).toBeVisible()
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
      const wide = card.closest<HTMLElement>(
        '.artwork-preview[data-wide="true"]',
      )
      if (wide) {
        await userEvent.hover(wide)
        await waitFor(() => {
          const panel = wide.querySelector<HTMLElement>(
            '.artwork-preview-panel',
          )
          expect(panel?.style.getPropertyValue('--preview-progress')).toBe('1')
        })
        await userEvent.click(
          wide.querySelector<HTMLElement>('.artwork-preview-open')!,
        )
      } else {
        await userEvent.click(card)
      }
      const dialog = await canvas.findByRole('dialog')
      if (canShareArtwork())
        await waitFor(() =>
          expect(
            document.querySelector('[data-artwork-destination="details"]'),
          ).toBeInTheDocument(),
        )
      await expect(dialog).toHaveAttribute('open')
      await userEvent.keyboard('{Escape}')
      if (canShareArtwork())
        await waitFor(() =>
          expect(
            document.querySelector('[data-artwork-destination="catalogue"]'),
          ).toBeInTheDocument(),
        )
      await waitFor(() =>
        expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
      )
      await waitFor(() =>
        expect(
          document.querySelector('[data-artwork-flight]'),
        ).not.toBeInTheDocument(),
      )
      await afterPaint()
      await expect(card).toHaveFocus()
      await expect(card).toHaveAttribute('aria-expanded', 'false')
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
    await userEvent.click(trigger)
    const dialog = await canvas.findByRole('dialog')
    await expectPaintedTransition('details')
    await waitFor(() => {
      const target = dialog.querySelector<HTMLImageElement>(
        '.detail-art-reveal img',
      )!
      expect(target.naturalWidth).toBeGreaterThan(0)
      expect(getComputedStyle(target).filter).not.toBe(sourceFilter)
      expect(getComputedStyle(target).objectPosition).not.toBe(sourcePosition)
    })
    await waitFor(() =>
      expect(document.querySelector('[data-artwork-flight]')).toBeNull(),
    )
    await userEvent.keyboard('{Escape}')
    await expectPaintedTransition('catalogue')
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
export const FastPlayback: Story = {
  args: { children: <Demo instant /> },
  play: async ({ canvas, canvasElement, userEvent }) => {
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
    await waitFor(() =>
      expect(canvasElement.querySelector('.player-viewport')).toHaveAttribute(
        'data-state',
        'playing',
      ),
    )
    await afterPaint()
    await expect(
      document.querySelector('[data-artwork-destination="player"]'),
    ).toBeNull()
    await waitFor(
      () =>
        expect(
          document.querySelector('[data-artwork-flight]'),
        ).not.toBeInTheDocument(),
      { timeout: 2000 },
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retour au catalogue' }),
    )
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}
export const PlayerRoundTrip: Story = {
  name: 'De la fiche au lecteur',
  args: { children: <Demo /> },
  play: async ({ canvas, canvasElement, userEvent }) => {
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
    await waitFor(() =>
      expect(
        canvasElement.querySelector<HTMLImageElement>('dialog img')
          ?.naturalWidth,
      ).toBeGreaterThan(0),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Lire la série' }))
    await expectPaintedTransition('player')
    await waitFor(
      () =>
        expect(
          document.querySelector('[data-artwork-flight]'),
        ).not.toBeInTheDocument(),
      { timeout: 2000 },
    )
    await waitFor(() =>
      expect(
        canvasElement.querySelector<HTMLImageElement>('.player-artwork img')
          ?.naturalWidth,
      ).toBeGreaterThan(0),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retour au catalogue' }),
    )
    await afterPaint()
    await expect(canvasElement.querySelector('.player-viewport')).toBeNull()
    await waitFor(
      () =>
        expect(
          document.querySelector('[data-artwork-flight]'),
        ).not.toBeInTheDocument(),
      { timeout: 2000 },
    )
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

export const HomepageToPlayer: Story = {
  args: { children: <Demo /> },
  play: async ({ canvas, canvasElement, userEvent }) => {
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
    await expectPaintedTransition('player')
    await waitFor(
      () =>
        expect(
          document.querySelector('[data-artwork-flight]'),
        ).not.toBeInTheDocument(),
      { timeout: 2000 },
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retour au catalogue' }),
    )
    await afterPaint()
    await expect(
      document.querySelector('[data-artwork-flight]'),
    ).not.toBeInTheDocument()
  },
}

export const OtherOrigins: Story = {
  name: 'Autres écrans sans transition partagée',
  args: { children: <Demo homepage={false} /> },
  play: async ({ canvas, canvasElement, userEvent }) => {
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
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Retour au catalogue' }),
      ).toBeVisible(),
    )
    await afterPaint()
    await expect(
      document.querySelector('[data-artwork-flight]'),
    ).not.toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retour au catalogue' }),
    )
    await afterPaint()
    await expect(
      document.querySelector('[data-artwork-flight]'),
    ).not.toBeInTheDocument()
  },
}
