import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { expect, fireEvent, fn, waitFor } from 'storybook/test'
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
    await waitFor(() => {
      const image = canvas.getByRole('img', {
        name: 'Aperçu de la position de lecture',
      })
      if (getComputedStyle(image).opacity !== '1')
        throw new Error('L’aperçu termine son fondu')
    })
    await expect(
      canvas.getByRole('img', { name: 'Aperçu de la position de lecture' }),
    ).toBeVisible()
  },
}

export const PointerPreview: Story = {
  name: 'Aperçu fluide sans modifier la lecture',
  args: TimelinePreview.args,
  play: async ({ canvas, canvasElement, args }) => {
    const slider = canvas.getByRole('slider', { name: 'Position de lecture' })
    const bounds = slider.getBoundingClientRect()
    for (const [fraction, time, offset] of [
      [0.25, '0:45', '0px'],
      [0.3, '0:54', '0px'],
      [0.75, '2:15', '-224px'],
    ] as const) {
      fireEvent.pointerMove(slider, {
        pointerType: 'mouse',
        clientX: bounds.left + bounds.width * fraction,
      })
      await waitFor(() =>
        expect(
          canvasElement.querySelector('.player-preview-time'),
        ).toHaveTextContent(time),
      )
      await expect(
        canvas.getByRole('img', { name: 'Aperçu de la position de lecture' }),
      ).toHaveStyle({ left: offset })
    }
    await expect(slider).toHaveValue('66')
    await expect(args.onSeek).not.toHaveBeenCalled()
    fireEvent.pointerOut(slider)
    await waitFor(() => {
      if (canvas.queryByRole('img'))
        throw new Error('L’aperçu termine sa sortie')
    })
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument()
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

export const ResponsiveTimeline: Story = {
  name: 'Timeline réactive — chargement et sauts successifs',
  args: { ...TimelinePreview.args },
  render: function Render(args) {
    const [media, setMedia] = useState({ ...args.media, seeking: false })
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => () => clearTimeout(timer.current), [])
    return (
      <>
        <p role="status" className="px-8 text-sm text-muted-foreground">
          {media.seeking
            ? 'Chargement de la position sélectionnée…'
            : 'Position confirmée'}
        </p>
        <PlayerControls
          {...args}
          media={media}
          onSeek={(position) => {
            args.onSeek(position)
            clearTimeout(timer.current)
            setMedia((current) => ({ ...current, position, seeking: true }))
            timer.current = setTimeout(
              () => setMedia((current) => ({ ...current, seeking: false })),
              1500,
            )
          }}
        />
      </>
    )
  },
  play: async ({ canvas, userEvent, args }) => {
    const timeline = canvas.getByRole('slider', { name: 'Position de lecture' })
    await userEvent.click(
      canvas.getByRole('button', { name: 'Avancer de 30 secondes' }),
    )
    await expect(timeline).toHaveValue('96')
    await expect(canvas.getByRole('status')).toHaveTextContent('Chargement')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Avancer de 30 secondes' }),
    )
    await expect(timeline).toHaveValue('126')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reculer de 10 secondes' }),
    )
    await expect(timeline).toHaveValue('116')
    await expect(args.onSeek).toHaveBeenLastCalledWith(116)
    timeline.focus()
    await expect(timeline).toHaveAttribute('aria-valuetext', '1:56')
    await waitFor(
      () =>
        expect(canvas.getByRole('status')).toHaveTextContent(
          'Position confirmée',
        ),
      { timeout: 2500 },
    )
    await expect(timeline).toHaveValue('116')
  },
}
