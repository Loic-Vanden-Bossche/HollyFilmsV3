import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { ArtworkWatermark } from './ArtworkWatermark.tsx'

const meta = {
  title: 'UI/Filigrane HollyFilms',
  component: ArtworkWatermark,
} satisfies Meta<typeof ArtworkWatermark>

export default meta
type Story = StoryObj<typeof meta>

export const Contrast: Story = {
  name: 'Sur fond clair et sombre',
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
        gap: 16,
        maxWidth: 760,
      }}
    >
      {[
        {
          label: 'Décor clair',
          background: 'linear-gradient(145deg, #b0d2dd, #fff5e4 75%)',
        },
        {
          label: 'Décor sombre',
          background: 'linear-gradient(145deg, #4a6471, #081219 75%)',
        },
      ].map(({ label, background }) => (
        <div
          key={label}
          role="img"
          aria-label={label}
          style={{
            position: 'relative',
            aspectRatio: '16 / 9',
            borderRadius: 12,
            background,
          }}
        >
          <ArtworkWatermark />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    for (const cover of canvas.getAllByRole('img')) {
      const mark = cover.querySelector<HTMLElement>('.artwork-watermark')!
      await expect(mark).toBeVisible()
      await expect(mark).toHaveAttribute('aria-hidden', 'true')
      await expect(mark).toHaveStyle({ pointerEvents: 'none' })
    }
  },
}
