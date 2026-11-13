import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, waitFor } from 'storybook/test'
import { VirtualMediaGrid } from './VirtualMediaGrid.tsx'
import { homeItems } from '../home-fixtures.ts'
import '../home.css'

const items = Array.from({ length: 1000 }, (_, i) => ({
  ...homeItems[i % homeItems.length],
  id: `virtual-${i}`,
  title: `Film ${i + 1}`,
}))
const meta = {
  title: 'UI/Catalogue virtualisé',
  component: VirtualMediaGrid,
  parameters: { layout: 'fullscreen' },
  args: { items, total: items.length, onSelect: fn() },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <main style={{ padding: 24 }}>
            <Story />
          </main>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof VirtualMediaGrid>
export default meta
type Story = StoryObj<typeof meta>

export const ThousandTitles: Story = {
  name: '1 000 titres — DOM borné et focus conservé',
  play: async ({ canvas, userEvent, args }) => {
    window.scrollTo(0, 0)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1' }),
      ).toBeVisible(),
    )
    const initialHeight = document.documentElement.scrollHeight
    await expect(canvas.getAllByRole('listitem').length).toBeLessThan(90)
    window.scrollTo(0, initialHeight / 2)
    await waitFor(() =>
      expect(
        canvas.queryByRole('button', { name: 'Voir la fiche de Film 1' }),
      ).not.toBeInTheDocument(),
    )
    await expect(canvas.getAllByRole('listitem').length).toBeLessThan(90)
    window.scrollTo(0, document.documentElement.scrollHeight)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1000' }),
      ).toBeVisible(),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1000' }),
      ).toHaveClass('media-tile-select'),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Voir la fiche de Film 1000' }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith(items[999])
    window.scrollTo(0, 0)
    // The invoking card remains mounted even if a dialog moves focus away.
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1' }),
      ).toBeVisible(),
    )
    await expect(
      canvas.getByRole('button', { name: 'Voir la fiche de Film 1000' }),
    ).toBeInTheDocument()
    await expect(canvas.getAllByRole('listitem').length).toBeLessThan(90)
    await expect(
      Math.abs(document.documentElement.scrollHeight - initialHeight),
    ).toBeLessThan(10)
    canvas.getByRole('button', { name: 'Voir la fiche de Film 1' }).focus()
  },
}

export const Empty: Story = { args: { items: [], total: 0 } }
