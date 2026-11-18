import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, waitFor } from 'storybook/test'
import { VirtualMediaGrid } from './VirtualMediaGrid.tsx'
import { homeItems } from '../home-fixtures.ts'
import '../home.css'

const items = Array.from({ length: 1000 }, (_, i) => ({
  ...homeItems[i % homeItems.length],
  id: `virtual-${i}`,
  title: `Film ${i + 1}`,
}))
const meta = {
  title: 'UI/Catalogue virtualisé',
  component: VirtualMediaGrid,
  parameters: { layout: 'fullscreen' },
  args: { items, total: items.length, onSelect: fn() },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <main style={{ padding: 24 }}>
            <Story />
          </main>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof VirtualMediaGrid>
export default meta
type Story = StoryObj<typeof meta>

export const ThousandTitles: Story = {
  name: '1 000 titres — DOM borné et focus conservé',
  play: async ({ canvas, userEvent, args }) => {
    window.scrollTo(0, 0)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1' }),
      ).toBeVisible(),
    )
    const initialHeight = document.documentElement.scrollHeight
    await expect(canvas.getAllByRole('listitem').length).toBeLessThan(90)
    window.scrollTo(0, initialHeight / 2)
    await waitFor(() =>
      expect(
        canvas.queryByRole('button', { name: 'Voir la fiche de Film 1' }),
      ).not.toBeInTheDocument(),
    )
    await expect(canvas.getAllByRole('listitem').length).toBeLessThan(90)
    window.scrollTo(0, document.documentElement.scrollHeight)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1000' }),
      ).toBeVisible(),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1000' }),
      ).toHaveClass('media-tile-select'),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Voir la fiche de Film 1000' }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith(items[999])
    window.scrollTo(0, 0)
    // The invoking card remains mounted even if a dialog moves focus away.
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1' }),
      ).toBeVisible(),
    )
    await expect(
      canvas.getByRole('button', { name: 'Voir la fiche de Film 1000' }),
    ).toBeInTheDocument()
    await expect(canvas.getAllByRole('listitem').length).toBeLessThan(90)
    await expect(
      Math.abs(document.documentElement.scrollHeight - initialHeight),
    ).toBeLessThan(10)
    canvas.getByRole('button', { name: 'Voir la fiche de Film 1' }).focus()
  },
}

export const Empty: Story = { args: { items: [], total: 0 } }

export const ContentArrivesAbove: Story = {
  name: 'Repositionnement après chargement du contenu précédent',
  decorators: [
    (Story) => {
      const [expanded, setExpanded] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setExpanded((value) => !value)}>
            Afficher le contenu précédent
          </button>
          <div aria-hidden="true" style={{ height: expanded ? 360 : 0 }} />
          <Story />
        </>
      )
    },
  ],
  play: async ({ canvas, canvasElement, userEvent }) => {
    window.scrollTo(0, 0)
    const first = await canvas.findByRole('button', {
      name: 'Voir la fiche de Film 1',
    })
    await waitFor(() => expect(first).toBeVisible())
    const grid = canvasElement.querySelector('.virtual-media-grid')!
    const top = grid.getBoundingClientRect().top + window.scrollY
    await userEvent.click(
      canvas.getByRole('button', { name: 'Afficher le contenu précédent' }),
    )
    await waitFor(() =>
      expect(
        Math.round(grid.getBoundingClientRect().top + window.scrollY - top),
      ).toBe(360),
    )
    window.scrollTo(0, document.documentElement.scrollHeight)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1000' }),
      ).toBeVisible(),
    )
    window.scrollTo(0, 0)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1' }),
      ).toBeVisible(),
    )
  },
}

export const SortingAndRemoval: Story = {
  name: 'Tri et retrait dans une grille visible',
  render: function Demo(args) {
    const [selection, setSelection] = useState(items.slice(0, 8))
    return (
      <>
        <button
          disabled={selection.length < 2}
          onClick={() =>
            setSelection((current) => [
              current[1],
              current[0],
              ...current.slice(2),
            ])
          }
        >
          Inverser les premiers titres
        </button>
        <button
          disabled={!selection.length}
          onClick={() => setSelection((current) => current.slice(1))}
        >
          Retirer le premier titre
        </button>
        <VirtualMediaGrid
          {...args}
          items={selection}
          total={selection.length}
        />
      </>
    )
  },
  play: async ({ canvas, userEvent }) => {
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Voir la fiche de Film 1' }),
      ).toHaveClass('media-tile-select'),
    )
    const first = canvas.getByRole('button', {
      name: 'Voir la fiche de Film 1',
    })
    const swap = canvas.getByRole('button', {
      name: 'Inverser les premiers titres',
    })
    await userEvent.click(swap)
    await expect(canvas.getAllByRole('listitem')[0]).toHaveAttribute(
      'data-grid-item',
      'virtual-1',
    )
    await userEvent.click(swap)
    await expect(
      canvas.getByRole('button', { name: 'Voir la fiche de Film 1' }),
    ).toBe(first)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retirer le premier titre' }),
    )
    await expect(
      canvas.queryByRole('button', { name: 'Voir la fiche de Film 1' }),
    ).not.toBeInTheDocument()
    await expect(canvas.getAllByRole('listitem')[0]).toHaveAttribute(
      'aria-posinset',
      '1',
    )
  },
}
