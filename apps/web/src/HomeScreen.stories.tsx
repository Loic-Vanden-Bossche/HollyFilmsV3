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
import { homeItems, homeResume, homeShelfItems } from './home-fixtures.ts'
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
import { profileFixture } from './profile-fixtures.ts'
import { I18nProvider, useI18n } from './i18n/I18nProvider.tsx'
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
export const FiniteHome: Story = {
  name: 'Accueil — sélections finies jusqu’au pied de page',
  beforeEach: () => {
    mocked(getLibraryPage).mockImplementation(
      async (
        _url,
        _session,
        _user,
        filter,
        _search,
        start,
        _signal,
        options,
      ) => {
        if (start)
          throw new Error('Une rangée de l’accueil a demandé une deuxième page')
        const items = homeShelfItems.filter(
          (item) =>
            filter === 'all' ||
            (filter === 'movies'
              ? item.kind === 'Film'
              : item.kind === 'Série'),
        )
        if (options?.sort === 'rating') {
          // An older film on the ratings page also belongs in the home ranking.
          items.push({
            ...homeShelfItems[0],
            id: 'library-classic',
            title: 'Le Classique',
            rating: 9.8,
          })
          items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        }
        return { items, total: 2000 }
      },
    )
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Tout juste arrivés' })
    await waitFor(() => {
      const calls = mocked(getLibraryPage).mock.calls
      expect(
        calls.some(
          (call) => call[3] === 'movies' && call[7]?.sort === 'rating',
        ),
      ).toBe(true)
      expect(calls.some((call) => call[3] === 'series')).toBe(true)
    })
    const ranking = await canvas.findByRole('region', {
      name: 'Les films les mieux notés',
    })
    await expect(within(ranking).getAllByRole('group')).toHaveLength(10)
    await expect(
      within(ranking).getByRole('group', { name: 'Rang 1 sur 10' }),
    ).toContainElement(
      within(ranking).getByRole('article', { name: 'Le Classique' }),
    )
    const count = canvasElement.querySelectorAll('[data-home-shelf]').length
    const footer = canvasElement.querySelector<HTMLElement>('.home-footer')!
    footer.scrollIntoView({ block: 'end', behavior: 'instant' })
    await waitFor(() =>
      expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        window.innerHeight + 1,
      ),
    )
    await expect(
      canvasElement.querySelector('.virtual-media-grid, .home-more'),
    ).toBeNull()
    await expect(
      canvasElement.querySelectorAll('[data-home-shelf]'),
    ).toHaveLength(count)
    await expect(
      mocked(getLibraryPage).mock.calls.every((call) => !call[5]),
    ).toBe(true)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Tous les films' }),
    )
    await canvas.findByRole('heading', { name: 'Les films.' })
    await expect(new URLSearchParams(location.search).get('sort')).toBe(
      'rating',
    )
    history.back()
    await canvas.findByRole('heading', { name: 'Tout juste arrivés' })
  },
}
export const SharedShelfLink: Story = {
  name: 'Lien vers une sélection pendant le chargement',
  play: async ({ mount, canvas }) => {
    const previousUrl = location.href
    let revealRecent!: () => void
    let revealRanking!: () => void
    const recent = new Promise<void>((resolve) => (revealRecent = resolve))
    const ranking = new Promise<void>((resolve) => (revealRanking = resolve))
    mocked(getLibraryPage).mockImplementation(
      async (
        _url,
        _session,
        _user,
        filter,
        _search,
        _start,
        _signal,
        options,
      ) => {
        await (options?.sort === 'rating' ? ranking : recent)
        return {
          items: homeShelfItems
            .filter((item) =>
              filter === 'series'
                ? item.kind === 'Série'
                : item.kind === 'Film',
            )
            .map((item) => ({ ...item, previewSource: null })),
          total: 2000,
        }
      },
    )
    history.replaceState(history.state, '', '#home-shelf-suspense')
    try {
      await mount()
      await expect(
        canvas.queryByRole('heading', { name: 'Sous tension' }),
      ).toBeNull()
      revealRecent()
      const heading = await canvas.findByRole('heading', {
        name: 'Sous tension',
      })
      const aligned = () => {
        expect(heading).toHaveFocus()
        const margin = parseFloat(getComputedStyle(heading).scrollMarginTop)
        expect(
          Math.abs(heading.getBoundingClientRect().top - margin),
        ).toBeLessThan(1)
      }
      await waitFor(aligned, { timeout: 3000 })
      revealRanking()
      await canvas.findByRole('group', { name: 'Rang 1 sur 10' })
      await waitFor(aligned, { timeout: 3000 })
    } finally {
      revealRecent()
      revealRanking()
      history.replaceState(history.state, '', previousUrl)
    }
  },
}
export const MoviesPagination: Story = {
  name: 'Films — pagination automatique et reprise après erreur',
  beforeEach: () => {
    navigateApp({ filter: 'movies' }, 'replace')
    const items = Array.from({ length: 108 }, (_, index) => ({
      ...homeItems[index % homeItems.length],
      kind: 'Film' as const,
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
        canvasElement.querySelector<HTMLElement>('.virtual-media-grid')
          ?.offsetHeight,
      ).toBeGreaterThan(100),
    )
    const next = () =>
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'instant',
      })
    await waitFor(() => {
      next()
      expect(
        mocked(getLibraryPage).mock.calls.some((call) => call[5] === 36),
      ).toBe(true)
    })
    await waitFor(
      () => {
        next()
        expect(canvas.getByRole('alert')).toBeVisible()
      },
      { timeout: 3000 },
    )
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
  args: {
    user: { id: 'test-user', name: 'Google-example', isAdministrator: false },
  },
  beforeEach: () => {
    mocked(getProfile).mockResolvedValue({
      ...profileFixture,
      id: 'test-user',
      name: 'Jo Martin',
      google: { email: 'jo@example.com', picture: null },
    })
  },
  play: async ({ canvas, userEvent }) => {
    await expect(
      await canvas.findByRole('button', { name: 'Menu du compte : Jo Martin' }),
    ).toBeVisible()
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

function SwitchCatalogueLanguage() {
  const { setPreference } = useI18n()
  return (
    <div>
      <button type="button" onClick={() => setPreference('en')}>
        English
      </button>
      <button type="button" onClick={() => setPreference('fr')}>
        Français
      </button>
    </div>
  )
}

export const LocalizedCatalogue: Story = {
  name: 'Catalogue et fiche selon la langue',
  decorators: [
    (Story) => (
      <I18nProvider initialPreference="zh-Hans">
        <SwitchCatalogueLanguage />
        <Story />
      </I18nProvider>
    ),
  ],
  beforeEach: () => {
    const item = {
      ...homeItems[0],
      id: 'a'.repeat(32),
      title: 'Projet Dernière Chance',
      overview: 'Un résumé français.',
      genres: ['Horreur', 'Thriller'],
      hasTmdb: true,
      thumb: homeResume[0].thumb,
    }
    const original = { ...homeItems[1], title: 'Titre sans traduction' }
    mocked(getLibraryPage).mockResolvedValue({
      items: [item, original],
      total: 2,
    })
    mocked(getResumeItems).mockResolvedValue([item])
    mocked(getMediaDetails).mockResolvedValue({ ...detailedMovie, item })
    mocked(mediaRequest).mockImplementation(async (_session, path) => {
      if (path.startsWith('localizations?')) {
        const locale = new URLSearchParams(path.split('?')[1]).get('locale')
        expect(['en', 'zh-Hans']).toContain(locale)
        return {
          items: {
            [item.id]:
              locale === 'en'
                ? {
                    title: 'Project Hail Mary',
                    overview: 'A science teacher wakes on a spaceship.',
                    poster: homeItems[1].poster,
                    thumb: homeResume[1].thumb,
                    backdrop: homeItems[1].backdrop,
                  }
                : {
                    title: '挽救计划',
                    overview: '一位科学教师在宇宙飞船上醒来。',
                    backdrop: homeItems[1].backdrop,
                  },
          },
          retry: false,
        } as never
      }
      return (
        path.endsWith('/providers?region=FR')
          ? detailedProviders
          : detailedReviews
      ) as never
    })
  },
  play: async ({ canvas, userEvent }) => {
    const resume = await canvas.findByRole('region', { name: '继续观看' })
    const card = await within(resume).findByRole('button', {
      name: '查看《挽救计划》详情',
    })
    await expect(
      (
        await canvas.findAllByRole('button', {
          name: '查看《Titre sans traduction》详情',
        })
      )[0],
    ).toBeInTheDocument()
    card.focus()
    await userEvent.keyboard('{Enter}')
    const dialog = await canvas.findByRole('dialog')
    const title = within(dialog).getByRole('heading', { name: '挽救计划' })
    title.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    await waitFor(() => expect(title).toBeVisible())
    await expect(
      within(dialog).getAllByText('一位科学教师在宇宙飞船上醒来。')[0],
    ).toBeInTheDocument()
    await expect(within(dialog).getAllByText('恐怖').length).toBeGreaterThan(0)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(canvas.getByRole('button', { name: 'English' }))
    const englishCard = await within(resume).findByRole('button', {
      name: 'View details for Project Hail Mary',
    })
    await waitFor(() =>
      expect(englishCard.querySelector('img')).toHaveAttribute(
        'src',
        homeResume[1].thumb,
      ),
    )
    englishCard.focus()
    await userEvent.keyboard('{Enter}')
    const englishDialog = await canvas.findByRole('dialog')
    await expect(
      within(englishDialog).getByRole('heading', { name: 'Project Hail Mary' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        englishDialog.querySelector('.media-detail-poster img'),
      ).toHaveAttribute('src', homeItems[1].poster),
    )
    await userEvent.keyboard('{Escape}')
    await userEvent.click(canvas.getByRole('button', { name: 'Français' }))
    const frenchCard = await within(resume).findByRole('button', {
      name: 'Voir la fiche de Projet Dernière Chance',
    })
    await waitFor(() =>
      expect(frenchCard.querySelector('img')).toHaveAttribute(
        'src',
        homeResume[0].thumb,
      ),
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
    await waitFor(() => {
      canvasElement.querySelector('.catalogue-load-trigger')?.scrollIntoView({
        behavior: 'instant',
        block: 'center',
      })
      expect(
        mocked(getLibraryPage).mock.calls.some(
          (call) => call[4] === 'Signal' && call[5] === 36,
        ),
      ).toBe(true)
    })
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
    const recent = within(
      await canvas.findByRole('region', { name: 'Tout juste arrivés' }),
    )
    const tile = recent.getByRole('button', {
      name: 'Voir la fiche de ' + homeItems[0].title,
    })
    tile.scrollIntoView()
    const first = recent.getByRole('article', {
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
    const continueWatching = within(
      canvas.getByRole('region', { name: 'En cours de lecture' }),
    )
    const resume = continueWatching.getByRole('article', {
      name: homeResume[0].title,
    })
    resume.scrollIntoView({ block: 'center', behavior: 'instant' })
    await userEvent.hover(resume)
    await waitFor(() => expect(resume).toHaveAttribute('data-active', 'true'))
    await userEvent.click(
      within(resume).getByRole('button', { name: 'Marquer comme vu' }),
    )
    await waitFor(() =>
      expect(
        continueWatching.queryByRole('article', {
          name: homeResume[0].title,
        }),
      ).not.toBeInTheDocument(),
    )
    const watched = recent.getByRole('article', { name: homeResume[0].title })
    watched.scrollIntoView({ block: 'center' })
    await userEvent.hover(watched)
    await waitFor(() =>
      expect(within(watched).getByLabelText('Déjà vu')).toBeVisible(),
    )
  },
}
