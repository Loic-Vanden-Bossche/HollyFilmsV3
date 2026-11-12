import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, waitFor } from 'storybook/test'
import { MediaDetails } from './MediaDetails.tsx'
import { homeItems, homeResume } from '../home-fixtures.ts'
import {
  detailedMovie,
  detailedRelations,
  detailedProviders,
  detailedReviews,
} from './media-detail-fixtures.ts'
const meta = {
  title: 'UI/Fiche média',
  component: MediaDetails,
  args: { item: homeItems[0], onClose: fn() },
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
} satisfies Meta<typeof MediaDetails>
export default meta
type Story = StoryObj<typeof meta>
export const Open: Story = {}
export const Complete: Story = {
  name: 'Grande fiche complète — données simulées',
  args: {
    item: detailedMovie.item,
    detailsData: detailedMovie,
    relationsData: detailedRelations,
    providersData: detailedProviders,
    reviewsData: detailedReviews,
    onPlay: fn(),
    onSelect: fn(),
    onFavorite: fn(async (_item, value) => value),
    onWatched: fn(async (_item, value) => value),
    loadRelatedPage: fn(async () => ({
      items: homeItems,
      total: homeItems.length,
    })),
  },
}
export const ChaptersAndCollection: Story = {
  ...Complete,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Scènes' }))
    await userEvent.click(
      canvas.getByRole('button', { name: 'Lire Un signal inconnu à 6:24' }),
    )
    await expect(args.onPlay).toHaveBeenCalledWith(
      { ...args.item, playbackPosition: 384 },
      true,
    )
    await userEvent.click(
      canvas.getByRole('button', { name: /^\d+ Au-delà des étoiles/ }),
    )
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Lire la collection' }),
    )
    await expect(args.onPlay).toHaveBeenLastCalledWith(
      homeItems[0],
      true,
      homeItems,
    )
  },
}
export const PersonAndRelated: Story = {
  ...Complete,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Distribution' }))
    await userEvent.click(canvas.getByRole('button', { name: /Maya Laurent/ }))
    await expect(
      await canvas.findByRole('heading', { name: 'Avec Maya Laurent' }),
    ).toBeVisible()
    await expect(args.loadRelatedPage).toHaveBeenCalled()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Fermer cette sélection' }),
    )
    await userEvent.click(
      canvas.getAllByRole('button', { name: 'Ajouter aux favoris' })[0],
    )
    await expect(args.onFavorite).toHaveBeenCalledWith(args.item, true)
  },
}
export const CollectionActions: Story = {
  ...Complete,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'À découvrir' }))
    await userEvent.click(
      canvas.getByRole('button', { name: /^Ajouter aux favoris : Au-delà/ }),
    )
    await waitFor(() =>
      expect(args.onFavorite).toHaveBeenCalledWith(
        detailedRelations.collections[0].item,
        true,
      ),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: /^Lire la collection : Au-delà/ }),
    )
    await waitFor(() =>
      expect(args.onPlay).toHaveBeenCalledWith(homeItems[0], true, homeItems),
    )
  },
}
export const KeyboardClose: Story = {
  ...Complete,
  render: function Render(args) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Ouvrir la fiche</button>
        {open && (
          <MediaDetails
            {...args}
            onClose={() => {
              args.onClose()
              setOpen(false)
            }}
          />
        )}
      </>
    )
  },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Ouvrir la fiche' })
    await userEvent.click(trigger)
    await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(args.onClose).toHaveBeenCalledOnce())
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}
export const RichMetadata: Story = {
  name: 'Qualité, langues et édition',
  args: {
    item: {
      ...homeItems[0],
      quality: '4K',
      audioLanguages: ['fr', 'en'],
      editions: ['Version longue'],
      criticRating: 94,
      watched: true,
    },
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText('4K')).toBeVisible())
    await expect(canvas.getByText('Version longue')).toBeVisible()
    await expect(canvas.getByText('Déjà vu')).toBeVisible()
    await expect(
      canvas.getByLabelText('Langues audio : français, anglais'),
    ).toBeVisible()
  },
}
export const WithoutPoster: Story = {
  args: { item: { ...homeItems[0], poster: undefined } },
}
export const InProgress: Story = { args: { item: homeResume[0] } }
export const Close: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Fermer la fiche' }),
    )
    await waitFor(() => expect(args.onClose).toHaveBeenCalledOnce())
  },
}
export const Play: Story = {
  args: { onPlay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Lire la série' }))
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
  },
}
export const Resume: Story = {
  args: { item: homeResume[0], onPlay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reprendre' }))
    await expect(args.onPlay).toHaveBeenLastCalledWith(args.item, true)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Depuis le début' }),
    )
    await expect(args.onPlay).toHaveBeenLastCalledWith(args.item, false)
  },
}
