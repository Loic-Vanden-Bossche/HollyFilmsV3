import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, waitFor, within } from 'storybook/test'
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
export const RelatedCards: Story = {
  ...Complete,
  name: 'Plus de ce genre — titre, menu et lecture',
  play: async ({ canvas, userEvent, args }) => {
    const rail = canvas.getByRole('region', { name: 'Plus de ce genre' })
    rail.scrollIntoView()
    const card = within(rail).getAllByRole('article')[0]
    await userEvent.hover(card)
    await waitFor(() => expect(card).toHaveAttribute('data-active', 'true'))
    const menu = within(card).getByLabelText(
      'Plus d’actions pour ' + detailedRelations.similar[0].title,
    )
    const title = card.querySelector('.media-tile-title')!
    await expect(title.getBoundingClientRect().right).toBeLessThan(
      menu.getBoundingClientRect().left,
    )
    await userEvent.click(menu)
    await expect(menu.parentElement).toHaveAttribute('open')
    await userEvent.click(
      within(card).getByRole('button', { name: 'Lire depuis le début' }),
    )
    await expect(args.onPlay).toHaveBeenCalledWith(
      detailedRelations.similar[0],
      false,
    )
    await userEvent.click(
      within(card).getByRole('button', { name: /^Voir la fiche$/ }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith(
      detailedRelations.similar[0],
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
export const OpeningAndScroll: Story = {
  ...Complete,
  name: 'Ouverture en séquence et révélations au défilement',
  render: KeyboardClose.render,
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Ouvrir la fiche' })
    await userEvent.click(trigger)
    const dialog = canvas.getByRole('dialog')
    // Scrolling remains available while the entrance is still in progress.
    dialog.scrollTo({ top: 300, behavior: 'instant' })
    await expect(dialog.scrollTop).toBeGreaterThan(0)
    await userEvent.click(canvas.getByRole('button', { name: 'Distribution' }))
    const cast = canvas.getByRole('region', { name: 'Distribution & équipe' })
    await waitFor(
      () =>
        expect(
          getComputedStyle(cast.querySelector('.detail-rail-entry')!).opacity,
        ).toBe('1'),
      { timeout: 2500 },
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Fermer la fiche' }),
    )
    await waitFor(() => expect(args.onClose).toHaveBeenCalledOnce())
    await expect(trigger).toHaveFocus()
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(canvas.getByRole('dialog')).toHaveAttribute('data-phase', 'open'),
    )
  },
}
export const DelayedDetails: Story = {
  ...Complete,
  name: 'Métadonnées reçues après l’ouverture',
  render: function Render(args) {
    const [loaded, setLoaded] = useState(false)
    useEffect(() => {
      const timer = window.setTimeout(() => setLoaded(true), 700)
      return () => window.clearTimeout(timer)
    }, [])
    return (
      <MediaDetails
        {...args}
        detailsData={loaded ? args.detailsData : undefined}
        relationsData={loaded ? args.relationsData : undefined}
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole(
      'button',
      { name: /Maya Laurent/ },
      { timeout: 2500 },
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Distribution' }))
    const cast = canvas.getByRole('region', { name: 'Distribution & équipe' })
    await waitFor(
      () =>
        expect(
          getComputedStyle(cast.querySelector('.detail-rail-entry')!).opacity,
        ).toBe('1'),
      { timeout: 2500 },
    )
  },
}
export const ScrollTracking: Story = {
  ...Complete,
  name: 'Navigation synchronisée avec le défilement',
  play: async ({ canvas, userEvent }) => {
    const dialog = canvas.getByRole('dialog')
    const nav = canvas.getByRole('navigation', { name: 'Sections de la fiche' })
    await waitFor(() => expect(dialog).toHaveAttribute('data-phase', 'open'))
    const sections = [
      ['detail-providers', 'Disponibilités'],
      ['detail-reviews', 'Critiques'],
      ['detail-cast', 'Distribution'],
      ['detail-scenes', 'Scènes'],
      ['detail-related', 'À découvrir'],
      ['detail-cast', 'Distribution'],
      ['detail-providers', 'Disponibilités'],
    ]
    for (const [id, name] of sections) {
      dialog
        .querySelector('#' + id)!
        .scrollIntoView({ behavior: 'instant', block: 'start' })
      await waitFor(() =>
        expect(within(nav).getByRole('button', { name })).toHaveAttribute(
          'aria-current',
          'location',
        ),
      )
      await expect(
        nav.querySelectorAll('[aria-current="location"]'),
      ).toHaveLength(1)
    }
    await userEvent.click(within(nav).getByRole('button', { name: 'Scènes' }))
    await waitFor(
      () =>
        expect(
          within(nav).getByRole('button', { name: 'Scènes' }),
        ).toHaveAttribute('aria-current', 'location'),
      { timeout: 2000 },
    )
    dialog.scrollTo({ top: dialog.scrollHeight, behavior: 'instant' })
    await waitFor(() =>
      expect(
        within(nav).getByRole('button', { name: 'À découvrir' }),
      ).toHaveAttribute('aria-current', 'location'),
    )
    dialog.scrollTo({ top: 0, behavior: 'instant' })
    await waitFor(() =>
      expect(
        within(nav).getByRole('button', { name: 'Présentation' }),
      ).toHaveAttribute('aria-current', 'location'),
    )
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
