import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, mocked, waitFor, within } from 'storybook/test'
import { getLibraryImage } from '@hollyfilms/shared/library'
import { HomePage } from './HomePage.tsx'
import { homeItems, homeResume } from './home-fixtures.ts'
import type { LibraryFilter } from '@hollyfilms/shared/library'
import { avatarFixture } from './profile-fixtures.ts'
import { collectionFixtures, episodeFixtures } from './library-fixtures.ts'
import { PerformanceProvider } from './performance/PerformanceProvider.tsx'
import { PerformanceController } from './performance/profiles.ts'

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
    const [collectionId, setCollectionId] = useState(args.collectionId)
    const items = args.items.filter(
      (item) =>
        filter === 'all' ||
        filter === 'collections' ||
        (filter === 'favorites'
          ? item.favorite
          : filter === 'movies'
            ? item.kind === 'Film'
            : item.kind === 'Série'),
    )
    const results = items.filter((item) =>
      item.title.toLowerCase().includes(search.trim().toLowerCase()),
    )
    return (
      <HomePage
        {...args}
        items={items}
        total={
          filter === 'collections' && !collectionId
            ? (args.collections?.length ?? 0)
            : items.length
        }
        collectionId={collectionId}
        collection={args.collections?.find((item) => item.id === collectionId)}
        onCollection={(id) => {
          args.onCollection?.(id)
          setCollectionId(id)
        }}
        filter={filter}
        search={search}
        searchResults={{
          items: results,
          total: results.length,
          state: args.state,
          onLoadMore: args.onLoadMore,
          onRetry: args.onRetry,
        }}
        onFilter={(value) => {
          args.onFilter(value)
          setFilter(value)
          setCollectionId(undefined)
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

export const UltraPerformance: Story = {
  name: 'Ultra — catalogue de 96 titres',
  args: {
    items: Array.from({ length: 96 }, (_, index) => ({
      ...homeItems[index % homeItems.length],
      id: 'ultra-' + index,
    })),
  },
  decorators: [
    function Ultra(Story) {
      const [controller] = useState(() => {
        const value = new PerformanceController()
        value.setAdmin(true)
        value.select('ultra', 0)
        return value
      })
      return (
        <PerformanceProvider controller={controller}>
          <Story />
        </PerformanceProvider>
      )
    },
  ],
}

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
    await waitFor(() =>
      expect(canvasElement.querySelector('.home-carousel')).toHaveAttribute(
        'data-revealed',
        'true',
      ),
    )
    await expect(
      canvas.getByRole('button', { name: /^Voir la fiche$/ }),
    ).toBeEnabled()
    await waitFor(
      () =>
        expect(canvasElement.querySelector('.home-page')).toHaveAttribute(
          'data-opening',
          'false',
        ),
      { timeout: 3000 },
    )
    await waitFor(() =>
      expect(canvasElement.querySelector('.home-hero-actions')).toHaveStyle({
        opacity: '1',
      }),
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
  render: function Render(args, { parameters }) {
    const [ready, setReady] = useState(false)
    useEffect(() => {
      const timer = setTimeout(
        () => setReady(true),
        parameters.catalogueDelay ?? 400,
      )
      return () => clearTimeout(timer)
    }, [parameters.catalogueDelay])
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
    const pending = canvas.getByRole('region', {
      name: 'Chargement de la sélection à l’affiche',
    })
    const height = pending.getBoundingClientRect().height
    await expect(
      canvas.queryByRole('heading', { name: 'Votre bibliothèque.' }),
    ).not.toBeInTheDocument()
    const hero = await canvas.findByRole(
      'region',
      { name: 'À l’affiche' },
      { timeout: 4000 },
    )
    await expect(
      Math.abs(hero.getBoundingClientRect().height - height),
    ).toBeLessThan(2)
    await expect(
      canvas.queryByRole('heading', { name: 'Votre bibliothèque.' }),
    ).not.toBeInTheDocument()
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
export const SlowReload: Story = {
  ...DelayedHero,
  name: 'Rechargement lent — cadre stable sans faux écran vide',
  parameters: { catalogueDelay: 1800 },
}

export const PreloadedHero: Story = {
  name: 'À l’affiche — commandes disponibles pendant le décodage',
  args: {
    session: { deviceId: 'preload-story', accessToken: 'story-token' },
    items: [
      {
        ...homeItems[0],
        backdrop: { itemId: 'preload', type: 'Backdrop', tag: 'backdrop' },
        logo: { itemId: 'preload', type: 'Logo', tag: 'logo' },
      },
    ],
    resumeItems: [],
  },
  beforeEach: () => {
    mocked(getLibraryImage)
      .mockReset()
      .mockImplementation(async (_base, _session, image) => {
        await new Promise((resolve) =>
          setTimeout(resolve, image.type === 'Logo' ? 1900 : 1600),
        )
        return new Blob(
          [
            decodeURIComponent(
              String(
                image.type === 'Logo'
                  ? homeItems[0].logo
                  : homeItems[0].backdrop,
              ).split(',')[1],
            ),
          ],
          { type: 'image/svg+xml' },
        )
      })
  },
  play: async ({ canvasElement }) => {
    const page = canvasElement.querySelector('.home-page')!
    const hero = canvasElement.querySelector('.home-carousel')!
    await waitFor(() => expect(getLibraryImage).toHaveBeenCalledTimes(2))
    await expect(hero).toHaveAttribute('data-revealed', 'true')
    await expect(hero).not.toHaveAttribute('inert')
    await expect(hero.querySelector('.hero-details')).toBeEnabled()
    await waitFor(() => expect(page).toHaveAttribute('data-opening', 'false'), {
      timeout: 3000,
    })
    await waitFor(
      () =>
        expect(hero.querySelectorAll('.media-artwork-fallback')).toHaveLength(
          0,
        ),
      { timeout: 4000 },
    )
    const images = Array.from(
      hero.querySelectorAll<HTMLImageElement>('.media-artwork img'),
    )
    await expect(images).toHaveLength(2)
    await expect(
      images.every((image) => image.complete && image.naturalWidth > 0),
    ).toBe(true)
    await waitFor(() =>
      expect(hero.querySelector('.home-hero-actions')).toHaveStyle({
        opacity: '1',
      }),
    )
    await expect(getLibraryImage).toHaveBeenCalledTimes(2)
  },
}
export const FailedHeroArtwork: Story = {
  ...PreloadedHero,
  name: 'À l’affiche — repli après erreur des images',
  beforeEach: () => {
    mocked(getLibraryImage)
      .mockReset()
      .mockRejectedValue(new Error('Artwork unavailable'))
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
    await waitFor(() =>
      expect(canvasElement.querySelector('.home-hero-actions')).toHaveStyle({
        opacity: '1',
      }),
    )
    await expect(canvasElement.querySelector('.hero-logo')).toHaveTextContent(
      homeItems[0].title,
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
    window.scrollTo({ top: 0, behavior: 'instant' })
    await waitFor(() =>
      expect(background).toHaveAttribute('data-motion', 'running'),
    )
    await userEvent.click(pause)
    await expect(background).toHaveAttribute('data-motion', 'paused')
    const resume = canvas.getByRole('button', { name: 'Animer le fond' })
    await expect(resume).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(resume)
    window.scrollTo({ top: 0, behavior: 'instant' })
    await waitFor(() =>
      expect(background).toHaveAttribute('data-motion', 'running'),
    )
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
    const trigger = await canvas.findByRole('button', {
      name: 'Voir la fiche de ' + args.items[0].title,
    })
    trigger.scrollIntoView({ behavior: 'instant', block: 'center' })
    const card = await canvas.findByRole('article', {
      name: args.items[0].title,
    })
    await userEvent.hover(card)
    await waitFor(() => expect(card).toHaveAttribute('data-active', 'true'))
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
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await waitFor(() =>
      expect(
        canvas.getByRole('navigation', { name: 'Bibliothèque' }),
      ).toBeVisible(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Films' }))
    await expect(args.onFilter).toHaveBeenCalledWith('movies')
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: 'Les films.' })).toBeVisible(),
    )
    await userEvent.type(canvas.getByRole('searchbox'), 'Signal')
    await expect(args.onSearch).toHaveBeenLastCalledWith('Signal')
    await waitFor(() =>
      expect(
        canvasElement.querySelector(
          '[data-page="movies::search"][data-present="true"]',
        ),
      ).toHaveStyle({ opacity: '1' }),
    )
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
    await userEvent.click(
      canvas.getByRole('button', { name: 'Menu du compte : Alex' }),
    )
    await expect(
      canvas.getByRole('link', { name: 'Demandes d’approbation' }),
    ).toHaveAttribute('href', '/admin')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Se déconnecter' }),
    )
    await expect(args.onSignOut).toHaveBeenCalledOnce()
  },
}
export const MoreTitles: Story = {
  name: 'Pagination — reprise manuelle',
  args: { hasMore: true, loadMoreError: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
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

export const UnifiedNavigation: Story = {
  name: 'Navigation unique — onglets, clavier et recherche',
  play: async ({ canvas, userEvent, args }) => {
    const navigation = canvas.getByRole('navigation', { name: 'Bibliothèque' })
    await expect(
      canvas.getAllByRole('navigation', { name: 'Bibliothèque' }),
    ).toHaveLength(1)
    for (const name of [
      'Accueil',
      'Favoris',
      'Films',
      'Séries',
      'Collections',
    ]) {
      await expect(canvas.getAllByRole('button', { name })).toHaveLength(1)
    }
    await expect(
      canvas.queryByRole('button', { name: 'Explorer HollyFilms' }),
    ).not.toBeInTheDocument()
    await userEvent.type(canvas.getByRole('searchbox'), 'Signal')
    const films = within(navigation).getByRole('button', { name: 'Films' })
    films.focus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onFilter).toHaveBeenCalledWith('movies')
    await expect(canvas.getByRole('searchbox')).toHaveValue('')
    await expect(films).toHaveAttribute('aria-current', 'page')
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: 'Les films.' })).toBeVisible(),
    )
    await userEvent.tab()
    await expect(
      within(navigation).getByRole('button', { name: 'Séries' }),
    ).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onFilter).toHaveBeenLastCalledWith('series')
    await userEvent.click(
      within(navigation).getByRole('button', { name: 'Accueil' }),
    )
    await expect(args.onFilter).toHaveBeenLastCalledWith('all')
    await expect(
      within(navigation).getByRole('button', { name: 'Accueil' }),
    ).toHaveAttribute('aria-current', 'page')
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

export const ProfileAccess: Story = {
  args: { avatarUrl: avatarFixture },
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', {
      name: 'Menu du compte : Alex',
    })
    await expect(trigger.querySelector('img')).toHaveAttribute(
      'src',
      avatarFixture,
    )
    await userEvent.click(trigger)
    await expect(
      canvas.getByRole('link', { name: /^Profil$/ }),
    ).toHaveAttribute('href', '/profile')
    await expect(
      canvas.queryByRole('link', { name: 'Demandes d’approbation' }),
    ).not.toBeInTheDocument()
  },
}

export const FiveDestinations: Story = {
  name: 'Cinq pages — compositions et transitions',
  args: {
    items: homeItems.map((item, index) => ({ ...item, favorite: index < 3 })),
    collections: collectionFixtures,
    resumeItems: episodeFixtures,
    onCollection: fn(),
  },
  play: async ({ canvas, userEvent }) => {
    for (const [tab, title] of [
      ['Favoris', 'Vos favoris.'],
      ['Films', 'Les films.'],
      ['Séries', 'Les séries.'],
      ['Collections', 'Les collections.'],
    ]) {
      await userEvent.click(canvas.getByRole('button', { name: tab }))
      await waitFor(() =>
        expect(canvas.getByRole('heading', { name: title })).toBeVisible(),
      )
    }
    await userEvent.click(
      canvas.getByRole('button', {
        name: new RegExp(collectionFixtures[0].title),
      }),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', {
          name: collectionFixtures[0].title + '.',
        }),
      ).toBeVisible(),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Toutes les collections' }),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Les collections.' }),
      ).toBeVisible(),
    )
  },
}
