import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, mocked, waitFor } from 'storybook/test'
import { getHeroPreview } from '@hollyfilms/shared/library'
import type { MediaItem } from '@hollyfilms/shared/library'
import { HomeCarousel } from './HomeCarousel.tsx'
import { homeItems } from '../home-fixtures.ts'
import previewVideo from '../assets/hero-preview.webm?url'
import '../home.css'

const meta = {
  title: 'UI/Carrousel cinéma',
  component: HomeCarousel,
  parameters: { layout: 'fullscreen' },
  args: {
    items: homeItems,
    onSelect: fn(),
    onPlay: fn(),
    onFavorite: fn<(item: MediaItem, favorite: boolean) => Promise<boolean>>(
      async (_item, favorite) => favorite,
    ),
  },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <div className="home-page">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: () => {
    mocked(getHeroPreview).mockReset().mockResolvedValue(null)
  },
  render: function Render(args) {
    const [items, setItems] = useState(args.items)
    return (
      <HomeCarousel
        {...args}
        items={items}
        onFavorite={async (item, favorite) => {
          const saved = await args.onFavorite!(item, favorite)
          setItems((current) =>
            current.map((value) =>
              value.id === item.id ? { ...value, favorite: saved } : value,
            ),
          )
          return saved
        }}
      />
    )
  },
} satisfies Meta<typeof HomeCarousel>
export default meta
type Story = StoryObj<typeof meta>

export const Cinema: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Titre suivant' }))
    await waitFor(() =>
      expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
        args.items[1].title,
      ),
    )
    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() =>
      expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
        args.items[0].title,
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Lire' }))
    await expect(args.onPlay).toHaveBeenCalledWith(args.items[0], true)
    await userEvent.click(canvas.getByRole('button', { name: 'Voir la fiche' }))
    await expect(args.onSelect).toHaveBeenCalledWith(args.items[0])
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Retirer des favoris' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    )
    await expect(args.onFavorite).toHaveBeenCalledWith(args.items[0], true)
  },
}
export const VideoPreview: Story = {
  args: {
    session: { accessToken: 'story-token', deviceId: 'story-device' },
    userId: 'story-user',
  },
  beforeEach: () => {
    mocked(getHeroPreview).mockResolvedValue({
      kind: 'video',
      url: previewVideo,
    })
  },
}
export const PreviewUnavailable: Story = {
  args: VideoPreview.args,
  beforeEach: () => {
    mocked(getHeroPreview).mockRejectedValue(new Error('Preview unavailable'))
  },
}
export const MissingArtwork: Story = {
  args: {
    items: [
      {
        ...homeItems[0],
        logo: undefined,
        backdrop: undefined,
        poster: undefined,
      },
    ],
  },
}
export const BrokenLogo: Story = {
  args: { items: [{ ...homeItems[0], logo: 'data:image/png;base64,broken' }] },
}
export const FavoriteFailure: Story = {
  args: {
    onFavorite: fn<(item: MediaItem, favorite: boolean) => Promise<boolean>>(
      async () => {
        throw new Error('Unavailable')
      },
    ),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    )
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Impossible de modifier les favoris',
    )
    await expect(args.onFavorite).toHaveBeenCalled()
    await expect(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    ).toHaveAttribute('aria-pressed', 'false')
  },
}
export const Suspended: Story = {
  args: { ...VideoPreview.args, active: false },
}
export const TwentyTitles: Story = {
  name: '20 titres — pagination sur une ligne',
  args: {
    active: false,
    items: Array.from({ length: 20 }, (_, index) => ({
      ...homeItems[index % homeItems.length],
      id: 'pagination-' + index,
      title: 'Film ' + (index + 1),
    })),
  },
}

export const StagedEntrance: Story = {
  name: 'À l’affiche — entrée en cascade',
  play: async ({ canvasElement }) => {
    const stages = canvasElement.querySelectorAll('[data-hero-stage]')
    await expect(stages.length).toBeGreaterThanOrEqual(5)
    await waitFor(() =>
      expect(canvasElement.querySelector('.home-hero-actions')).toHaveStyle({
        opacity: '1',
      }),
    )
  },
}

export const Preloading: Story = {
  name: 'Préchargement invisible puis entrée en cascade',
  args: { reveal: false, onReady: fn() },
  render: function Render(args) {
    const [reveal, setReveal] = useState(args.reveal)
    return (
      <>
        <button type="button" onClick={() => setReveal(true)}>
          Révéler la sélection
        </button>
        <HomeCarousel {...args} reveal={reveal} />
      </>
    )
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const hero = canvasElement.querySelector('.home-carousel')!
    await waitFor(() =>
      expect(args.onReady).toHaveBeenCalledWith(args.items[0].id),
    )
    await expect(hero).toHaveAttribute('data-revealed', 'false')
    await expect(hero.querySelector('.home-hero-actions')).toHaveStyle({
      opacity: '0',
    })
    await expect(
      hero.querySelector('.media-artwork-fallback'),
    ).not.toBeInTheDocument()
    const image = hero.querySelector('.hero-backdrop img')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Révéler la sélection' }),
    )
    await expect(hero.querySelector('.home-hero-actions')).not.toHaveStyle({
      opacity: '1',
    })
    await waitFor(() =>
      expect(hero.querySelector('.home-hero-actions')).toHaveStyle({
        opacity: '1',
      }),
    )
    await expect(hero.querySelector('.hero-backdrop img')).toBe(image)
  },
}
