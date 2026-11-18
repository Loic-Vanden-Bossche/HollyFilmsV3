import { StrictMode, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, mocked, waitFor, within } from 'storybook/test'
import {
  getLibraryPage,
  getCollection,
  getCollectionsPage,
  getResumeItems,
  getHeroPreview,
  setMediaFavorite,
  setMediaWatched,
} from '@hollyfilms/shared/library'
import { HomeScreen } from './HomeScreen.tsx'
import { homeItems, homeResume } from './home-fixtures.ts'
import {
  getMediaDetails,
  getMediaRelations,
  mediaRequest,
} from '@hollyfilms/shared/media-details'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import { createPlaybackApi, type PlaybackApi } from './playback/playback-api.ts'
import {
  detailedMovie,
  detailedRelations,
  detailedProviders,
  detailedReviews,
} from './ui/media-detail-fixtures.ts'
import { navigateApp } from './use-app-route.ts'
import { getProfile } from './account-api.ts'
import { collectionFixtures } from './library-fixtures.ts'
const meta = {
  title: 'HollyFilms/Accueil connecté',
  component: HomeScreen,
  args: {
    user: { id: 'test-user', name: 'Alex', isAdministrator: false },
    session: { deviceId: 'story-device', accessToken: 'story-token' },
    signingOut: false,
    onSignOut: fn(),
  },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    mocked(getProfile).mockResolvedValue({
      id: 'test-user',
      name: 'Alex',
      isAdministrator: false,
      canEdit: true,
      hasPassword: true,
      imageTag: null,
      google: null,
    })
    navigateApp(
      {
        filter: 'all',
        search: '',
        media: undefined,
        play: undefined,
        collection: undefined,
        sort: undefined,
      },
      'replace',
    )
    mocked(getMediaDetails)
      .mockReset()
      .mockImplementation(async (_base, _session, _user, id) => ({
        ...detailedMovie,
        item: homeItems.find((item) => item.id === id) ?? {
          ...detailedMovie.item,
          id,
        },
      }))
    mocked(getMediaRelations).mockReset().mockResolvedValue(detailedRelations)
    mocked(mediaRequest)
      .mockReset()
      .mockImplementation(
        async (_session, path) =>
          (path.includes('/providers')
            ? detailedProviders
            : detailedReviews) as never,
      )
    let libraryItems = [...homeItems]
    let resumeItems = [...homeResume]
    mocked(getCollection)
      .mockReset()
      .mockImplementation(async (_url, _session, _user, id) => {
        const collection = collectionFixtures.find((item) => item.id === id)
        if (!collection) throw new Error('Collection indisponible')
        return collection
      })
    mocked(getCollectionsPage)
      .mockReset()
      .mockImplementation(
        async (_url, _session, _user, _start, search = '') => {
          const items = collectionFixtures.filter((item) =>
            item.title.toLowerCase().includes(search.toLowerCase()),
          )
          return { items, total: items.length }
        },
      )
    mocked(setMediaWatched)
      .mockReset()
      .mockImplementation(async (_url, _session, _user, id, watched) => {
        libraryItems = libraryItems.map((item) =>
          item.id === id ? { ...item, watched } : item,
        )
        resumeItems = resumeItems.filter((item) => item.id !== id)
        return watched
      })
    mocked(getHeroPreview).mockReset().mockResolvedValue(null)
    mocked(setMediaFavorite)
      .mockReset()
      .mockImplementation(async (_url, _session, _user, id, favorite) => {
        libraryItems = libraryItems.map((item) =>
          item.id === id ? { ...item, favorite } : item,
        )
        resumeItems = resumeItems.map((item) =>
          item.id === id ? { ...item, favorite } : item,
        )
        return favorite
      })
    mocked(getLibraryPage)
      .mockReset()
      .mockImplementation(async (_url, _session, _user, filter, search) => {
        const items = libraryItems.filter(
          (item) =>
            (filter === 'all' ||
              filter === 'collections' ||
              (filter === 'favorites'
                ? item.favorite
                : filter === 'movies'
                  ? item.kind === 'Film'
                  : item.kind === 'Série')) &&
            item.title.toLowerCase().includes(search.toLowerCase()),
        )
        return { items, total: items.length }
      })
    mocked(getResumeItems)
      .mockReset()
      .mockImplementation(async () => resumeItems)
  },
} satisfies Meta<typeof HomeScreen>
export default meta
type Story = StoryObj<typeof meta>
export const InfiniteCatalogue: Story = {
  name: 'Catalogue — pagination automatique et reprise après erreur',
  beforeEach: () => {
    const items = Array.from({ length: 108 }, (_, index) => ({
      ...homeItems[index % homeItems.length],
      id: 'page-' + index,
      title: 'Catalogue ' + (index + 1),
    }))
    let fail = true
    mocked(getResumeItems).mockResolvedValue([])
    mocked(getLibraryPage).mockImplementation(
      async (_url, _session, _user, _filter, _search, start = 0) => {
        if (start === 72 && fail) {
          fail = false
          throw new Error('Page temporairement indisponible')
        }
        return { items: items.slice(start, start + 36), total: items.length }
      },
    )
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelector('.virtual-media-grid'),
      ).toBeInTheDocument(),
    )
    const next = () => window.scrollTo(0, document.documentElement.scrollHeight)
    next()
    await waitFor(() =>
      expect(
        mocked(getLibraryPage).mock.calls.some((call) => call[5] === 36),
      ).toBe(true),
    )
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[aria-posinset="37"]'),
      ).toBeInTheDocument(),
    )
    next()
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible())
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() =>
      expect(canvasElement.querySelector('.home-more')).not.toBeInTheDocument(),
    )
    next()
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Catalogue 108' }),
      ).toBeVisible(),
    )
    await expect(
      canvasElement.querySelectorAll('.virtual-media-grid [role="listitem"]')
        .length,
    ).toBeLessThan(60)
    await expect(
      mocked(getLibraryPage).mock.calls.filter((call) => call[5] === 36),
    ).toHaveLength(1)
  },
}
export const Connected: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('searchbox'), 'Signal')
    await waitFor(() =>
      expect(mocked(getLibraryPage)).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ deviceId: 'story-device' }),
        'test-user',
        'all',
        'Signal',
        0,
        expect.any(AbortSignal),
        { sort: 'recent', collectionId: undefined },
      ),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Signal' }),
      ).toBeVisible(),
    )
  },
}

