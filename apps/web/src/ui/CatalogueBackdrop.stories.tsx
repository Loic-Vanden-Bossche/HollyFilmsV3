import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { CatalogueBackdrop } from './CatalogueBackdrop.tsx'

const meta = {
  title: 'UI/Atmosphère du catalogue',
  component: CatalogueBackdrop,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative isolate min-h-dvh overflow-clip bg-background">
        <Story />
        <div className="relative flex min-h-dvh flex-col items-center justify-center gap-5 p-8 text-center text-foreground">
          <span className="text-xs tracking-[.4em] text-link">
            HOLLYFILMS 3.0
          </span>
          <h1 className="text-5xl font-semibold tracking-tight">
            Place au cinéma.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Lumière, profondeur et mouvement, aux couleurs de votre
            bibliothèque.
          </p>
        </div>
      </div>
    ),
  ],
  args: { paused: false },
} satisfies Meta<typeof CatalogueBackdrop>
export default meta
type Story = StoryObj<typeof meta>

export const Animated: Story = {
  name: 'Nappes lumineuses et rubans en mouvement',
}
export const Paused: Story = { args: { paused: true } }
export const PauseAndResume: Story = {
  render: function PauseAndResume() {
    const [paused, setPaused] = useState(false)
    return (
      <>
        <CatalogueBackdrop paused={paused} />
        <button
          className="glass-control absolute top-6 left-6 z-10 rounded-full px-5 py-3"
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? 'Reprendre' : 'Pause'}
        </button>
      </>
    )
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const background = canvasElement.querySelector('.catalogue-backdrop')!
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }))
    await expect(background).toHaveAttribute('data-motion', 'paused')
    await waitFor(() =>
      expect(
        background
          .getAnimations({ subtree: true })
          .every((animation) => animation.playState !== 'running'),
      ).toBe(true),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Reprendre' }))
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      await waitFor(() => {
        expect(background).toHaveAttribute('data-motion', 'running')
        expect(
          background
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === 'running'),
        ).toHaveLength(2)
      })
  },
}
