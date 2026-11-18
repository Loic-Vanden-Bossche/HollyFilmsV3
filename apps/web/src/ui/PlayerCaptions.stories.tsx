import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { classicSubtitle, subtitleYellow } from '../playback/preferences.ts'
import { PlayerCaptions } from './PlayerCaptions.tsx'
import '../player.css'

const meta = {
  title: 'UI/Lecteur/Sous-titres bilingues',
  component: PlayerCaptions,
  args: {
    layout: 'paired',
    primary: 'Les lumières du port.',
    secondary: '港口的灯光。',
    primaryLanguage: 'fr',
    secondaryLanguage: 'zh-Hans',
    styles: {
      primary: classicSubtitle,
      secondary: { ...classicSubtitle, color: subtitleYellow, scale: 0.9 },
    },
  },
  parameters: { layout: 'fullscreen' },
  render: function Scene(args) {
    const [index, setIndex] = useState(0)
    const cues = [
      args.primary,
      'Une ligne.\nPuis deux.',
      '',
      'Un.\nDeux.\nTrois.',
      '',
      args.primary,
    ]
    return (
      <div className="player-stage" style={{ background: '#111d2b' }}>
        <button
          className="glass-control"
          style={{ margin: 16, padding: 10 }}
          onClick={() => setIndex((index + 1) % cues.length)}
        >
          Réplique suivante
        </button>
        <PlayerCaptions
          {...args}
          primary={cues[index]}
          secondary={
            index === 5 ? '' : index >= 3 ? '雾散了。' : args.secondary
          }
        />
      </div>
    )
  },
} satisfies Meta<typeof PlayerCaptions>
export default meta
type Story = StoryObj<typeof meta>

export const IndependentCues: Story = {
  name: 'Deux langues, répliques indépendantes',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const advance = canvas.getByRole('button', { name: 'Réplique suivante' })
    const lower = canvas.getByText('Les lumières du port.')
    const position = () =>
      canvasElement
        .querySelector('[data-subtitle-slot="secondary"]')!
        .getBoundingClientRect().bottom
    const start = position()
    const gap = lower.getBoundingClientRect().top - start
    await expect(gap).toBeGreaterThan(0)
    await expect(gap).toBeLessThan(9)
    for (let i = 0; i < 2; i++) {
      await userEvent.click(advance)
      await expect(Math.abs(position() - start)).toBeLessThan(1)
    }
    await userEvent.click(advance)
    await waitFor(() => expect(position()).toBeLessThan(start - 1))
    const longCuePosition = position()
    await userEvent.click(advance)
    await expect(Math.abs(position() - longCuePosition)).toBeLessThan(1)
    await userEvent.click(advance)
    await expect(canvas.queryByText('雾散了。')).not.toBeInTheDocument()
    await expect(canvas.getByText('Les lumières du port.')).toBeVisible()
    await userEvent.click(advance)
  },
}
