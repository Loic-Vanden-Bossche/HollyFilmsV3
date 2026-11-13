import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { MediaCommunity } from './MediaCommunity.tsx'
import { detailedProviders, detailedReviews } from './media-detail-fixtures.ts'
import './media-details.css'
const meta = {
  title: 'UI/Fiche média/Communauté',
  component: MediaCommunity,
  args: {
    providers: detailedProviders,
    reviews: detailedReviews,
    region: 'FR',
    onRegion: fn(),
    page: 1,
    onPage: fn(),
    onSave: fn(async () => {}),
    onDelete: fn(async () => {}),
  },
  decorators: [
    (Story) => (
      <div
        className="media-dialog"
        style={{ padding: 24, maxHeight: 'none', width: '100%' }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MediaCommunity>
export default meta
type Story = StoryObj<typeof meta>
export const Complete: Story = {
  render: function Render(args) {
    const [region, setRegion] = useState(args.region)
    return (
      <MediaCommunity
        {...args}
        region={region}
        onRegion={(value) => {
          args.onRegion(value)
          setRegion(value)
        }}
      />
    )
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Paramètres des disponibilités' }),
    )
    await userEvent.click(canvas.getByLabelText('Pays des disponibilités'))
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('option', {
        name: 'Suisse',
      }),
    )
    await expect(args.onRegion).toHaveBeenCalledWith('CH')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Rechercher une plateforme' }),
    )
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Rechercher une plateforme' }),
      'Disney',
    )
    await expect(canvas.getByText('Disney Plus')).toBeVisible()
    await expect(
      canvas.queryByText('Amazon Prime Video'),
    ).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Lire la suite' }))
    await expect(canvas.getByRole('button', { name: 'Réduire' })).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Écrire une critique' }),
    )
    await userEvent.type(
      canvas.getByLabelText('Ta critique'),
      'Un très beau film.',
    )
    await userEvent.click(canvas.getByLabelText('Ta note sur 10'))
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('option', {
        name: '8.5 / 10',
      }),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Enregistrer' }))
    await expect(args.onSave).toHaveBeenCalledWith('Un très beau film.', 8.5)
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Ton avis a été enregistré.',
    )
  },
}
export const EqualHeightReviews: Story = {
  args: {
    reviews: {
      ...detailedReviews,
      items: detailedReviews.items.map((review, index) => ({
        ...review,
        content:
          index === 1
            ? 'Une belle découverte.'
            : index === 2
              ? 'Une mise en scène remarquable.\n\nDes personnages attachants et une bande originale mémorable.\n\n'.repeat(
                  9,
                )
              : review.content,
      })),
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const cards = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('.detail-review-card'),
    )
    const assertEqualHeights = async () => {
      await waitFor(() => {
        const heights = cards.map((card) => card.offsetHeight)
        expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2)
      })
    }
    await assertEqualHeights()
    const collapsedHeight = cards[0].offsetHeight
    const links = canvas.getAllByRole('button', { name: 'Lire la suite' })
    const bottomGap = (link: HTMLElement) => {
      const card = link.closest<HTMLElement>('.detail-review-card')!
      return card.offsetHeight - link.offsetTop - link.offsetHeight
    }
    await expect(
      Math.abs(bottomGap(links[0]) - bottomGap(links[1])),
    ).toBeLessThan(2)
    await userEvent.click(links[1])
    await waitFor(() =>
      expect(cards[0].offsetHeight).toBeGreaterThan(collapsedHeight),
    )
    await expect(
      cards[2].querySelector('.detail-review-content')?.textContent,
    ).toBe(args.reviews!.items[2].content)
    await assertEqualHeights()
    await userEvent.click(canvas.getByRole('button', { name: 'Réduire' }))
    await assertEqualHeights()
    await expect(cards[0].offsetHeight).toBe(collapsedHeight)
  },
}
export const Loading: Story = {
  args: {
    providers: undefined,
    reviews: undefined,
    providerLoading: true,
    reviewsLoading: true,
  },
}
export const Empty: Story = {
  args: {
    providers: {
      status: 'ready',
      region: 'FR',
      regions: ['FR'],
      providers: [],
    },
    reviews: {
      items: [],
      own: null,
      total: 0,
      hasMore: false,
      external: 'ready',
    },
  },
}
export const Unavailable: Story = {
  args: {
    providerError: true,
    reviewsError: true,
    onRetryProviders: fn(),
    onRetryReviews: fn(),
  },
  play: async ({ canvas, args, userEvent }) => {
    const retries = canvas.getAllByRole('button', { name: 'Réessayer' })
    await userEvent.click(retries[0])
    await userEvent.click(retries[1])
    await expect(args.onRetryProviders).toHaveBeenCalledOnce()
    await expect(args.onRetryReviews).toHaveBeenCalledOnce()
  },
}
export const MissingConfiguration: Story = {
  args: {
    providers: {
      status: 'unconfigured',
      region: 'FR',
      regions: [],
      providers: [],
    },
    reviews: {
      ...detailedReviews,
      items: [],
      total: 0,
      external: 'unconfigured',
    },
  },
}
export const FailedSave: Story = {
  args: {
    onSave: fn(async () => {
      throw new Error('Le serveur est indisponible. Réessaie.')
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Écrire une critique' }),
    )
    await userEvent.type(
      canvas.getByLabelText('Ta critique'),
      'Mon texte doit être conservé.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Enregistrer' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Le serveur est indisponible',
    )
    await expect(canvas.getByLabelText('Ta critique')).toHaveValue(
      'Mon texte doit être conservé.',
    )
  },
}
export const DeleteOwnReview: Story = {
  args: {
    reviews: {
      ...detailedReviews,
      own: { ...detailedReviews.items[0], own: true },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Modifier ma critique' }),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Supprimer mon avis' }),
    )
    await expect(args.onDelete).not.toHaveBeenCalled()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Oui, supprimer' }),
    )
    await waitFor(() => expect(args.onDelete).toHaveBeenCalledOnce())
  },
}
