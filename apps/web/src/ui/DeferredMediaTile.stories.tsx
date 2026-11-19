import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, waitFor } from 'storybook/test'
import { DeferredMediaTile } from './DeferredMediaTile.tsx'
import { homeItems } from '../home-fixtures.ts'

const meta = {
  title: 'UI/Deferred Media Tile',
  component: DeferredMediaTile,
  args: { item: homeItems[0], onSelect: fn() },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <div className="home-grid" style={{ gridTemplateColumns: '240px' }}>
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof DeferredMediaTile>
export default meta
type Story = StoryObj<typeof meta>
export const Visible: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await canvas.findByRole('article', { name: args.item.title })
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Voir la fiche de ' + args.item.title,
      }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith(args.item)
  },
}
export const OffscreenKeyboard: Story = {
  name: 'Hors écran — focus conservé et hauteur stable',
  decorators: [
    (Story) => (
      <div style={{ paddingTop: '180vh' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const placeholder = canvas.getByRole('button', {
      name: 'Voir la fiche de ' + args.item.title,
    })
    await expect(canvas.queryByRole('article')).not.toBeInTheDocument()
    const slot = placeholder.getBoundingClientRect()
    await expect(slot.width / slot.height).toBeCloseTo(2 / 3, 2)
    const height = canvasElement.ownerDocument.documentElement.scrollHeight
    placeholder.focus({ preventScroll: true })
    await canvas.findByRole('article', { name: args.item.title })
    const button = canvas.getByRole('button', {
      name: 'Voir la fiche de ' + args.item.title,
    })
    await waitFor(() => expect(button).toHaveFocus())
    await expect(button.getBoundingClientRect().height).toBe(slot.height)
    await expect(
      Math.abs(
        canvasElement.ownerDocument.documentElement.scrollHeight - height,
      ),
    ).toBeLessThanOrEqual(2)
    await userEvent.keyboard('{Enter}')
    await expect(args.onSelect).toHaveBeenCalledWith(args.item)
  },
}
