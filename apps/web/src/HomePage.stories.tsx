import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, mocked, waitFor, within } from 'storybook/test'
import { getLibraryImage } from '@hollyfilms/shared/library'
import { HomePage } from './HomePage.tsx'
import {
  homeItems,
  homeResume,
  homeShelfItems,
  mixedGenreFilms,
} from './home-fixtures.ts'
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
    const [sort, setSort] = useState(args.sort)
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
        sort={sort}
        search={search}
        searchResults={{
          items: results,
          total: results.length,
          state: args.state,
          onLoadMore: args.onLoadMore,
          onRetry: args.onRetry,
        }}
        onFilter={(value, order) => {
          if (order) args.onFilter(value, order)
          else args.onFilter(value)
          setFilter(value)
          setSort(order)
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

export const ThematicShelves: Story = {
  name: 'Affiches, classement et sélections',
  args: { items: homeShelfItems, onPlay: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const recent = await canvas.findByRole('region', {
      name: 'Tout juste arrivés',
    })
    await expect(
      canvas.getByRole('heading', { name: 'Sous tension' }),
    ).toBeInTheDocument()
    await expect(canvasElement.querySelector('.virtual-media-grid')).toBeNull()
    const exploreNav = await canvas.findByRole('navigation', {
      name: 'Explorer les sélections',
    })
    const selections = within(exploreNav).getAllByRole('link')
    await expect(selections.length).toBeGreaterThanOrEqual(8)
    const explore = within(exploreNav).getByRole('link', {
      name: 'Western à l’affiche',
    })
    explore.focus({ preventScroll: true })
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Western à l’affiche' }),
      ).toHaveFocus(),
    )
    await expect(
      canvas.getByRole('region', { name: 'Les films les mieux notés' }),
    ).toHaveAttribute('data-shelf-format', 'ranked')
    recent.scrollIntoView({ behavior: 'instant', block: 'center' })
    const rail = recent.querySelector<HTMLElement>('.home-shelf-track')!
    await waitFor(() =>
      expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth),
    )
    const viewport = document.documentElement.clientWidth
    await waitFor(() =>
      expect(rail.getBoundingClientRect().right).toBeCloseTo(viewport, 0),
    )
    const next = recent.querySelector<HTMLButtonElement>(
      '.horizontal-rail-arrow--next',
    )!
    await expect(next).toHaveAccessibleName()
    await userEvent.click(next)
    await waitFor(() => expect(rail.scrollLeft).toBeGreaterThan(0))
    rail.scrollTo({ left: rail.scrollWidth, behavior: 'instant' })
    await waitFor(() => expect(next).toBeDisabled())
    const last = within(recent).getAllByRole('article').at(-1)!
    const bounds = last.getBoundingClientRect()
    await expect(bounds.right).toBeLessThanOrEqual(
      document.documentElement.clientWidth + 1,
    )
    await expect(bounds.left).toBeGreaterThanOrEqual(0)
    await expect(bounds.width / bounds.height).toBeCloseTo(2 / 3, 1)
    await userEvent.hover(last)
    await userEvent.click(
      await within(last).findByRole('button', { name: /^Lire / }),
    )
    await waitFor(() =>
      expect(args.onPlay).toHaveBeenCalledWith(
        expect.objectContaining({ title: last.getAttribute('aria-label') }),
        true,
      ),
    )
    rail.scrollTo({ left: 0, behavior: 'instant' })
  },
}

export const SectionNavigation: Story = {
  name: 'Défilement vers une sélection au clavier',
  args: { items: homeShelfItems },
  play: async ({ canvas, userEvent }) => {
    const navigation = await canvas.findByRole('navigation', {
      name: 'Explorer les sélections',
    })
    const name = 'Western à l’affiche'
    const link = within(navigation).getByRole('link', { name })
    const heading = canvas.getByRole('heading', { name })
    navigation.scrollIntoView({ block: 'center', behavior: 'instant' })
    link.focus({ preventScroll: true })

    const start = window.scrollY
    const margin = parseFloat(getComputedStyle(heading).scrollMarginTop) || 0
    const destination = Math.min(
      document.documentElement.scrollHeight - window.innerHeight,
      start + heading.getBoundingClientRect().top - margin,
    )
    const positions: number[] = []
    const sample = () => positions.push(window.scrollY)
    window.addEventListener('scroll', sample)
    try {
      await userEvent.keyboard('{Enter}')
      await waitFor(
        () => expect(Math.abs(window.scrollY - destination)).toBeLessThan(2),
        { timeout: 3000 },
      )
      await expect(heading).toHaveFocus()
      await expect(window.location.hash).toBe('#' + heading.id)
      const intermediate = positions.some(
        (position) => position > start + 2 && position < destination - 2,
      )
      const minimalMotion =
        matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.performance === 'light'
      await expect(intermediate).toBe(!minimalMotion)

      const entriesAfterNavigation = window.history.length
      const search = window.location.search
      const recent = canvas.getByRole('heading', { name: 'Tout juste arrivés' })
      recent.scrollIntoView({ block: 'start', behavior: 'instant' })
      await waitFor(() => expect(window.location.hash).toBe('#' + recent.id))
      await expect(heading).toHaveFocus()
      await expect(window.history.length).toBe(entriesAfterNavigation)

      window.scrollTo({ top: 0, behavior: 'instant' })
      await waitFor(() => expect(window.location.hash).toBe(''))
      await expect(window.location.search).toBe(search)
      await expect(heading).toHaveFocus()
      await expect(window.history.length).toBe(entriesAfterNavigation)
    } finally {
      window.removeEventListener('scroll', sample)
    }
  },
}

