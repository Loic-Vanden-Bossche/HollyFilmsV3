import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LibraryView } from './LibraryView.tsx'
import { homeItems } from '../home-fixtures.ts'
import { collectionFixtures, episodeFixtures } from '../library-fixtures.ts'

const meta = {
  title: 'HollyFilms/Pages bibliothèque',
  component: LibraryView,
  parameters: { layout: 'fullscreen' },
  args: {
    page: 'movies',
    items: homeItems.filter((item) => item.kind === 'Film'),
    resumeItems: [],
    state: 'ready',
    total: 128,
    sort: 'recent',
    onSort: fn(),
    onCollection: fn(),
    onNavigate: fn(),
    onSelect: fn(),
    onPlay: fn(),
    onFavorite: fn(),
    onWatched: fn(),
    onLoadMore: fn(),
    onRetry: fn(),
  },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <div className="home-page">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof LibraryView>
export default meta
type Story = StoryObj<typeof meta>
export const Movies: Story = {
  play: async ({ canvas, canvasElement, args }) => {
    await userEvent.click(
      canvas.getByRole('combobox', { name: 'Trier les titres' }),
    )
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('option', {
        name: 'Mieux notés',
      }),
    )
    await expect(args.onSort).toHaveBeenCalledWith('rating')
    await userEvent.click(canvas.getByRole('button', { name: 'Voir la fiche' }))
    await expect(args.onSelect).toHaveBeenCalledWith(args.items[0])
  },
}
export const Series: Story = {
  args: {
    page: 'series',
    items: homeItems.map((item) => ({ ...item, kind: 'Série' })),
    resumeItems: episodeFixtures,
    total: 42,
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { name: 'Reprendre un épisode' }),
    ).toBeInTheDocument()
  },
}
export const Favorites: Story = {
  args: {
    page: 'favorites',
    items: homeItems.slice(0, 6).map((item) => ({ ...item, favorite: true })),
    total: 6,
  },
}
export const EmptyFavorites: Story = {
  args: { page: 'favorites', items: [], total: 0 },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Explorer les films' }),
    )
    await expect(args.onNavigate).toHaveBeenCalledWith('movies')
  },
}
export const Collections: Story = {
  args: {
    page: 'collections',
    items: [],
    collections: collectionFixtures,
    total: collectionFixtures.length,
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', {
        name: new RegExp(collectionFixtures[0].title),
      }),
    )
    await expect(args.onCollection).toHaveBeenCalledWith(
      collectionFixtures[0].id,
    )
  },
}
export const CollectionContents: Story = {
  args: {
    page: 'collections',
    collectionId: collectionFixtures[0].id,
    collection: collectionFixtures[0],
    items: homeItems.slice(0, 3),
    total: 3,
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Toutes les collections' }),
    )
    await expect(args.onCollection).toHaveBeenCalledWith()
  },
}
export const Loading: Story = {
  args: { state: 'loading', items: [], total: 0 },
}
export const Unavailable: Story = {
  args: { page: 'collections', state: 'error', items: [] },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}
export const EmptyCollections: Story = {
  args: { page: 'collections', items: [], collections: [], total: 0 },
}
export const CollectionsLoading: Story = {
  args: { page: 'collections', items: [], state: 'loading' },
}
