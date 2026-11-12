import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, mocked, waitFor, within } from 'storybook/test'
import {
  getLibraryPage,
  getResumeItems,
  getHeroPreview,
  setMediaFavorite,
  setMediaWatched,
} from '@hollyfilms/shared/library'
import { HomeScreen } from './HomeScreen.tsx'
import { homeItems, homeResume } from './home-fixtures.ts'
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
    let libraryItems = [...homeItems]
    let resumeItems = [...homeResume]
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
              (filter === 'movies'
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
export const Connected: Story = {
  play: async ({ canvas, userEvent }) => {
    const skip = canvas.queryByRole('button', { name: 'Passer l’introduction' })
    if (skip) await userEvent.click(skip)
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
      ),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Signal' }),
      ).toBeVisible(),
    )
  },
}
export const CardActions: Story = {
  play: async ({ canvas, userEvent }) => {
    const skip = canvas.queryByRole('button', { name: 'Passer l’introduction' })
    if (skip) await userEvent.click(skip)
    const first = await canvas.findByRole('article', {
      name: homeItems[0].title,
    })
    await userEvent.hover(first)
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
