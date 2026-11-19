import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test'
import { catalogueItems } from './catalogue-fixtures.ts'
import { ArtworkPreview } from './ArtworkPreview.tsx'

const meta = {
  title: 'UI/Aperçu des affiches',
  component: ArtworkPreview,
  args: {
    title: catalogueItems[0].title,
    artwork: <img src={catalogueItems[0].poster} alt="" />,
    children: (
      <h3 className="artwork-preview-title">{catalogueItems[0].title}</h3>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 680, margin: '48px auto', padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArtworkPreview>
export default meta
type Story = StoryObj<typeof meta>

export const ClippedRail: Story = {
  name: 'Aperçu au bord d’une rangée',
  render: () => (
    <div
      className="home-resume-rail"
      style={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: '29%',
        gap: 12,
        overflowX: 'auto',
        padding: 0,
      }}
    >
      {catalogueItems.slice(0, 4).map((item) => (
        <ArtworkPreview
          key={item.id}
          title={item.title}
          wide
          artwork={<img alt="" src={item.poster} />}
        >
          <h3 className="artwork-preview-title">{item.title}</h3>
          <p>
            {item.kind} · {item.year}
          </p>
        </ArtworkPreview>
      ))}
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'NEON' })
    const neighbor = canvas.getByRole('button', { name: 'SIGNAL' })
    const before = neighbor.getBoundingClientRect()
    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument()
    await userEvent.hover(trigger)
    const panel = await canvas.findByRole('group', { name: 'NEON' })
    await expect(within(panel).getByRole('heading')).toBeVisible()
    const bounds = panel.getBoundingClientRect()
    await expect(bounds.width).toBeGreaterThan(
      trigger.getBoundingClientRect().width,
    )
    await expect(bounds.right).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    )
    await expect(neighbor.getBoundingClientRect().x).toEqual(before.x)
    await expect(neighbor.getBoundingClientRect().height).toEqual(before.height)
  },
}

export const VerticalBrowsing: Story = {
  name: 'Défilement de la page au survol',
  render: (args) => (
    <div style={{ maxWidth: 180, minHeight: '160vh' }}>
      <ArtworkPreview {...args} />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'ORBITAL' })
    await userEvent.hover(trigger)
    const panel = await canvas.findByRole('group', { name: 'ORBITAL' })
    const surface = panel.querySelector('.artwork-preview-surface')!
    await expect(getComputedStyle(surface).overscrollBehaviorY).toBe('auto')
    const pageY = window.scrollY
    try {
      window.scrollBy({ top: 150, behavior: 'instant' })
      await waitFor(() => {
        expect(window.scrollY).toBeGreaterThan(pageY)
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
      })
    } finally {
      window.scrollTo({ top: pageY, behavior: 'instant' })
    }
  },
}

export const Keyboard: Story = {
  args: { onSelect: fn(), selectLabel: 'Voir la fiche de ORBITAL' },
  render: (args) => (
    <div style={{ width: 170 }}>
      <ArtworkPreview {...args}>
        {args.children}
        <button type="button" onClick={args.onSelect} data-preview-select>
          Voir la fiche
        </button>
      </ArtworkPreview>
    </div>
  ),
  play: async ({ args, canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', {
      name: 'Voir la fiche de ORBITAL',
    })
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    const action = await canvas.findByRole('button', {
      name: 'Voir la fiche',
    })
    await userEvent.tab()
    await expect(action).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-expanded', 'false'),
    )
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onSelect).toHaveBeenCalledTimes(1)
  },
}

export const Touch: Story = {
  args: { onSelect: fn() },
  render: (args) => (
    <div style={{ width: 170 }}>
      <ArtworkPreview {...args} />
    </div>
  ),
  play: async ({ args, canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'ORBITAL' })
    await userEvent.pointer([{ keys: '[TouchA]', target: trigger }])
    const panel = await canvas.findByRole('group', { name: 'ORBITAL' })
    await expect(args.onSelect).not.toHaveBeenCalled()
    await userEvent.pointer([
      {
        keys: '[TouchA]',
        target: within(panel).getByRole('button', { name: 'Ouvrir ORBITAL' }),
      },
    ])
    await expect(args.onSelect).toHaveBeenCalledTimes(1)
  },
}

export const DialogSwipe: Story = {
  name: 'Balayage depuis un aperçu dans une fiche',
  render: (args) => (
    <dialog
      ref={(dialog) => {
        if (dialog && !dialog.open) dialog.showModal()
      }}
      aria-label="Fiche du film"
      style={{ width: 'min(90vw, 580px)', height: '70vh', overflowY: 'auto' }}
    >
      <form method="dialog">
        <button>Fermer la fiche</button>
      </form>
      <div style={{ maxWidth: 180, minHeight: '150vh' }}>
        <ArtworkPreview {...args} />
      </div>
    </dialog>
  ),
  play: async ({ canvas, userEvent }) => {
    const dialog = canvas.getByRole('dialog', { name: 'Fiche du film' })
    const trigger = within(dialog).getByRole('button', { name: 'ORBITAL' })
    await userEvent.pointer([{ keys: '[TouchA]', target: trigger }])
    const panel = await within(dialog).findByRole('group', { name: 'ORBITAL' })
    const before = dialog.scrollTop
    const touchesAt = (clientY: number) => [
      new window.Touch({ identifier: 1, target: panel, clientX: 90, clientY }),
    ]
    fireEvent.touchStart(panel, { touches: touchesAt(200) })
    fireEvent.touchMove(panel, { touches: touchesAt(167) })
    fireEvent.touchMove(panel, { touches: touchesAt(104) })
    fireEvent.touchEnd(panel)
    await waitFor(() => {
      expect(dialog.scrollTop - before).toBe(96)
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
    dialog.scrollTop = before
  },
}
