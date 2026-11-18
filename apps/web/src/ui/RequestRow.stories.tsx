import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { RequestRow } from './RequestRow.tsx'
import '../requests.css'

const meta = {
  title: 'UI/Demandes/Liste animée',
  component: RequestRow,
  args: { children: 'En attente' },
} satisfies Meta<typeof RequestRow>
export default meta
type Story = StoryObj<typeof meta>

export const FilterAndRestore: Story = {
  render: function Render() {
    const [pending, setPending] = useState(false)
    return (
      <section>
        <button
          className="glass-control request-link"
          aria-pressed={pending}
          onClick={() => setPending(!pending)}
        >
          En attente
        </button>
        <ul className="requests-list" style={{ marginTop: 16 }}>
          <AnimatePresence initial={false} mode="popLayout">
            {(pending ? ['Solaris'] : ['Arrival', 'Solaris']).map(
              (name, order) => (
                <RequestRow
                  as="li"
                  key={name}
                  order={order}
                  className="glass-panel request-row"
                >
                  <a href={'#' + name}>{name}</a>
                </RequestRow>
              ),
            )}
          </AnimatePresence>
        </ul>
      </section>
    )
  },
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole('button', { name: 'En attente' })
    const solaris = canvas.getByRole('link', { name: 'Solaris' })
    await userEvent.click(toggle)
    await waitFor(() =>
      expect(canvas.queryByText('Arrival')).not.toBeInTheDocument(),
    )
    await userEvent.tab()
    await expect(solaris).toHaveFocus()
    await userEvent.click(toggle)
    await userEvent.click(toggle)
    await waitFor(() =>
      expect(canvas.queryByText('Arrival')).not.toBeInTheDocument(),
    )
    await userEvent.click(toggle)
    await expect(canvas.getByRole('link', { name: 'Solaris' })).toBe(solaris)
    await expect(
      await canvas.findByRole('link', { name: 'Arrival' }),
    ).toBeVisible()
  },
}
