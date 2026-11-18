import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { CatalogueLoadTrigger } from './VirtualMediaGrid.tsx'

const meta = {
  title: 'UI/Chargement du catalogue',
  component: CatalogueLoadTrigger,
  args: { count: 36, hasMore: true, onLoadMore: fn() },
  parameters: { layout: 'fullscreen' },
  render: function Render(args) {
    const [count, setCount] = useState(args.count)
    const [loading, setLoading] = useState(false)
    const [blocked, setBlocked] = useState(true)
    const load = async () => {
      args.onLoadMore()
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 250))
      setCount((n) => n + 36)
      setLoading(false)
    }
    return (
      <main>
        <div style={{ height: 'calc(100vh + 1000px)', padding: 24 }}>
          Faire défiler pour charger la suite.
        </div>
        <p role="status">{loading ? 'Chargement…' : `${count} titres`}</p>
        <CatalogueLoadTrigger
          {...args}
          count={count}
          hasMore={args.hasMore && count < 72}
          loading={loading || args.loading}
          error={args.error && blocked}
          paused={args.paused && blocked}
          onLoadMore={load}
        />
        {(args.error || args.paused) && (
          <button onClick={() => setBlocked(false)}>Reprendre</button>
        )}
      </main>
    )
  },
} satisfies Meta<typeof CatalogueLoadTrigger>
export default meta
type Story = StoryObj<typeof meta>

export const Automatic: Story = {
  play: async ({ canvas, args }) => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    await expect(args.onLoadMore).not.toHaveBeenCalled()
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant',
    })
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent('72 titres'),
    )
    await expect(args.onLoadMore).toHaveBeenCalledTimes(1)
  },
}
export const ErrorRecovery: Story = {
  args: { error: true },
  play: async ({ canvas, args, userEvent }) => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant',
    })
    await userEvent.click(canvas.getByRole('button', { name: 'Reprendre' }))
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent('72 titres'),
    )
    await expect(args.onLoadMore).toHaveBeenCalledTimes(1)
  },
}
export const Paused: Story = {
  args: { paused: true },
  play: ErrorRecovery.play,
}
export const End: Story = {
  args: { hasMore: false },
  play: async ({ args }) => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant',
    })
    await expect(args.onLoadMore).not.toHaveBeenCalled()
  },
}