export const OverlappingGenres: Story = {
  name: 'Douze films, plusieurs genres par film',
  args: { items: mixedGenreFilms, resumeItems: [] },
  play: async ({ canvas, userEvent, args }) => {
    const nav = await canvas.findByRole('navigation', {
      name: 'Explorer les sélections',
    })
    const links = within(nav).getAllByRole('link')
    await expect(links.length).toBeGreaterThan(4)
    for (const genre of ['Animation', 'Famille', 'Horreur', 'Comédie']) {
      const link = within(nav).getByRole('link', {
        name: genre + ' à l’affiche',
      })
      await expect(link).toBeVisible()
    }
    const animation = within(nav).getByRole('link', {
      name: 'Animation à l’affiche',
    })
    animation.focus()
    await userEvent.keyboard('{Enter}')
    const section = canvas.getByRole('region', {
      name: 'Animation à l’affiche',
    })
    await waitFor(() =>
      expect(within(section).getByRole('heading')).toHaveFocus(),
    )
    const eligible = args.items.filter((item) =>
      item.genres.includes('Animation'),
    )
    const cards = within(section).getAllByRole('article')
    await expect(cards.length).toBeGreaterThanOrEqual(2)
    for (const card of cards)
      await expect(eligible.map((item) => item.title)).toContain(
        card.getAttribute('aria-label'),
      )
  },
}

export const CinemaPerformance: Story = {
  name: 'Cinéma — catalogue de 96 titres',
  args: {
    items: Array.from({ length: 96 }, (_, index) => ({
      ...homeItems[index % homeItems.length],
      id: 'cinema-' + index,
    })),
  },
  decorators: [
    function Cinema(Story) {
      const [controller] = useState(() => new PerformanceController())
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
    const imageRequests = () =>
      mocked(getLibraryImage).mock.calls.map(([, , image]) => image.type)
    await waitFor(() => {
      expect(imageRequests()).toContain('Backdrop')
      expect(imageRequests()).toContain('Logo')
    })
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
    // A visible shelf can request a smaller rendition of the same backdrop.
    const renditions = mocked(getLibraryImage).mock.calls.map(
      ([, , image, width]) => image.type + '/' + width,
    )
    await expect(new Set(renditions).size).toBe(renditions.length)
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
  args: {
    onPlay: fn(),
    resumeItems: [
      ...homeResume,
      ...homeShelfItems.slice(0, 14).map((item) => ({
        ...item,
        progress: 0.28,
        remainingMinutes: 85,
      })),
    ],
  },
  play: async ({ canvas, userEvent, args }) => {
    const recentSection = await canvas.findByRole('region', {
      name: 'Tout juste arrivés',
    })
    const trigger = within(recentSection).getByRole('button', {
      name: 'Voir la fiche de ' + args.items[0].title,
    })
    trigger.scrollIntoView({ behavior: 'instant', block: 'center' })
    const card = within(recentSection).getByRole('article', {
      name: args.items[0].title,
    })
    await userEvent.hover(card)
    await waitFor(() => expect(card).toHaveAttribute('data-active', 'true'))
    await userEvent.click(
      within(card).getByRole('button', { name: 'Lire ' + args.items[0].title }),
    )
    await waitFor(() =>
      expect(args.onPlay).toHaveBeenCalledWith(args.items[0], true),
    )
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
    const resumeSection = canvas.getByRole('region', {
      name: /En cours de lecture/,
    })
    const rail = resumeSection.querySelector<HTMLDivElement>(
      '.horizontal-rail-track',
    )!
    const [resume] = within(resumeSection).getAllByRole('article')
    const bounds = resume.getBoundingClientRect()
    await expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 1)
    await expect(bounds.width).toBeLessThanOrEqual(384)
    if (rail.clientWidth >= 1440)
      await expect(bounds.width).toBeGreaterThanOrEqual(300)
    if (rail.clientWidth >= 390)
      await expect(bounds.width).toBeLessThan(rail.clientWidth / 2)
    await userEvent.click(
      within(resumeSection).getByRole('button', {
        name: 'Titres en cours suivants',
      }),
    )
    await waitFor(() => expect(rail.scrollLeft).toBeGreaterThan(0))
    await userEvent.click(
      await within(resumeSection).findByRole('button', {
        name: 'Titres en cours précédents',
      }),
    )
    await waitFor(() => expect(rail.scrollLeft).toBe(0))
    await userEvent.hover(resume)
    await waitFor(() => expect(resume).toHaveAttribute('data-active', 'true'))
    await userEvent.click(
      within(resume).getByRole('button', {
        name: 'Reprendre ' + args.resumeItems[0].title,
      }),
    )
    await waitFor(() =>
      expect(args.onPlay).toHaveBeenLastCalledWith(args.resumeItems[0], true),
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
  name: 'Films — reprise manuelle de la pagination',
  args: { filter: 'movies', hasMore: true, loadMoreError: true },
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
