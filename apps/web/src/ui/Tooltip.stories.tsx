import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within, waitFor } from 'storybook/test'
import { Heart, Volume2, VolumeX } from 'lucide-react'
import { Tooltip } from './Tooltip.tsx'

const click = fn()
const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  args: {
    children: (
      <button
        type="button"
        className="glass-control inline-grid size-11 place-items-center rounded-full"
        aria-label="Ajouter aux favoris"
        onClick={click}
      >
        <Heart size={20} />
      </button>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 80, display: 'flex', justifyContent: 'center' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>
export default meta
type Story = StoryObj<typeof meta>
export const HoverAndKeyboard: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('button', { name: 'Ajouter aux favoris' })
    await userEvent.hover(trigger)
    await expect(await body.findByRole('tooltip')).toHaveTextContent(
      'Ajouter aux favoris',
    )
    await userEvent.unhover(trigger)
    await waitFor(() =>
      expect(body.queryByRole('tooltip')).not.toBeInTheDocument(),
    )
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await expect(await body.findByRole('tooltip')).toHaveTextContent(
      'Ajouter aux favoris',
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(body.queryByRole('tooltip')).not.toBeInTheDocument(),
    )
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(click).toHaveBeenCalled()
  },
}
export const DynamicLabel: Story = {
  render: function Render() {
    const [muted, setMuted] = useState(false)
    return (
      <Tooltip>
        <button
          type="button"
          className="glass-control inline-grid size-11 place-items-center rounded-full"
          aria-label={muted ? 'Rétablir le son' : 'Couper le son'}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </button>
      </Tooltip>
    )
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Couper le son' }))
    const trigger = canvas.getByRole('button', { name: 'Rétablir le son' })
    await userEvent.unhover(trigger)
    await userEvent.hover(trigger)
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole('tooltip'),
    ).toHaveTextContent('Rétablir le son')
  },
}
export const Dialog: Story = {
  render: function Render(args) {
    return (
      <dialog
        ref={(node) => {
          if (node) {
            node.showModal()
            return () => node.close()
          }
        }}
        style={{
          margin: 'auto',
          padding: 60,
          background: '#0d1726',
          color: '#edf4fc',
          borderRadius: 20,
        }}
        aria-label="Exemple dans une modale"
      >
        <Tooltip {...args} />
      </dialog>
    )
  },
  play: async ({ canvas, userEvent }) => {
    const dialog = canvas.getByRole('dialog')
    const button = within(dialog).getByRole('button')
    await userEvent.hover(button)
    await expect(await within(dialog).findByRole('tooltip')).toHaveTextContent(
      'Ajouter aux favoris',
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(within(dialog).queryByRole('tooltip')).not.toBeInTheDocument(),
    )
    await expect(dialog).toBeVisible()
  },
}
export const LongHint: Story = {
  args: {
    content:
      'Quittez le groupe SyncPlay pour diffuser la vidéo sur un autre appareil.',
    side: 'bottom',
  },
}
