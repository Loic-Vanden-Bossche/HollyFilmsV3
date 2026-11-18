import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, waitFor } from 'storybook/test'
import { homeItems } from '../home-fixtures.ts'
import { PlayerArtwork } from './PlayerArtwork.tsx'

const meta = {
  title: 'UI/Entrée du lecteur',
  component: PlayerArtwork,
  args: { source: homeItems[0].backdrop, visible: true },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <div
            style={{
              position: 'relative',
              height: '100dvh',
              background: '#080f1b',
            }}
          >
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof PlayerArtwork>
export default meta
type Story = StoryObj<typeof meta>

export const Artwork: Story = {
  name: 'Découverte du fond du film',
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('.player-artwork-hero img'),
    ).toBeInTheDocument()
  },
}

export const MissingArtwork: Story = { args: { source: undefined } }

export const RevealVideo: Story = {
  render: function Render(args) {
    const [visible, setVisible] = useState(true)
    return (
      <>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          Première image vidéo simulée
        </div>
        <PlayerArtwork {...args} visible={visible} />
        <button
          className="glass-control"
          style={{ position: 'absolute', bottom: 24, left: 24, padding: 12 }}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Simuler la première image' : 'Rejouer l’entrée'}
        </button>
      </>
    )
  },
  play: async ({ canvas, userEvent, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Simuler la première image' }),
    )
    await waitFor(() =>
      expect(
        canvasElement.querySelector('.player-artwork-hero'),
      ).not.toBeInTheDocument(),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Rejouer l’entrée' }),
    )
    await expect(
      canvasElement.querySelector('.player-artwork-hero'),
    ).toBeInTheDocument()
  },
}
