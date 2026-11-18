import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { expect, fn, waitFor } from 'storybook/test'
import { SubtitleActionDialog } from './SubtitleActionDialog.tsx'
const meta = {
  title: 'UI/Sous-titres/Confirmation',
  component: SubtitleActionDialog,
  args: {
    action: 'download',
    version: 'Version cinéma · 1080p',
    language: 'fra',
    languageLabel: 'français',
    fileName: 'Orbital.2026.1080p.BluRay — French',
    onConfirm: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof SubtitleActionDialog>
export default meta
type Story = StoryObj<typeof meta>
export const Confirmation: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Confirmer le téléchargement',
      }),
    )
    await expect(args.onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    await expect(args.onClose).toHaveBeenCalledTimes(1)
  },
}
export const ImmediateReopen: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Installer la piste
        </button>
        <AnimatePresence>
          {open && (
            <SubtitleActionDialog
              {...args}
              onClose={() => {
                setOpen(false)
                args.onClose()
              }}
            />
          )}
        </AnimatePresence>
      </>
    )
  },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Installer la piste' })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
    await userEvent.click(trigger)
    await expect(canvas.getByRole('dialog')).not.toHaveAttribute('inert')
    await userEvent.click(canvas.getByRole('button', { name: 'Annuler' }))
    await expect(trigger).toHaveFocus()
    await expect(args.onClose).toHaveBeenCalledTimes(2)
  },
}
export const Pending: Story = {
  args: { pending: true },
  play: async ({ canvas, userEvent, args }) => {
    await waitFor(() => expect(canvas.getByRole('status')).toBeVisible())
    await expect(
      canvas.getByRole('button', { name: 'Confirmer le téléchargement' }),
    ).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    await expect(args.onClose).not.toHaveBeenCalled()
    await expect(args.onConfirm).not.toHaveBeenCalled()
  },
}
export const Installed: Story = {
  args: { result: 'DOWNLOADED' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Fermer' }))
    await expect(args.onClose).toHaveBeenCalledTimes(1)
    await expect(args.onConfirm).not.toHaveBeenCalled()
  },
}
export const Error: Story = {
  ...Confirmation,
  args: { error: 'Le service de sous-titres est indisponible.' },
}
export const Member: Story = {
  args: { action: 'request', fileName: undefined },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Confirmer la demande' }),
    )
    await expect(args.onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Annuler' }))
    await expect(args.onClose).toHaveBeenCalledTimes(1)
  },
}
