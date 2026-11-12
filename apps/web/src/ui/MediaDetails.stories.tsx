import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, waitFor } from 'storybook/test'
import { MediaDetails } from './MediaDetails.tsx'
import { homeItems, homeResume } from '../home-fixtures.ts'
const meta = {
  title: 'UI/Fiche média',
  component: MediaDetails,
  args: { item: homeItems[0], onClose: fn() },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof MediaDetails>
export default meta
type Story = StoryObj<typeof meta>
export const Open: Story = {}
export const WithoutPoster: Story = {
  args: { item: { ...homeItems[0], poster: undefined } },
}
export const InProgress: Story = { args: { item: homeResume[0] } }
export const Close: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Fermer la fiche' }),
    )
    await waitFor(() => expect(args.onClose).toHaveBeenCalledOnce())
  },
}
export const Play: Story = {
  args: { onPlay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Lire la série' }))
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
  },
}
export const Resume: Story = {
  args: { item: homeResume[0], onPlay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reprendre' }))
    await expect(args.onPlay).toHaveBeenLastCalledWith(args.item, true)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Depuis le début' }),
    )
    await expect(args.onPlay).toHaveBeenLastCalledWith(args.item, false)
  },
}
