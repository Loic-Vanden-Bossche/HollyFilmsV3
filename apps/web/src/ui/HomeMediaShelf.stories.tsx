import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { homeShelfItems } from '../home-fixtures.ts'
import { buildHomeShelves } from '../home-shelves.ts'
import { HomeMediaShelf } from './HomeMediaShelf.tsx'

const meta = {
  title: 'UI/Rangée de l’accueil',
  component: HomeMediaShelf,
  parameters: { layout: 'fullscreen' },
  args: {
    id: 'acclaimed',
    title: 'Les films les mieux notés',
    items: buildHomeShelves(homeShelfItems).find(
      (shelf) => shelf.id === 'acclaimed',
    )!.items,
    onSelect: fn(),
  },
  decorators: [
    function Shelf(Story) {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <div className="home-page">
            <div className="home-content home-shelves">
              <Story />
            </div>
          </div>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof HomeMediaShelf>
export default meta
type Story = StoryObj<typeof meta>

export const Ranked: Story = {
  name: 'Les dix places du classement',
  play: async ({ canvas, userEvent, args }) => {
    const ranking = canvas.getByRole('region', { name: args.title })
    const ranks = ranking.querySelectorAll('.home-rank-number')
    await expect(Array.from(ranks, (rank) => rank.textContent)).toEqual(
      Array.from({ length: 10 }, (_, index) => String(index + 1)),
    )
    const track = ranking.querySelector<HTMLElement>('.home-shelf-track')!
    const next = ranking.querySelector<HTMLButtonElement>(
      '.horizontal-rail-arrow--next',
    )!
    await userEvent.click(next)
    await waitFor(() => expect(track.scrollLeft).toBeGreaterThan(0))
    track.scrollTo({ left: track.scrollWidth, behavior: 'instant' })
    await waitFor(() => expect(next).toBeDisabled())
    const last = within(ranking).getAllByRole('article').at(-1)!
    const cover = last.getBoundingClientRect()
    await expect(cover.width / cover.height).toBeCloseTo(16 / 9, 1)
    await expect(cover.right).toBeLessThanOrEqual(
      document.documentElement.clientWidth + 1,
    )
    const artwork = last.querySelector<HTMLImageElement>(
      '.artwork-preview-trigger .media-artwork img',
    )!
    await waitFor(() => expect(artwork.naturalWidth).toBeGreaterThan(0))
    await Promise.all(
      artwork.parentElement!.getAnimations().map((entry) => entry.finished),
    )
    const image = artwork.getBoundingClientRect()
    await expect(image.width).toBeCloseTo(cover.width, 0)
    await expect(image.height).toBeCloseTo(cover.height, 0)
    await userEvent.click(
      within(last).getByRole('button', { name: /^Voir la fiche/ }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith(args.items[9])
    track.scrollTo({ left: 0, behavior: 'instant' })
  },
}

export const RankedPreview: Story = {
  name: 'Classement — aperçu sous la vignette',
  args: { onPlay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const item = args.items[0]
    const card = canvas.getByRole('article', { name: item.title })
    const trigger = within(card).getByRole('button', { name: /^Voir la fiche/ })
    await expect(card.querySelector('.artwork-watermark')).toBeVisible()
    await waitFor(() =>
      expect(trigger.querySelector('img')).toHaveAttribute('src', item.thumb),
    )
    await userEvent.pointer([{ keys: '[TouchA]', target: trigger }])
    const panel = await within(card).findByRole('group', { name: item.title })
    await expect(panel).toHaveAttribute('data-presentation', 'ranked')
    const art = panel.querySelector('.artwork-preview-hero')!
    const heading = within(panel).getByRole('heading', { name: item.title })
    const play = within(panel).getByRole('button', {
      name: /^(Lire|Reprendre) /,
    })
    await expect(art.querySelector('.artwork-watermark')).toBeVisible()
    await waitFor(() => {
      expect(art.querySelector('img')).toHaveAttribute('src', item.thumb)
      const frame = art.getBoundingClientRect()
      expect(frame.width / frame.height).toBeCloseTo(16 / 9, 1)
      expect(heading.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        frame.bottom - 1,
      )
      expect(play.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        frame.bottom - 1,
      )
    })
    await expect(args.onSelect).not.toHaveBeenCalled()
    await userEvent.click(play)
    await expect(args.onPlay).toHaveBeenCalledWith(item, true)
    await userEvent.unhover(card)
    await userEvent.hover(card)
    await within(card).findByRole('heading', { name: item.title })
  },
}
