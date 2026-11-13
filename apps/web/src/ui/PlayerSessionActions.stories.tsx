import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { PlayerSessionActions } from './PlayerSessionActions.tsx'

const meta = {
  title: 'UI/Diffusion du lecteur',
  component: PlayerSessionActions,
  args: { onCast: fn(), onSync: fn() },
} satisfies Meta<typeof PlayerSessionActions>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Chromecast et appareils' }),
    )
    await expect(args.onCast).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'SyncPlay' }))
    await expect(args.onSync).toHaveBeenCalledOnce()
  },
}
export const Casting: Story = {
  args: { casting: true },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: 'Chromecast et appareils' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      canvas.getByRole('button', { name: 'SyncPlay' }),
    ).toBeDisabled()
  },
}
export const Syncing: Story = {
  args: { syncing: true },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const button = canvas.getByRole('button', {
      name: 'Chromecast et appareils',
    })
    await expect(button).toBeDisabled()
    await userEvent.hover(button.parentElement!)
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole('tooltip'),
    ).toHaveTextContent('Quittez SyncPlay pour diffuser')
    await userEvent.click(button.parentElement!)
    await expect(args.onCast).not.toHaveBeenCalled()
  },
}
export const Loading: Story = { args: { disabled: true } }
