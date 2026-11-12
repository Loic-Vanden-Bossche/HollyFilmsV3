import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { PlayerControls } from './PlayerControls.tsx'

const meta = {
  title: 'UI/Commandes de lecture',
  component: PlayerControls,
  args: {
    media: {
      position: 66,
      duration: 180,
      buffered: 105,
      paused: false,
      muted: false,
      volume: 0.75,
    },
    fullscreen: false,
    pip: false,
    hasPrevious: false,
    hasNext: true,
    subtitles: true,
    markers: [{ position: 60, label: 'Deuxième acte' }],
    onToggle: fn(),
    onSeek: fn(),
    onVolume: fn(),
    onMute: fn(),
    onPrevious: fn(),
    onNext: fn(),
    onFullscreen: fn(),
    onSubtitles: fn(),
    onSettings: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-black pt-56">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlayerControls>

export default meta
type Story = StoryObj<typeof meta>

export const Playing: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }))
    await expect(args.onToggle).toHaveBeenCalledOnce()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Avancer de 30 secondes' }),
    )
    await expect(args.onSeek).toHaveBeenCalledWith(96)
    await userEvent.click(canvas.getByRole('button', { name: 'Suivant' }))
    await expect(args.onNext).toHaveBeenCalledOnce()
  },
}

export const Paused: Story = {
  args: {
    media: { ...meta.args.media, paused: true, muted: true },
    hasNext: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Lire' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Suivant' })).toBeDisabled()
  },
}

const previewSheet =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="448" height="126"><rect width="224" height="126" fill="#163c40"/><circle cx="112" cy="63" r="35" fill="#4ade80"/><rect x="224" width="224" height="126" fill="#102a50"/><circle cx="336" cy="63" r="35" fill="#3b82f6"/></svg>',
  )

export const TimelinePreview: Story = {
  args: {
    onPreview: (position) => ({
      url: previewSheet,
      width: 224,
      height: 126,
      x: position >= 90 ? 224 : 0,
      y: 0,
      sheetWidth: 448,
      sheetHeight: 126,
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    canvas.getByRole('slider', { name: 'Position de lecture' }).focus()
    await expect(
      await canvas.findByRole('img', {
        name: 'Aperçu de la position de lecture',
      }),
    ).toBeVisible()
  },
}

export const PreviewUnavailable: Story = {
  args: { onPreview: () => undefined },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    canvas.getByRole('slider', { name: 'Position de lecture' }).focus()
    await expect(await canvas.findByText('Aperçu indisponible')).toBeVisible()
  },
}
