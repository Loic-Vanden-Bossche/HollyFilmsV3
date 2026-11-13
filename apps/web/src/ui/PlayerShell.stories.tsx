import { useRef, useState, type ComponentProps } from 'react'
import { PlayerControls } from './PlayerControls.tsx'
import { useSubtitleClearance } from '../playback/use-subtitle-clearance.ts'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { homeItems } from '../home-fixtures.ts'
import { PlayerShell } from './PlayerShell.tsx'
import { PlayerSessionActions } from './PlayerSessionActions.tsx'

const meta = {
  title: 'UI/Lecteur',
  component: PlayerShell,
  args: { title: 'Signal', state: 'loading', onClose: fn(), onRetry: fn() },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PlayerShell>
export default meta
type Story = StoryObj<typeof meta>
export const Loading: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument()
    await expect(canvas.getByRole('dialog')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retour au catalogue' }),
    )
    await expect(args.onClose).toHaveBeenCalledOnce()
  },
}
export const Unavailable: Story = {
  args: { state: 'error' },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'La lecture n’a pas pu démarrer',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}
export const Playing: Story = {
  args: {
    title: 'Signal',
    state: 'playing',
    children: (
      <img
        src={homeItems[0].backdrop as string}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    ),
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText(args.title, { exact: true })).toBeVisible()
    await expect(canvas.getByText('HollyFilms')).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Retour au catalogue' }),
    ).toBeEnabled()
  },
}

export const HiddenControls: Story = {
  args: { ...Playing.args, showHeading: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('HollyFilms')).not.toBeVisible()
    await expect(
      canvas.queryByRole('button', { name: 'Retour au catalogue' }),
    ).not.toBeInTheDocument()
  },
}

export const LongTitle: Story = {
  args: {
    ...Playing.args,
    title: 'Signal · Une nuit au-delà de l’orbite de Neptune',
  },
  play: Playing.play,
}
export const SessionActions: Story = {
  args: {
    ...Playing.args,
    actions: <PlayerSessionActions onCast={fn()} onSync={fn()} />,
  },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Chromecast et appareils' }),
      ).toBeVisible(),
    )
    await expect(canvas.getByRole('button', { name: 'SyncPlay' })).toBeEnabled()
  },
}

function SubtitleClearanceScene({
  styledSubtitles,
  ...args
}: ComponentProps<typeof PlayerShell> & { styledSubtitles?: boolean }) {
  const [visible, setVisible] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  useSubtitleClearance(stage, visible)
  return (
    <PlayerShell {...args} state="playing" showHeading={visible}>
      <div className="player-stage" ref={stage}>
        <img
          src={homeItems[0].backdrop as string}
          alt=""
          className="player-video"
        />
        <button
          className="glass-control"
          style={{
            position: 'absolute',
            top: '35%',
            left: 24,
            zIndex: 5,
            padding: 12,
          }}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Masquer les commandes' : 'Afficher les commandes'}
        </button>
        {styledSubtitles ? (
          <canvas
            className="player-subtitle-canvas"
            width={1600}
            height={900}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
            ref={(node) => {
              const ctx = node?.getContext('2d')
              if (!ctx) return
              ctx.clearRect(0, 0, 1600, 900)
              ctx.fillStyle = '#fff'
              ctx.font = '36px sans-serif'
              ctx.textAlign = 'center'
              ctx.fillText('Texte positionné en haut dans la piste', 800, 80)
              ctx.fillText('Sous-titres ASS / bitmap', 800, 850)
            }}
          />
        ) : (
          <div
            className="player-captions"
            style={{ fontSize: 'clamp(18px, 2.6vw, 34px)' }}
          >
            <p>Keep your eyes on the stars.</p>
            <p>Gardez les yeux tournés vers les étoiles.</p>
          </div>
        )}
        <div
          className="player-controls-layer"
          data-visible={visible}
          inert={!visible}
          style={{ opacity: visible ? 1 : 0 }}
        >
          <PlayerControls
            media={{
              position: 66,
              duration: 180,
              buffered: 105,
              paused: false,
              muted: false,
              volume: 0.75,
            }}
            fullscreen={false}
            pip={false}
            hasPrevious
            hasNext
            subtitles
            onToggle={() => {}}
            onSeek={() => {}}
            onVolume={() => {}}
            onMute={() => {}}
            onPrevious={() => {}}
            onNext={() => {}}
            onFullscreen={() => {}}
            onSubtitles={() => {}}
            onSettings={() => {}}
          />
        </div>
      </div>
    </PlayerShell>
  )
}

export const SubtitleClearance: Story = {
  name: 'Sous-titres au-dessus des commandes',
  render: (args, { parameters }) => (
    <SubtitleClearanceScene
      {...args}
      styledSubtitles={parameters.styledSubtitles}
    />
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const caption = canvasElement.querySelector(
      '.player-captions, .player-subtitle-canvas',
    )!
    const initialBottom = caption.getBoundingClientRect().bottom
    await userEvent.click(
      canvas.getByRole('button', { name: 'Afficher les commandes' }),
    )
    await waitFor(() =>
      expect(caption.getBoundingClientRect().bottom).toBeLessThan(
        canvasElement.querySelector('.player-controls')!.getBoundingClientRect()
          .top - 8,
      ),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Masquer les commandes' }),
    )
    await waitFor(() =>
      expect(
        Math.abs(caption.getBoundingClientRect().bottom - initialBottom),
      ).toBeLessThan(1),
    )
  },
}
export const StyledSubtitleClearance: Story = {
  ...SubtitleClearance,
  name: 'ASS et bitmap — zone libre sans recadrage',
  parameters: { styledSubtitles: true },
}