export const LibraryPages: Story = {
  name: 'Pages — favoris, collections, tri et historique',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Favoris' }))
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Vos favoris.' }),
      ).toBeVisible(),
    )
    await waitFor(() =>
      expect(
        mocked(getLibraryPage).mock.calls.some(
          (call) => call[3] === 'favorites',
        ),
      ).toBe(true),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Films' }))
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: 'Les films.' })).toBeVisible(),
    )
    await userEvent.click(
      canvas.getByRole('combobox', { name: 'Trier les titres' }),
    )
    await userEvent.click(
      await within(document.body).findByRole('option', {
        name: 'Année de sortie',
      }),
    )
    await waitFor(() =>
      expect(
        mocked(getLibraryPage).mock.calls.some(
          (call) => call[3] === 'movies' && call[7]?.sort === 'year',
        ),
      ).toBe(true),
    )
    await expect(new URLSearchParams(location.search).get('sort')).toBe('year')
    await userEvent.click(canvas.getByRole('button', { name: 'Collections' }))
    const collection = await canvas.findByRole('button', {
      name: new RegExp(collectionFixtures[0].title),
    })
    await userEvent.click(collection)
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', {
          name: collectionFixtures[0].title + '.',
        }),
      ).toBeVisible(),
    )
    await waitFor(() =>
      expect(
        mocked(getLibraryPage).mock.calls.some(
          (call) => call[7]?.collectionId === collectionFixtures[0].id,
        ),
      ).toBe(true),
    )
    await expect(new URLSearchParams(location.search).get('collection')).toBe(
      collectionFixtures[0].id,
    )
    history.back()
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Les collections.' }),
      ).toBeVisible(),
    )
    history.forward()
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', {
          name: collectionFixtures[0].title + '.',
        }),
      ).toBeVisible(),
    )
  },
}
export const SearchExperience: Story = {
  name: 'Recherche déployée — clavier, fiche et retour à l’accueil',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole('searchbox')
    await waitFor(() =>
      expect(canvasElement.querySelector('.home-hero')).toBeInTheDocument(),
    )
    const initialCalls = mocked(getLibraryPage).mock.calls.filter(
      (call) => !call[4],
    ).length
    await userEvent.click(input)
    await expect(canvasElement.querySelector('.home-topbar')).toHaveAttribute(
      'data-search',
      'true',
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Les ajouts récents' }),
      ).toBeVisible(),
    )
    await userEvent.type(input, 'Signal')
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Signal' }),
      ).toHaveClass('media-tile-select'),
    )
    await userEvent.keyboard('{ArrowDown}')
    await expect(
      canvas.getByRole('button', { name: 'Voir la fiche de Signal' }),
    ).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible())
    await userEvent.click(
      canvas.getByRole('button', { name: 'Fermer la fiche' }),
    )
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await expect(
      canvas.getByRole('button', { name: 'Voir la fiche de Signal' }),
    ).toHaveFocus()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Fermer la recherche' }),
    )
    await expect(input).toHaveFocus()
    await expect(input).toHaveValue('')
    await expect(new URLSearchParams(location.search).has('q')).toBe(false)
    await expect(
      mocked(getLibraryPage).mock.calls.filter((call) => !call[4]),
    ).toHaveLength(initialCalls)
    // Closing while the input keeps focus must still allow a fresh click to open it.
    await userEvent.click(input)
    await expect(canvasElement.querySelector('.home-topbar')).toHaveAttribute(
      'data-search',
      'true',
    )
    await userEvent.type(input, 'Titre absent')
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Aucun titre trouvé.' }),
      ).toBeVisible(),
    )
    await userEvent.keyboard('{Escape}')
    await expect(canvasElement.querySelector('.home-topbar')).toHaveAttribute(
      'data-search',
      'false',
    )
  },
}
export const SearchPagination: Story = {
  name: 'Recherche — erreur, reprise et pagination',
  beforeEach: () => {
    let fail = true
    const items = Array.from({ length: 72 }, (_, i) => ({
      ...homeItems[i % homeItems.length],
      id: 'search-' + i,
      title: 'Signal ' + (i + 1),
    }))
    mocked(getLibraryPage).mockImplementation(
      async (_base, _session, _user, _filter, search, start) => {
        if (!search) return { items: homeItems, total: homeItems.length }
        if (fail) {
          fail = false
          throw new Error('Recherche indisponible')
        }
        return { items: items.slice(start, start + 36), total: items.length }
      },
    )
  },
  play: async ({ canvas, userEvent, canvasElement }) => {
    await userEvent.type(canvas.getByRole('searchbox'), 'Signal')
    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent(
        'La recherche est indisponible.',
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Signal 1' }),
      ).toBeVisible(),
    )
    window.scrollTo(0, document.documentElement.scrollHeight)
    await waitFor(() =>
      expect(
        mocked(getLibraryPage).mock.calls.some(
          (call) => call[4] === 'Signal' && call[5] === 36,
        ),
      ).toBe(true),
    )
    await waitFor(() =>
      expect(canvasElement.querySelector('.home-more')).not.toBeInTheDocument(),
    )
    window.scrollTo(0, document.documentElement.scrollHeight)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Signal 72' }),
      ).toBeVisible(),
    )
    await expect(
      mocked(getLibraryPage).mock.calls.filter(
        (call) => call[4] === 'Signal' && call[5] === 36,
      ),
    ).toHaveLength(1)
  },
}
export const SearchLatestQuery: Story = {
  name: 'Recherche — dernière saisie prioritaire',
  beforeEach: () => {
    mocked(getLibraryPage).mockImplementation(
      async (_base, _session, _user, _filter, search) => {
        if (search)
          await new Promise((resolve) =>
            setTimeout(resolve, search === 'Signal' ? 900 : 20),
          )
        const items = homeItems.filter((item) =>
          item.title.toLowerCase().includes(search.toLowerCase()),
        )
        return { items, total: items.length }
      },
    )
  },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('searchbox')
    await userEvent.type(input, 'Signal')
    await waitFor(() =>
      expect(
        mocked(getLibraryPage).mock.calls.some((call) => call[4] === 'Signal'),
      ).toBe(true),
    )
    await userEvent.clear(input)
    await userEvent.type(input, 'Orbital')
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Orbital' }),
      ).toBeVisible(),
    )
    await expect(new URLSearchParams(location.search).get('q')).toBe('Orbital')
    await expect(
      mocked(getLibraryPage).mock.calls.find(
        (call) => call[4] === 'Signal',
      )?.[6]?.aborted,
    ).toBe(true)
    await expect(
      canvas.queryByRole('button', { name: 'Voir la fiche de Signal' }),
    ).not.toBeInTheDocument()
  },
}
export const UrlNavigation: Story = {
  beforeEach: () =>
    navigateApp(
      { filter: 'movies', search: 'Signal', media: homeItems[1].id },
      'replace',
    ),
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('searchbox')).toHaveValue('Signal')
    const close = await canvas.findByRole('button', { name: 'Fermer la fiche' })
    await waitFor(() => expect(close).toBeVisible())
    await userEvent.click(close)
    await waitFor(() =>
      expect(
        canvas.queryByRole('button', { name: 'Fermer la fiche' }),
      ).not.toBeInTheDocument(),
    )
    await expect(new URLSearchParams(location.search).has('media')).toBe(false)
    history.back()
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Fermer la fiche' }),
      ).toBeVisible(),
    )
    history.forward()
    await waitFor(() =>
      expect(
        canvas.queryByRole('button', { name: 'Fermer la fiche' }),
      ).not.toBeInTheDocument(),
    )
    history.back()
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Fermer la fiche' }),
      ).toBeVisible(),
    )
  },
}

