import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, waitFor } from 'storybook/test'
import type { MediaItem } from '@hollyfilms/shared/library'
import { MediaTile } from './MediaTile.tsx'
import { homeItems, homeResume } from '../home-fixtures.ts'
const meta = {
  title: 'UI/Affiche média',
  component: MediaTile,
  args: { item: homeItems[0], onSelect: fn() },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <div style={{ width: 270, padding: 12 }}>
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /Voir la fiche de/ }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith(args.item)
  },
  render: function Render(args) {
    const [item, setItem] = useState(args.item)
    return (
      <MediaTile
        {...args}
        item={item}
        onFavorite={
          args.onFavorite &&
          (async (_item, favorite) => {
            const value = await args.onFavorite!(_item, favorite)
            setItem((item) => ({ ...item, favorite: value }))
            return value
          })
        }
        onWatched={
          args.onWatched &&
          (async (_item, watched) => {
            const value = await args.onWatched!(_item, watched)
            setItem((item) => ({ ...item, watched: value }))
            return value
          })
        }
      />
    )
  },
} satisfies Meta<typeof MediaTile>
export default meta
type Story = StoryObj<typeof meta>
export const Poster: Story = {}
export const InProgress: Story = { args: { item: homeResume[0], wide: true } }
export const WithoutArtwork: Story = {
  args: { item: { ...homeItems[0], poster: undefined } },
}
export const Actions: Story = {
  args: {
    onFavorite: fn<(item: MediaItem, value: boolean) => Promise<boolean>>(
      async (_item, value) => value,
    ),
    onWatched: fn<(item: MediaItem, value: boolean) => Promise<boolean>>(
      async (_item, value) => value,
    ),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    )
    await expect(args.onFavorite).toHaveBeenCalledWith(args.item, true)
    await expect(
      canvas.getByRole('button', { name: 'Retirer des favoris' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Marquer comme vu' }),
    )
    await waitFor(() => expect(canvas.getByLabelText('Déjà vu')).toBeVisible())
    await expect(args.onWatched).toHaveBeenCalledWith(
      expect.objectContaining({ id: args.item.id }),
      true,
    )
    await expect(args.onSelect).not.toHaveBeenCalled()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Marquer comme non vu' }),
    )
    await waitFor(() =>
      expect(canvas.queryByLabelText('Déjà vu')).not.toBeInTheDocument(),
    )
  },
}
export const Watched: Story = {
  args: {
    ...Actions.args,
    item: { ...homeItems[0], watched: true, favorite: true },
  },
}
export const SaveFailure: Story = {
  args: {
    onFavorite: fn(async () => {
      throw new Error('Offline')
    }),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    )
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Modification impossible',
    )
    await expect(args.onFavorite).toHaveBeenCalled()
    await expect(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    ).toHaveAttribute('aria-pressed', 'false')
  },
}
export const MissingMetadata: Story = {
  args: {
    item: {
      ...homeItems[0],
      quality: undefined,
      criticRating: undefined,
      audioLanguages: [],
      editions: [],
    },
  },
}

export const Keyboard: Story = {
  name: 'Navigation clavier',
  args: Actions.args,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab()
    await expect(
      canvas.getByRole('button', { name: /Voir la fiche de/ }),
    ).toHaveFocus()
    await userEvent.tab()
    const favorite = canvas.getByRole('button', { name: 'Ajouter aux favoris' })
    await expect(favorite).toHaveFocus()
    await waitFor(() => expect(favorite).toBeVisible())
    await userEvent.keyboard('{Enter}')
    await expect(args.onFavorite).toHaveBeenCalledWith(args.item, true)
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}
