import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor } from 'storybook/test'
import { LibraryTransition } from './LibraryTransition.tsx'
import './library-pages.css'

const meta = {
  title: 'UI/Transitions des pages',
  component: LibraryTransition,
  args: { pageKey: 'Accueil', order: 0, children: 'Accueil' },
  render: function Example() {
    const pages = ['Accueil', 'Favoris', 'Films', 'Séries', 'Collections']
    const [index, setIndex] = useState(0)
    return (
      <div style={{ overflow: 'clip', padding: 32 }}>
        <nav
          aria-label="Pages de démonstration"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {pages.map((label, i) => (
            <button
              key={label}
              className="library-outline-button"
              onClick={() => setIndex(i)}
            >
              {label}
            </button>
          ))}
        </nav>
        <LibraryTransition pageKey={pages[index]} order={index}>
          <section
            style={{
              padding: 64,
              borderRadius: 24,
              background: 'linear-gradient(120deg,#142e3d,#132238)',
            }}
          >
            <h1>{pages[index]}</h1>
          </section>
        </LibraryTransition>
      </div>
    )
  },
} satisfies Meta<typeof LibraryTransition>
export default meta
type Story = StoryObj<typeof meta>
export const RapidNavigation: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Films' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Séries' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Collections' }))
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Collections' }),
      ).toBeVisible(),
    )
    await expect(canvasElement.querySelectorAll('[data-page]')).toHaveLength(1)
    await expect(
      canvasElement.querySelector('[data-page]'),
    ).not.toHaveAttribute('inert')
  },
}
