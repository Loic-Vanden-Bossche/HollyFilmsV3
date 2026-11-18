import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'

import { PlaybackRouteStatus } from './PlaybackRouteStatus.tsx'

const meta = {
  title: 'UI/Reprise du lecteur',
  component: PlaybackRouteStatus,
  parameters: { layout: 'fullscreen' },
  args: { onClose: fn() },
} satisfies Meta<typeof PlaybackRouteStatus>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Ouverture depuis un lien de lecture',
  play: async ({ canvas, args, userEvent }) => {
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent(
        'Ouverture du titre…',
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Fermer' }))
    await expect(args.onClose).toHaveBeenCalled()
  },
}

export const Unavailable: Story = {
  args: {
    failure: {
      message: 'Ce média est indisponible ou tu n’y as pas accès.',
      retry: fn(),
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Ce média est indisponible',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.failure?.retry).toHaveBeenCalled()
  },
}
