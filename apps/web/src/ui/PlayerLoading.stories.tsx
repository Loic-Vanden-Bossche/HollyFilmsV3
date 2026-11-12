import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { PlayerLoading } from './PlayerLoading.tsx'
import { homeItems } from '../home-fixtures.ts'
import type { LoadingPhase } from '../playback/loading-progress.ts'

const meta = {
  title: 'UI/Préparation de la lecture',
  component: PlayerLoading,
  parameters: { layout: 'fullscreen' },
  args: { visible: true, phase: 'stream' },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          height: '100dvh',
          minHeight: 320,
          background: '#080f1b',
          overflow: 'hidden',
        }}
      >
        <img
          src={homeItems[0].backdrop as string}
          alt=""
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.5,
            filter: 'blur(18px)',
          }}
        />
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlayerLoading>
export default meta
type Story = StoryObj<typeof meta>

export const ServerPreparation: Story = {
  name: 'Barre et pourcentage',
  play: async ({ canvas }) => {
    const progress = await canvas.findByRole('progressbar')
    await expect(progress).toHaveAttribute('aria-valuenow', '25')
    await expect(progress).toHaveTextContent('25 %')
    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument()
  },
}
export const ReceivingVideo: Story = { args: { phase: 'buffer' } }
export const PreparingFrame: Story = { args: { phase: 'image' } }
export const StagedProgress: Story = {
  name: 'Progression animée et fin de chargement',
  render: function Render(args) {
    const [index, setIndex] = useState(0)
    const phases: LoadingPhase[] = ['source', 'stream', 'buffer', 'image']
    return (
      <>
        <PlayerLoading
          {...args}
          visible={index < 4}
          complete={index === 4}
          phase={phases[Math.min(index, 3)]}
        />
        <button
          className="glass-control"
          style={{ position: 'absolute', bottom: 20, left: 20, padding: 12 }}
          onClick={() => setIndex((value) => (value + 1) % 5)}
        >
          {index === 4
            ? 'Rejouer'
            : index === 3
              ? 'Afficher la vidéo'
              : 'Avancer'}
        </button>
        {index === 4 && (
          <p style={{ position: 'absolute', top: 20, left: 20 }}>
            Vidéo disponible
          </p>
        )}
      </>
    )
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    for (const percent of [25, 50, 75]) {
      await userEvent.click(canvas.getByRole('button', { name: 'Avancer' }))
      await expect(canvas.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        String(percent),
      )
      await waitFor(() =>
        expect(canvas.getByRole('progressbar')).toHaveTextContent(
          percent + ' %',
        ),
      )
    }
    await userEvent.click(
      canvas.getByRole('button', { name: 'Afficher la vidéo' }),
    )
    await expect(canvas.getByText('Vidéo disponible')).toBeVisible()
    await expect(canvas.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
    await waitFor(() =>
      expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Rejouer' }))
    await expect(await canvas.findByRole('progressbar')).toHaveTextContent(
      '0 %',
    )
  },
}
export const Interrupted: Story = {
  name: 'Interruption sans faux succès',
  render: function Render(args) {
    const [visible, setVisible] = useState(true)
    return (
      <>
        <PlayerLoading {...args} visible={visible} complete={false} />
        <button
          className="glass-control"
          style={{ position: 'absolute', bottom: 20, left: 20, padding: 12 }}
          onClick={() => setVisible(false)}
        >
          Simuler une erreur
        </button>
      </>
    )
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('progressbar')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Simuler une erreur' }),
    )
    await expect(canvas.queryByText('100 %')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument(),
    )
  },
}