export const RestoredPlayback: Story = {
  beforeEach: () => {
    navigateApp(
      {
        filter: 'movies',
        media: homeItems[1].id,
        play: homeItems[1].id,
        time: 83,
        paused: true,
      },
      'replace',
    )
    mocked(createPlaybackApi).mockReturnValue({
      sdk: createJellyfinApi(
        new URL('/jellyfin', location.origin).href,
        'story-device',
        'story-token',
      ),
      resolve: fn(() => new Promise(() => {})),
      details: async () => ({}),
      segments: async () => [],
    } as unknown as PlaybackApi)
  },
  play: async ({ canvas, args }) => {
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Retour au catalogue' }),
      ).toBeVisible(),
    )
    await expect(
      createPlaybackApi(args.session, args.user.id).resolve,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: homeItems[1].id, start: 83 }),
      expect.any(AbortSignal),
    )
    await expect(mocked(getLibraryPage)).not.toHaveBeenCalled()
    await expect(mocked(getResumeItems)).not.toHaveBeenCalled()
    await expect(
      canvas.queryByRole('button', { name: 'Fermer la fiche' }),
    ).not.toBeInTheDocument()
    await expect(new URLSearchParams(location.search).get('t')).toBe('83')
  },
}

export const PlayerReturnScroll: Story = {
  beforeEach: RestoredPlayback.beforeEach,
  render: (args) => (
    <StrictMode>
      <HomeScreen {...args} />
    </StrictMode>
  ),
  play: async ({ canvas, userEvent }) => {
    for (let cycle = 0; cycle < 3; cycle++) {
      if (cycle)
        navigateApp({ media: homeItems[1].id, play: homeItems[1].id, time: 83 })
      await waitFor(() =>
        expect(
          canvas.getByRole('button', { name: 'Retour au catalogue' }),
        ).toBeVisible(),
      )
      await userEvent.click(
        canvas.getByRole('button', { name: 'Retour au catalogue' }),
      )
      await waitFor(() =>
        expect(
          canvas.getByRole('button', { name: 'Fermer la fiche' }),
        ).toBeVisible(),
      )
      await expect(getComputedStyle(document.body).overflowY).toBe('hidden')
      await userEvent.click(
        canvas.getByRole('button', { name: 'Fermer la fiche' }),
      )
      await waitFor(() =>
        expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
      )
      await expect(getComputedStyle(document.body).overflowY).not.toBe('hidden')
    }
  },
}

