import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { homeShelfItems } from '../home-fixtures.ts'
import { buildHomeShelves } from '../home-shelves.ts'
import { homeShelfTitle } from '../home-shelf-title.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { HomeExploreRow } from './HomeExploreRow.tsx'
import '../home.css'

const shelves = buildHomeShelves(homeShelfItems).filter(
  (shelf) => shelf.id !== 'recent' && shelf.id !== 'acclaimed',
)
const fourSelections = shelves.filter(
  (shelf) =>
    ['suspense', 'adventure', 'imagination'].includes(shelf.id) ||
    shelf.genre === 'Drame',
)

const meta = {
  title: 'UI/Explorer les sélections',
  component: HomeExploreRow,
  parameters: { layout: 'fullscreen' },
  args: { shelves },
  render: function Render(args) {
    const { t } = useI18n()
    return (
      <main className="home-content home-shelves">
        <HomeExploreRow {...args} />
        {args.shelves.map((shelf) => (
          <section key={shelf.id} className="home-shelf">
            <div className="home-section-header">
              <h2 id={'home-shelf-' + shelf.id} tabIndex={-1}>
                {homeShelfTitle(t, shelf)}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '1rem', overflow: 'hidden' }}>
              {shelf.items.slice(0, 3).map((item) => (
                <img
                  key={item.id}
                  alt={item.title}
                  src={String(item.thumb)}
                  style={{
                    width: 'clamp(120px, 22%, 280px)',
                    aspectRatio: '16 / 9',
                    borderRadius: '0.65rem',
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    )
  },
} satisfies Meta<typeof HomeExploreRow>
export default meta
type Story = StoryObj<typeof meta>

export const Selections: Story = {
  name: 'Accéder à une sélection',
  play: async ({ canvas, userEvent, args }) => {
    const nav = canvas.getByRole('navigation', {
      name: 'Explorer les sélections',
    })
    const links = within(nav).getAllByRole('link')
    await expect(links).toHaveLength(args.shelves.length)
    const first = args.shelves[0]
    await expect(links[0]).toHaveAttribute('href', '#home-shelf-' + first.id)
    const resting = links[0].getBoundingClientRect()
    const neighbor = links[1].getBoundingClientRect()
    await userEvent.hover(links[0])
    await waitFor(() => {
      const enlarged = links[0].getBoundingClientRect()
      expect(enlarged.width).toBeGreaterThan(resting.width * 1.03)
      expect(enlarged.height).toBeGreaterThan(resting.height * 1.03)
      expect(links[1].getBoundingClientRect().left).toEqual(neighbor.left)
    })
    await userEvent.unhover(links[0])
    links[0].focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: first.title })).toHaveFocus(),
    )
    links[0].focus()
    nav.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    const track = links[0].parentElement!.getBoundingClientRect()
    await waitFor(() => {
      const focused = links[0].getBoundingClientRect()
      expect(focused.width).toBeGreaterThan(resting.width * 1.03)
      expect(focused.top - track.top).toBeGreaterThan(4)
      expect(track.bottom - focused.bottom).toBeGreaterThan(4)
    })
  },
}

export const SingleSelection: Story = {
  name: 'Une seule destination disponible',
  args: { shelves: shelves.slice(0, 1) },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('navigation')).toBeNull()
    await expect(canvas.getByRole('heading')).toBeVisible()
  },
}

export const FourSelections: Story = {
  name: 'Quatre sélections sur toute la largeur',
  args: { shelves: fourSelections },
  play: async ({ canvas }) => {
    const nav = canvas.getByRole('navigation', {
      name: 'Explorer les sélections',
    })
    const links = within(nav).getAllByRole('link')
    await expect(links).toHaveLength(4)
    const rail = links[0].parentElement!
    const last = links[3]
    if (rail.clientWidth >= 1200) {
      const gutter = parseFloat(getComputedStyle(rail).paddingInlineEnd)
      const end = rail.getBoundingClientRect().right - gutter
      await expect(
        Math.abs(last.getBoundingClientRect().right - end),
      ).toBeLessThan(2)
      await expect(rail.scrollWidth).toBeLessThanOrEqual(rail.clientWidth + 1)
    } else if (rail.clientWidth <= 480) {
      await expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth)
      last.scrollIntoView({
        block: 'nearest',
        inline: 'end',
        behavior: 'instant',
      })
      await waitFor(() => expect(rail.scrollLeft).toBeGreaterThan(0))
      await expect(last.getBoundingClientRect().right).toBeLessThanOrEqual(
        rail.getBoundingClientRect().right + 1,
      )
      rail.scrollTo({ left: 0, behavior: 'instant' })
    }
  },
}
