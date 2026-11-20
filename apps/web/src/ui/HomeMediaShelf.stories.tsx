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

export const OffscreenKeyboard: Story = {
  name: 'Rangée hors écran accessible au clavier',
  decorators: [
    (Story) => (
      <div style={{ paddingBlockStart: '200vh' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas, userEvent, args }) => {
    const section = canvas.getByRole('region', { name: args.title })
    const track = section.querySelector<HTMLElement>('.home-shelf-track')!
    const railHeight = track.getBoundingClientRect().height
    const scrollWidth = track.scrollWidth
    const first = within(section).getByRole('article', {
      name: args.items[0].title,
    })
    await expect(first.querySelector('.artwork-preview-surface')).toBeNull()
    within(first).getByRole('button').focus({ preventScroll: true })
    await waitFor(() =>
      expect(section.querySelector('.artwork-preview-trigger')).toHaveFocus(),
    )
    await expect(track.getBoundingClientRect().height).toBeCloseTo(
      railHeight,
      0,
    )
    await expect(track.scrollWidth).toBe(scrollWidth)
    await userEvent.keyboard('{Enter}')
    await expect(args.onSelect).toHaveBeenCalledWith(args.items[0])
  },
}

export const OffscreenPointer: Story = {
  name: 'Première interaction sur une rangée hors écran',
  decorators: OffscreenKeyboard.decorators,
  play: async ({ canvas, args }) => {
    const section = canvas.getByRole('region', { name: args.title })
    const slot = section.querySelector('.home-shelf-cover-slot')!
    slot.dispatchEvent(
      new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
    )
    await within(section).findByRole('group', { name: args.items[0].title })

    // A browser may retarget only the final click when a touch starts on a
    // placeholder. The first tap must still open the preview for this title.
    const next = within(section).getByRole('article', {
      name: args.items[1].title,
    })
    next.querySelector('button')!.dispatchEvent(
      new PointerEvent('click', {
        bubbles: true,
        detail: 1,
        pointerType: 'touch',
      }),
    )
    await within(next).findByRole('group', { name: args.items[1].title })
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}

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
    const play = within(panel).getByRole('button', {
      name: /^(Lire|Reprendre) /,
    })
    await waitFor(() =>
      expect(art.querySelector(':scope > .artwork-watermark')).toBeVisible(),
    )
    await expect(panel.querySelector('.artwork-preview-title')).toBeNull()
    await waitFor(() => {
      expect(art.querySelector('img')).toHaveAttribute('src', item.thumb)
      const frame = art.getBoundingClientRect()
      expect(frame.width / frame.height).toBeCloseTo(16 / 9, 1)
      const content = panel.querySelector('.artwork-preview-content')!
      const gap = play.getBoundingClientRect().top - frame.bottom
      expect(gap).toBeGreaterThanOrEqual(0)
      expect(gap).toBeLessThanOrEqual(
        parseFloat(getComputedStyle(content).paddingTop) + 1,
      )
    })
    await expect(args.onSelect).not.toHaveBeenCalled()
    await userEvent.click(play)
    await expect(args.onPlay).toHaveBeenCalledWith(item, true)
    await userEvent.unhover(card)
    await userEvent.hover(card)
    await within(card).findByRole('group', { name: item.title })
  },
}

export const RankedFallbackTitles: Story = {
  name: 'Classement — titre sur le décor de remplacement',
  args: {
    onPlay: fn(),
    items: [
      { ...homeShelfItems[0], thumb: undefined },
      {
        ...homeShelfItems[1],
        thumb: 'data:image/png;base64,AAAA',
        logo: undefined,
      },
    ],
  },
  play: async ({ canvas, userEvent, args }) => {
    // Use the keyboard so opening and dismissing each preview also checks focus.
    await userEvent.tab()
    for (const item of args.items) {
      const card = canvas.getByRole('article', { name: item.title })
      const trigger = within(card).getByRole('button', {
        name: /^Voir la fiche/,
      })
      trigger.focus()
      const panel = await within(card).findByRole('group', { name: item.title })
      const art = panel.querySelector<HTMLElement>('.artwork-preview-hero')!
      const heading = await within(art).findByRole('heading', {
        name: item.title,
      })
      await expect(
        panel.querySelector('.artwork-preview-content .artwork-preview-title'),
      ).toBeNull()
      await waitFor(() => {
        const backdrop =
          art.querySelector('.artwork-preview-backdrop img') ??
          trigger.querySelector('img')
        expect(backdrop).toHaveAttribute('src', item.backdrop)
        if (item.logo)
          expect(heading.querySelector('img')).toHaveAttribute('src', item.logo)
        else expect(heading).toHaveTextContent(item.title)
        const title = heading.getBoundingClientRect()
        const image = art.getBoundingClientRect()
        expect(title.width).toBeGreaterThan(0)
        expect(title.top).toBeGreaterThanOrEqual(image.top - 1)
        expect(title.bottom).toBeLessThanOrEqual(image.bottom + 1)
      })
      await userEvent.keyboard('{Escape}')
      await expect(trigger).toHaveFocus()
      await waitFor(() =>
        expect(trigger).toHaveAttribute('aria-expanded', 'false'),
      )
    }
    const first = canvas.getByRole('article', { name: args.items[0].title })
    within(first)
      .getByRole('button', { name: /^Voir la fiche/ })
      .focus()
    await within(first).findByRole('heading', { name: args.items[0].title })
  },
}