export const UnavailableRoute: Story = {
  beforeEach: () => {
    navigateApp({ play: 'removed-movie', time: 120 }, 'replace')
    mocked(getMediaDetails).mockRejectedValue(new Error('Unavailable'))
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Ce média est indisponible',
    )
    await expect(canvas.queryByRole('searchbox')).not.toBeInTheDocument()
    await expect(mocked(getLibraryPage)).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: /^Fermer$/ }))
    await waitFor(() =>
      expect(canvas.queryByRole('alert')).not.toBeInTheDocument(),
    )
    await expect(new URLSearchParams(location.search).has('play')).toBe(false)
    await expect(await canvas.findByRole('searchbox')).toBeInTheDocument()
  },
}
export const CardActions: Story = {
  play: async ({ canvas, userEvent }) => {
    const tile = await canvas.findByRole('button', {
      name: 'Voir la fiche de ' + homeItems[0].title,
    })
    tile.scrollIntoView()
    const first = await canvas.findByRole('article', {
      name: homeItems[0].title,
    })
    await userEvent.hover(first)
    await waitFor(() => expect(first).toHaveAttribute('data-active', 'true'))
    await userEvent.click(
      within(first).getByRole('button', { name: 'Ajouter aux favoris' }),
    )
    await waitFor(() =>
      expect(
        within(first).getByRole('button', { name: 'Retirer des favoris' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    )
    const hero = within(canvas.getByRole('region', { name: 'À l’affiche' }))
    await expect(
      hero.getByRole('button', { name: 'Retirer des favoris' }),
    ).toHaveAttribute('aria-pressed', 'true')
    const resume = canvas.getAllByRole('article', {
      name: homeResume[0].title,
    })[0]
    await userEvent.hover(resume)
    await waitFor(() => expect(resume).toHaveAttribute('data-active', 'true'))
    await userEvent.click(
      within(resume).getByRole('button', { name: 'Marquer comme vu' }),
    )
    await waitFor(() =>
      expect(
        canvas.getAllByRole('article', {
          name: homeResume[0].title,
        }),
      ).toHaveLength(1),
    )
    await expect(
      within(
        canvas.getByRole('article', { name: homeResume[0].title }),
      ).getByLabelText('Déjà vu'),
    ).toBeVisible()
  },
}
