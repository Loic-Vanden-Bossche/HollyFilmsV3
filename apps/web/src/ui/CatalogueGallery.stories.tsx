import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { CatalogueGallery } from './CatalogueGallery.tsx'
import { catalogueItems } from './catalogue-fixtures.ts'

const meta = {
  title: 'UI/Catalogue',
  component: CatalogueGallery,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="member-shell mx-auto h-dvh max-w-3xl overflow-hidden p-6">
        <Story />
      </div>
    ),
  ],
  args: { items: catalogueItems },
} satisfies Meta<typeof CatalogueGallery>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { name: 'Constellation cinéma' }
export const BlurredEdge: Story = {
  name: 'Bords fondus dans le fond navy',
  args: { stopped: true },
}
export const FewTitles: Story = {
  name: 'Petit catalogue',
  args: { items: catalogueItems.slice(0, 3) },
}
export const Paused: Story = { name: 'En pause', args: { stopped: true } }
export const PauseAndResume: Story = {
  name: 'Pause et reprise sans multiplier les animations',
  render: function Render(args) {
    const [stopped, setStopped] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setStopped((value) => !value)}>
          {stopped ? 'Reprendre les animations' : 'Mettre en pause'}
        </button>
        <CatalogueGallery {...args} stopped={stopped} />
      </>
    )
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const gallery = canvasElement.querySelector('.catalogue-gallery')!
    const drifts = () =>
      Array.from(gallery.querySelectorAll('.gallery-drift')).flatMap((poster) =>
        poster.getAnimations(),
      )
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    await waitFor(() =>
      expect(drifts().filter((a) => a.playState === 'running')).toHaveLength(
        reduced ? 0 : 7,
      ),
    )
    for (let i = 0; i < 3; i++) {
      await userEvent.click(
        canvas.getByRole('button', { name: 'Mettre en pause' }),
      )
      await waitFor(() =>
        expect(gallery).toHaveAttribute('data-motion', 'paused'),
      )
      await expect(drifts().every((a) => a.playState === 'paused')).toBe(true)
      await userEvent.click(
        canvas.getByRole('button', { name: 'Reprendre les animations' }),
      )
      await waitFor(() =>
        expect(drifts().filter((a) => a.playState === 'running')).toHaveLength(
          reduced ? 0 : 7,
        ),
      )
    }
  },
}
export const SingleTitle: Story = {
  name: 'Un titre sans affiche',
  args: { items: [{ ...catalogueItems[0], poster: null }] },
}
export const Empty: Story = { name: 'Catalogue vide', args: { items: [] } }
export const Loading: Story = { args: { items: [], state: 'loading' } }
export const Error: Story = { args: { items: [], state: 'error' } }
export const Narrow: Story = {
  name: 'Composition compacte',
  decorators: [
    (Story) => (
      <div
        style={{ width: 320, maxWidth: '100%', height: 240, margin: 'auto' }}
      >
        <Story />
      </div>
    ),
  ],
}
