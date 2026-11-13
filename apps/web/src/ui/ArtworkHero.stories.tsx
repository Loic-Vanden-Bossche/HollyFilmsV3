import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, waitFor } from 'storybook/test'
import { ArtworkHeroProvider } from './ArtworkHero.tsx'
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
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
const waitForDialogReveal = async (dialog: HTMLElement) => {
  await waitFor(() => {
    if (getComputedStyle(dialog).opacity === '0')
      throw new Error('La fiche commence son apparition')
  })
  await expect(dialog).toBeVisible()
}

export const SharedArtwork: Story = {
  name: 'Fiches sans transition partagée',
  args: { children: <Demo /> },
  play: async ({ canvas, canvasElement, userEvent }) => {
    let flights = 0
    const observer = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches('[data-artwork-flight]') ||
              node.querySelector('[data-artwork-flight]'))
          )
            flights++
        }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    try {
      await waitFor(() =>
        expect(
          canvasElement.querySelector('img')?.naturalWidth,
        ).toBeGreaterThan(0),
      )
      for (const card of canvas.getAllByRole('button', {
        name: /Voir la fiche de/,
      })) {
        await userEvent.click(card)
        await waitForDialogReveal(await canvas.findByRole('dialog'))
        await afterPaint()
        await expect(
          document.querySelector('[data-artwork-flight]'),
        ).not.toBeInTheDocument()
        await userEvent.click(
          canvas.getByRole('button', { name: 'Fermer la fiche' }),
        )
        await waitFor(() =>
          expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
        )
        await afterPaint()
      }
      await expect(flights).toBe(0)
    } finally {
      observer.disconnect()
    }
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
    await afterPaint()
    await expect(
      document.querySelector('[data-artwork-flight]'),
    ).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Lire la série' }))
    await waitFor(() =>
      expect(canvasElement.querySelector('.player-viewport')).toHaveAttribute(
        'data-state',
        'playing',
      ),
    )
    if (!reducedMotion())
      await expect(
        document.querySelector('[data-artwork-destination="player"]'),
      ).toBeInTheDocument()
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
  name: 'Fiche vers lecteur, retour sans transition partagée',
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
    if (!reducedMotion())
      await waitFor(() =>
        expect(
          document.querySelector('[data-artwork-destination="player"]'),
        ).toBeInTheDocument(),
      )
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
    await expect(
      document.querySelector('[data-artwork-destination="artwork"]'),
    ).not.toBeInTheDocument()
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
    if (!reducedMotion())
      await waitFor(() =>
        expect(
          document.querySelector('[data-artwork-destination="player"]'),
        ).toBeInTheDocument(),
      )
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
