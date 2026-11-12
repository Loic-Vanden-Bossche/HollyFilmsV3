import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { homeItems } from '../home-fixtures.ts'
import { PlayerShell } from './PlayerShell.tsx'

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
