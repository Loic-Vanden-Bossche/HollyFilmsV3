import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { MediaRequestDialog } from './MediaRequestDialog.tsx'
import { discoveryFixtures, requestFixtures } from '../request-fixtures.ts'

const meta = {
  title: 'UI/Demandes/Confirmation',
  component: MediaRequestDialog,
  args: { title: discoveryFixtures[0], onConfirm: fn(), onClose: fn() },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MediaRequestDialog>
export default meta
type Story = StoryObj<typeof meta>

export const Confirmation: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible())
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await expect(args.onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    await expect(args.onClose).toHaveBeenCalledTimes(1)
  },
}
export const Sending: Story = {
  args: { pending: true },
  play: async ({ canvas, userEvent, args }) => {
    await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible())
    await expect(canvas.getByRole('button', { name: 'Envoi…' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Fermer' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    await expect(args.onClose).not.toHaveBeenCalled()
    await expect(args.onConfirm).not.toHaveBeenCalled()
  },
}
export const Success: Story = {
  args: { request: requestFixtures[0], offerRequests: true },
  play: async ({ canvas, userEvent, args }) => {
    await waitFor(() => expect(canvas.getByRole('status')).toBeVisible())
    await expect(
      canvas.getByRole('link', { name: 'Voir mes demandes' }),
    ).toHaveAttribute('href', '/requests')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Continuer à explorer' }),
    )
    await expect(args.onClose).toHaveBeenCalledTimes(1)
    await expect(args.onConfirm).not.toHaveBeenCalled()
  },
}
export const Error: Story = {
  args: { error: 'La demande n’a pas pu être envoyée.' },
  play: async ({ canvas, userEvent, args }) => {
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible())
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await expect(args.onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Annuler' }))
    await expect(args.onClose).toHaveBeenCalledTimes(1)
  },
}
export const LongTitle: Story = {
  ...Confirmation,
  args: {
    title: {
      ...discoveryFixtures[0],
      title:
        'Un très long titre de série : la dernière aventure à travers les mondes et toutes ses saisons',
      type: 'tv',
      poster: undefined,
    },
  },
}
