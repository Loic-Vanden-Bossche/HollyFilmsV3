import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { catalogueItems } from './catalogue-fixtures.ts'
import { HorizontalRail } from './HorizontalRail.tsx'
import './media-details.css'

const posters = catalogueItems.map((item) => (
  <img
    key={item.id}
    src={item.poster}
    alt={item.title}
    width={400}
    height={600}
    style={{ width: '100%', height: 'auto', borderRadius: 10 }}
  />
))
const meta = {
  title: 'UI/Défilement horizontal',
  component: HorizontalRail,
  decorators: [
    (Story) => (
      <div style={{ width: 'min(100%, 720px)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    trackClassName: 'detail-rail-track',
    previousLabel: 'Affiches précédentes',
    nextLabel: 'Affiches suivantes',
    children: posters,
  },
} satisfies Meta<typeof HorizontalRail>
export default meta
type Story = StoryObj<typeof meta>

export const EdgeArrows: Story = {
  name: 'Parcourir les affiches',
  play: async ({ canvas, userEvent }) => {
    const next = await canvas.findByRole('button', {
      name: 'Affiches suivantes',
    })
    await expect(
      canvas.queryByRole('button', { name: 'Affiches précédentes' }),
    ).toBeNull()
    const track = next.ownerDocument.getElementById(
      next.getAttribute('aria-controls')!,
    )!
    await expect(getComputedStyle(track).scrollBehavior).toBe(
      getComputedStyle(document.documentElement).scrollBehavior,
    )
    next.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(track.scrollLeft).toBeGreaterThan(50))
    const previous = await canvas.findByRole('button', {
      name: 'Affiches précédentes',
    })
    track.scrollTo({ left: track.scrollWidth, behavior: 'instant' })
    await waitFor(() => expect(next).not.toBeVisible())
    await expect(previous).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(next).toBeVisible())
    track.scrollTo({ left: 0, behavior: 'instant' })
    await waitFor(() => expect(previous).not.toBeVisible())
    next.blur()
  },
}

export const AllTitlesVisible: Story = {
  name: 'Tous les titres sont visibles',
  args: { children: posters.slice(0, 1) },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('img', { name: catalogueItems[0].title }),
    ).toBeVisible()
    await expect(canvas.queryAllByRole('button')).toHaveLength(0)
  },
}
