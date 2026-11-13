import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import type { LibraryFilter } from '@hollyfilms/shared/library'
import { FlowingMenu, StaggeredMenu } from './ImmersiveMenu.tsx'
import { homeItems } from '../../home-fixtures.ts'
const meta = {
  title: 'UI/React Bits/Navigation immersive',
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
  parameters: { layout: 'fullscreen' },
  render: function Menu() {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState<LibraryFilter>('all')
    return (
      <div className="p-8">
        <button
          className="glass-control rounded-2xl px-5 py-3"
          onClick={() => setOpen(true)}
        >
          Explorer
        </button>
        <output className="m-8">{selected}</output>
        {open && (
          <StaggeredMenu onClose={() => setOpen(false)}>
            <FlowingMenu
              items={homeItems}
              selected={selected}
              onSelect={setSelected}
            />
          </StaggeredMenu>
        )}
      </div>
    )
  },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Open: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Explorer' }))
  },
}
export const KeyboardAndSelection: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Explorer' })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    // Synthetic keys do not run the browser's native dialog cancellation.
    canvas
      .getByRole('dialog')
      .dispatchEvent(new Event('cancel', { cancelable: true }))
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(trigger).toHaveFocus())
    await expect(getComputedStyle(document.body).overflowY).not.toBe('hidden')
    await userEvent.click(trigger)
    const menu = within(canvas.getByRole('dialog'))
    await userEvent.click(menu.getByRole('button', { name: '02 Films' }))
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await expect(canvas.getByRole('status')).toHaveTextContent('movies')
    await waitFor(() => expect(trigger).toHaveFocus())
    await expect(getComputedStyle(document.body).overflowY).not.toBe('hidden')
  },
}
export const EmptyCatalogue: Story = {
  render: () => <FlowingMenu items={[]} selected="all" onSelect={() => {}} />,
}
