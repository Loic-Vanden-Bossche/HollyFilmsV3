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
    (Story, { parameters }) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <div
            style={{
              width: parameters.cardGrid ? 'min(1100px, 100%)' : 270,
              maxWidth: '100%',
              padding: 12,
            }}
          >
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
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    )
    await expect(args.onFavorite).toHaveBeenCalledWith(args.item, true)
    await expect(
      canvasElement.querySelector('.rb-click-spark'),
    ).toHaveAttribute('data-burst', '1')
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
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    )
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Modification impossible',
    )
    await expect(args.onFavorite).toHaveBeenCalled()
    await expect(
      canvasElement.querySelector('.rb-click-spark'),
    ).toHaveAttribute('data-burst', '0')
    await expect(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    ).toHaveAttribute('aria-pressed', 'false')
  },
}
export const MissingMetadata: Story = {
  args: {
    item: {
      ...homeItems[0],
      rating: undefined,
      genres: [],
      overview: '',
      minutes: undefined,
      classification: undefined,
      year: undefined,
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

export const HoverPlay: Story = {
  name: 'Lire au survol',
  args: { ...Actions.args, item: homeItems[1], onPlay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    const play = canvas.getByRole('button', { name: 'Lire ' + args.item.title })
    await waitFor(() => expect(play).toBeVisible())
    await userEvent.click(play)
    await expect(args.onPlay).toHaveBeenCalledOnce()
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
    await expect(args.onSelect).not.toHaveBeenCalled()
    await expect(args.onFavorite).not.toHaveBeenCalled()
    await expect(args.onWatched).not.toHaveBeenCalled()
  },
}

export const ResumePlay: Story = {
  name: 'Reprise directe',
  args: { ...HoverPlay.args, item: homeResume[0], wide: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    await waitFor(() =>
      expect(canvas.getByRole('article')).toHaveAttribute(
        'data-active',
        'true',
      ),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reprendre ' + args.item.title }),
    )
    await expect(canvas.getByText('Encore 1 h 16')).toBeVisible()
    await expect(args.onPlay).toHaveBeenCalledOnce()
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}

export const KeyboardPlay: Story = {
  name: 'Lecture au clavier',
  args: HoverPlay.args,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab()
    await expect(
      canvas.getByRole('button', { name: /Voir la fiche de/ }),
    ).toHaveFocus()
    await userEvent.tab()
    const play = canvas.getByRole('button', { name: 'Lire ' + args.item.title })
    await expect(play).toHaveFocus()
    await waitFor(() => expect(play).toBeVisible())
    await userEvent.keyboard('{Enter}')
    await expect(args.onPlay).toHaveBeenCalledOnce()
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}

export const ExpandedDetails: Story = {
  name: 'Informations au survol',
  args: { ...HoverPlay.args, item: homeItems[0] },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const card = canvas.getByRole('article')
    const before = card.getBoundingClientRect()
    const panel = canvasElement.querySelector('.media-card-expanded')!
    await expect(panel).toHaveAttribute('aria-hidden', 'true')
    await expect(canvas.getByText('Version longue')).not.toBeVisible()
    await expect(canvas.getByText(homeItems[0].title)).toBeVisible()
    await userEvent.hover(card)
    await waitFor(() => expect(panel).toHaveAttribute('aria-hidden', 'false'))
    await waitFor(() =>
      expect(canvas.getByText('Version longue')).toBeVisible(),
    )
    await expect(canvas.getByText('Version longue')).toBeVisible()
    await expect(canvas.getByText('1 h 58')).toBeVisible()
    await expect(card.getBoundingClientRect().height).toBe(before.height)
    await userEvent.unhover(card)
    await waitFor(() => expect(panel).toHaveAttribute('aria-hidden', 'true'))
    await userEvent.tab()
    await waitFor(() => expect(panel).toHaveAttribute('aria-hidden', 'false'))
    await waitFor(() =>
      expect(canvas.getByLabelText(/Langues audio/)).toBeVisible(),
    )
  },
}

export const LongTitle: Story = {
  name: 'Titre long et plusieurs éditions',
  args: {
    ...HoverPlay.args,
    item: {
      ...homeItems[0],
      title: 'Orbital : les dernières transmissions de la station abandonnée',
      editions: ['Version longue restaurée', 'Version cinéma'],
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab()
    await expect(
      canvas.getByRole('button', { name: /Voir la fiche de/ }),
    ).toHaveFocus()
    await expect(canvas.getByText(args.item.title)).toBeVisible()
    await userEvent.keyboard('{Enter}')
    await expect(args.onSelect).toHaveBeenCalledWith(args.item)
  },
}

const gridItems = homeItems.slice(0, 6).map((item, index) =>
  index === 2
    ? {
        ...item,
        title: 'Neon : les dernières transmissions de la station abandonnée',
      }
    : index === 3
      ? {
          ...item,
          rating: undefined,
          criticRating: undefined,
          audioLanguages: [],
          editions: [],
          minutes: undefined,
          genres: [],
        }
      : item,
)

export const CatalogueGrid: Story = {
  name: 'Grille stable au survol',
  parameters: { cardGrid: true },
  args: { onPlay: fn() },
  render: (args) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        alignItems: 'start',
        gap: 24,
      }}
    >
      {gridItems.map((item) => (
        <MediaTile key={item.id} {...args} item={item} />
      ))}
    </div>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const cards = canvas.getAllByRole('article')
    const neighbor = cards[1].getBoundingClientRect()
    const surface = cards[0].querySelector<HTMLElement>('.tilted-card__body')!
    const surfaceBefore = {
      width: surface.clientWidth,
      height: surface.clientHeight,
    }
    for (const card of cards) {
      await expect(card.getBoundingClientRect().height).toBe(neighbor.height)
      await expect(card.getBoundingClientRect().width).toBe(neighbor.width)
    }
    await userEvent.hover(cards[0])
    await waitFor(() => expect(cards[0]).toHaveAttribute('data-active', 'true'))
    await expect({
      width: surface.clientWidth,
      height: surface.clientHeight,
    }).toEqual(surfaceBefore)
    await expect(surface.style.transform).not.toMatch(/scale\(/)
    await expect(cards[1].getBoundingClientRect().toJSON()).toEqual(
      neighbor.toJSON(),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Lire ' + homeItems[0].title }),
    )
    await expect(args.onPlay).toHaveBeenCalledWith(homeItems[0], true)
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}

export const QuietCard: Story = {
  name: 'Carte au repos',
  args: HoverPlay.args,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText(homeItems[1].title)).toBeVisible()
    await expect(
      canvasElement.querySelector('.media-card-expanded'),
    ).toHaveAttribute('aria-hidden', 'true')
    await expect(canvas.getByText('1 h 59')).not.toBeVisible()
  },
}
