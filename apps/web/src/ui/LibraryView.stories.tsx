import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
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
    const banner = canvas.getByRole('banner')
    const featured = within(banner)
    const film = args.items[0]
    await expect(
      featured.getByRole('heading', { level: 1, name: /Les films/ }),
    ).toBeVisible()
    const title = featured.getByRole('heading', { level: 2, name: film.title })
    await expect(title).toBeVisible()
    await waitFor(async () => {
      const backdrop = Array.from(banner.querySelectorAll('img')).find(
        (image) => image.getAttribute('src') === film.backdrop,
      )
      if (!backdrop) throw new Error('Waiting for the featured backdrop')
      await expect(backdrop).toBeVisible()
      const bounds = backdrop.getBoundingClientRect()
      await expect(bounds.width).toBeGreaterThan(banner.clientWidth / 2)
      await expect(bounds.height).toBeGreaterThan(0)
      await expect(title.querySelector('img')).toHaveAttribute('src', film.logo)
    })
    const play = featured.getByRole('button', { name: 'Lire' })
    const details = featured.getByRole('button', { name: 'Voir la fiche' })
    await expect(play).toBeVisible()
    await expect(details).toBeVisible()
    await userEvent.click(play)
    await expect(args.onPlay).toHaveBeenCalledWith(film, false)
    await userEvent.click(details)
    await expect(args.onSelect).toHaveBeenCalledWith(film)
  },
}
export const MovieWithPosterOnly: Story = {
  args: {
    items: [
      {
        ...meta.args.items[0],
        backdrop: undefined,
        thumb: undefined,
        logo: undefined,
        progress: 0.4,
      },
    ],
    total: 1,
  },
  play: async ({ canvas, args }) => {
    const film = args.items[0]
    const banner = canvas.getByRole('banner')
    const featured = within(banner)
    await expect(
      featured.getByRole('heading', { level: 2, name: film.title }),
    ).toHaveTextContent(film.title)
    await expect(featured.getByText('1 film disponible')).toBeVisible()
    await waitFor(() =>
      expect(banner.querySelector('img')).toHaveAttribute('src', film.poster),
    )
    const resume = featured.getByRole('button', { name: 'Reprendre' })
    await userEvent.click(resume)
    await expect(args.onPlay).toHaveBeenCalledWith(film, true)
  },
}
export const Series: Story = {
  args: {
    page: 'series',
    items: homeItems.map((item) => ({ ...item, kind: 'Série' })),
    resumeItems: episodeFixtures,
    total: 42,
  },
  play: async ({ canvas, args }) => {
    await expect(
      canvas.getByRole('heading', { name: 'Reprendre un épisode' }),
    ).toBeInTheDocument()
    const featured = within(canvas.getByRole('banner'))
    const trigger = featured.getByRole('button', { name: args.items[0].title })
    await userEvent.hover(trigger)
    await userEvent.click(
      await featured.findByRole('button', { name: 'Voir la fiche' }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith(args.items[0])
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
    const collection = collectionFixtures[0]
    const card = canvas.getByRole('article', { name: collection.title })
    const compact = within(card)
    const trigger = compact.getByRole('button', { name: collection.title })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() =>
      expect(compact.getByText(collection.title)).toBeVisible(),
    )
    await expect(compact.getByText('COLLECTION · 2 TITRES')).toBeVisible()
    await expect(compact.getByText('Explorer')).toBeVisible()
    await waitFor(async () => {
      const artwork = Array.from(card.querySelectorAll('img'))
      const poster = artwork.find(
        (image) => image.getAttribute('src') === collection.poster,
      )
      const backdrop = artwork.find(
        (image) => image.getAttribute('src') === collection.backdrop,
      )
      await expect(poster).toBeVisible()
      await expect(backdrop).toBeVisible()
      const posterBounds = poster!.getBoundingClientRect()
      await expect(posterBounds.width).toBeGreaterThan(0)
      await expect(posterBounds.height).toBeGreaterThan(posterBounds.width)
    })
    await userEvent.hover(trigger)
    const preview = within(
      await compact.findByRole('group', { name: collection.title }),
    )
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() =>
      expect(preview.getByText(collection.overview)).toBeVisible(),
    )
    await userEvent.click(preview.getByRole('button', { name: 'Explorer' }))
    await expect(args.onCollection).toHaveBeenCalledWith(collection.id)
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
