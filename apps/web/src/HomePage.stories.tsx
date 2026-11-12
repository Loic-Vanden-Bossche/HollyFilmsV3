import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, waitFor, within } from 'storybook/test'
import { HomePage } from './HomePage.tsx'
import { homeItems, homeResume } from './home-fixtures.ts'
import type { LibraryFilter } from '@hollyfilms/shared/library'

const meta = {
  title: 'HollyFilms/Accueil',
  component: HomePage,
  parameters: { layout: 'fullscreen' },
  args: {
    username: 'Alex',
    items: homeItems,
    resumeItems: homeResume,
    state: 'ready',
    total: homeItems.length,
    filter: 'all',
    search: '',
    onFilter: fn(),
    onSearch: fn(),
    onLoadMore: fn(),
    onRetry: fn(),
    onSignOut: fn(),
  },
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
  render: function Render(args) {
    const [filter, setFilter] = useState<LibraryFilter>(args.filter)
    const [search, setSearch] = useState(args.search)
    const items = args.items.filter(
      (item) =>
        (filter === 'all' ||
          (filter === 'movies'
            ? item.kind === 'Film'
            : item.kind === 'Série')) &&
        item.title.toLowerCase().includes(search.trim().toLowerCase()),
    )
    return (
      <HomePage
        {...args}
        items={items}
        total={items.length}
        filter={filter}
        search={search}
        onFilter={(value) => {
          args.onFilter(value)
          setFilter(value)
        }}
        onSearch={(value) => {
          args.onSearch(value)
          setSearch(value)
        }}
      />
    )
  },
} satisfies Meta<typeof HomePage>
export default meta
type Story = StoryObj<typeof meta>

export const Opening: Story = { name: 'Ouverture cinéma' }
export const Background: Story = {
  name: 'Fond animé et pause',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const skip = canvas.queryByRole('button', { name: 'Passer l’introduction' })
    if (skip) await userEvent.click(skip)
    const background = canvasElement.querySelector('.catalogue-backdrop')
    const pause = canvas.queryByRole('button', {
      name: 'Mettre le fond en pause',
    })
    if (!pause) {
      await expect(background).toHaveAttribute('data-motion', 'paused')
      return
    }
    await expect(background).toHaveAttribute('data-motion', 'running')
    await userEvent.click(pause)
    await expect(background).toHaveAttribute('data-motion', 'paused')
    const resume = canvas.getByRole('button', { name: 'Animer le fond' })
    await expect(resume).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(resume)
    await expect(background).toHaveAttribute('data-motion', 'running')
  },
}
export const StartPlayback: Story = {
  args: { onPlay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const skip = canvas.queryByRole('button', { name: 'Passer l’introduction' })
    if (skip) await userEvent.click(skip)
    await userEvent.click(canvas.getByRole('button', { name: 'Lire' }))
    await expect(args.onPlay).toHaveBeenCalledWith(args.items[0], true)
  },
}
export const Browse: Story = {
  name: 'Explorer le catalogue',
  play: async ({ canvas, userEvent, args }) => {
    const skip = canvas.queryByRole('button', { name: 'Passer l’introduction' })
    if (skip) await userEvent.click(skip)
    await waitFor(() =>
      expect(
        canvas.getByRole('navigation', { name: 'Bibliothèque' }),
      ).toBeVisible(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Films' }))
    await expect(args.onFilter).toHaveBeenCalledWith('movies')
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Les films.',
    )
    await userEvent.type(canvas.getByRole('searchbox'), 'Signal')
    await expect(args.onSearch).toHaveBeenLastCalledWith('Signal')
    const card = await canvas.findByRole('button', {
      name: 'Voir la fiche de Signal',
    })
    await userEvent.click(card)
    const dialog = await canvas.findByRole('dialog')
    await waitFor(() =>
      expect(
        within(dialog).getByRole('heading', { name: 'Signal' }),
      ).toBeVisible(),
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Fermer la fiche' }),
    )
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await expect(card).toHaveFocus()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Effacer la recherche' }),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Accueil' }))
  },
}
export const Loading: Story = {
  args: { state: 'loading', items: [], resumeItems: [] },
}
export const Empty: Story = { args: { items: [], resumeItems: [], total: 0 } }
export const Unavailable: Story = {
  args: { state: 'error', items: [], resumeItems: [] },
  play: async ({ canvas, userEvent, args }) => {
    const skip = canvas.queryByRole('button', { name: 'Passer l’introduction' })
    if (skip) await userEvent.click(skip)
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}
export const Administrator: Story = {
  args: { isAdmin: true },
  play: async ({ canvas, userEvent, args }) => {
    const skip = canvas.queryByRole('button', { name: 'Passer l’introduction' })
    if (skip) await userEvent.click(skip)
    await expect(
      canvas.getByRole('link', { name: 'Administration' }),
    ).toHaveAttribute('href', '/admin')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Se déconnecter' }),
    )
    await expect(args.onSignOut).toHaveBeenCalledOnce()
  },
}
export const MoreTitles: Story = {
  args: { hasMore: true },
  play: async ({ canvas, userEvent, args }) => {
    const skip = canvas.queryByRole('button', { name: 'Passer l’introduction' })
    if (skip) await userEvent.click(skip)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Afficher plus de titres' }),
    )
    await expect(args.onLoadMore).toHaveBeenCalledOnce()
  },
}
export const NoArtwork: Story = {
  args: {
    items: homeItems.map((item) => ({
      ...item,
      poster: undefined,
      backdrop: undefined,
    })),
    resumeItems: [],
  },
}
