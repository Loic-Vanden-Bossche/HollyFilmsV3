import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, waitFor, within } from 'storybook/test'
import { SearchResults } from './SearchResults.tsx'
import { homeItems } from '../home-fixtures.ts'
import '../home.css'
import './search-bar.css'

const meta = {
  title: 'UI/Recherche/Résultats',
  component: SearchResults,
  args: {
    query: 'Signal',
    paused: false,
    onSelect: fn(),
    onPlay: fn(),
    results: {
      items: [homeItems[1]],
      total: 1,
      state: 'ready',
      onLoadMore: fn(),
      onRetry: fn(),
    },
  },
  parameters: { layout: 'fullscreen' },
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
} satisfies Meta<typeof SearchResults>
export default meta
type Story = StoryObj<typeof meta>
export const Results: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const item = args.results.items[0]
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: `Voir la fiche de ${item.title}` }),
      ).toHaveClass('media-tile-select'),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: `Voir la fiche de ${item.title}` }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith(item)
    const card = canvas.getByRole('article', { name: item.title })
    await userEvent.hover(card)
    await userEvent.click(
      within(card).getByRole('button', { name: `Lire ${item.title}` }),
    )
    await expect(args.onPlay).toHaveBeenCalledWith(item, true)
  },
}
export const Loading: Story = {
  args: {
    results: { ...meta.args.results, items: [], state: 'loading', total: 0 },
  },
}
export const Empty: Story = {
  args: {
    query: 'Introuvable',
    results: { ...meta.args.results, items: [], total: 0 },
  },
}
export const Unavailable: Story = {
  args: {
    results: { ...meta.args.results, items: [], state: 'error', total: 0 },
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.results.onRetry).toHaveBeenCalled()
  },
}
export const Suggestions: Story = {
  args: {
    query: '',
    results: {
      ...meta.args.results,
      items: homeItems,
      total: homeItems.length,
    },
  },
}
