import { useEffect, useState } from 'react'
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

export const Opening: Story = {
  name: 'Ouverture cinéma — navigation immédiate',
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.queryByRole('button', { name: 'Passer l’introduction' }),
    ).not.toBeInTheDocument()
    await expect(
      canvasElement.querySelector('.home-page-content'),
    ).not.toHaveAttribute('inert')
    await expect(getComputedStyle(document.body).overflow).not.toBe('hidden')
    await waitFor(
      () =>
        expect(canvasElement.querySelector('.home-page')).toHaveAttribute(
          'data-opening',
          'false',
        ),
      { timeout: 3000 },
    )
    await expect(canvasElement.querySelector('.home-hero-actions')).toHaveStyle(
      { opacity: '1' },
    )
  },
}
export const DelayedHero: Story = {
  name: 'À l’affiche — arrivée des données pendant l’intro',
  args: {
    items: Array.from({ length: 36 }, (_, index) => ({
      ...homeItems[index % homeItems.length],
      id: 'arrival-' + index,
    })),
  },
  render: function Render(args) {
    const [ready, setReady] = useState(false)
    useEffect(() => {
      const timer = setTimeout(() => setReady(true), 400)
      return () => clearTimeout(timer)
    }, [])
    return (
      <HomePage
        {...args}
        items={ready ? args.items : []}
        resumeItems={ready ? args.resumeItems : []}
        state={ready ? 'ready' : 'loading'}
      />
    )
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('region', { name: 'À l’affiche' })
    await expect(
      canvasElement.querySelector('.home-page-content'),
    ).not.toHaveAttribute('inert')
    await waitFor(
      () =>
        expect(canvasElement.querySelector('.home-hero-actions')).toHaveStyle({
          opacity: '1',
        }),
      { timeout: 3000 },
    )
  },
}
export const Background: Story = {
  name: 'Fond animé et pause',
  play: async ({ canvas, canvasElement, userEvent }) => {
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
    await userEvent.click(canvas.getByRole('button', { name: 'Lire' }))
    await expect(args.onPlay).toHaveBeenCalledWith(args.items[0], true)
  },
}
export const CardPlayback: Story = {
  name: 'Lecture depuis les affiches',
  args: { onPlay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    canvas
      .getByRole('button', { name: 'Voir la fiche de ' + args.items[0].title })
      .scrollIntoView()
    const card = await canvas.findByRole('article', {
      name: args.items[0].title,
    })
    await userEvent.hover(card)
    await userEvent.click(
      within(card).getByRole('button', { name: 'Lire ' + args.items[0].title }),
    )
    await expect(args.onPlay).toHaveBeenCalledWith(args.items[0], true)
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
    const resume = canvas.getAllByRole('article', {
      name: args.resumeItems[0].title,
    })[0]
    await userEvent.hover(resume)
    await waitFor(() => expect(resume).toHaveAttribute('data-active', 'true'))
    await userEvent.click(
      within(resume).getByRole('button', {
        name: 'Reprendre ' + args.resumeItems[0].title,
      }),
    )
    await expect(args.onPlay).toHaveBeenLastCalledWith(
      args.resumeItems[0],
      true,
    )
  },
}
export const Browse: Story = {
  name: 'Explorer le catalogue',
  play: async ({ canvas, userEvent, args }) => {
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
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}
export const Administrator: Story = {
  args: { isAdmin: true },
  play: async ({ canvas, userEvent, args }) => {
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

export const ImmersiveNavigation: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Explorer HollyFilms' })
    await userEvent.click(trigger)
    await userEvent.click(
      within(canvas.getByRole('dialog')).getByRole('button', {
        name: '02 Films',
      }),
    )
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await expect(args.onFilter).toHaveBeenCalledWith('movies')
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Les films.',
    )
    await expect(trigger).toHaveFocus()
  },
}
export const PlaybackSuspendsDecorations: Story = {
  args: { playbackOpen: true },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('.catalogue-backdrop'),
    ).toHaveAttribute('data-motion', 'paused')
    await expect(canvasElement.querySelector('canvas')).toBeNull()
  },
}

export const PerformanceCatalogue: Story = {
  name: 'Catalogue chargé — 96 titres',
  args: {
    items: Array.from({ length: 96 }, (_, index) => ({
      ...homeItems[index % homeItems.length],
      id: 'perf-' + index,
    })),
    resumeItems: [],
    filter: 'movies',
    onPlay: fn(),
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(canvasElement.querySelector('.home-page')).toHaveAttribute(
          'data-opening',
          'false',
        ),
      { timeout: 3000 },
    )
  },
}
