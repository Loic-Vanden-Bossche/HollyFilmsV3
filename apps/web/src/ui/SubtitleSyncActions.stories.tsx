import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { SubtitleSyncActions } from './SubtitleSyncActions.tsx'

const ready = { canAdjust: true, loading: false }
const meta = {
  title: 'UI/Lecteur/Actions de synchronisation',
  component: SubtitleSyncActions,
  args: { primary: ready, onOpen: fn() },
  decorators: [
    (Story) => (
      <div style={{ width: 'min(100%, 22rem)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SubtitleSyncActions>

export default meta
type Story = StoryObj<typeof meta>

export const Bilingual: Story = {
  args: { secondary: ready },
  play: async ({ canvas, userEvent, args }) => {
    const [primary, secondary] = canvas.getAllByRole('button')
    await userEvent.tab()
    await expect(primary).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onOpen).toHaveBeenCalledWith('primary', primary)
    await userEvent.tab()
    await expect(secondary).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect(args.onOpen).toHaveBeenCalledWith('secondary', secondary)
  },
}

export const Unavailable: Story = {
  args: { primary: { canAdjust: false, loading: false } },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button')
    await expect(button).toBeDisabled()
    await expect(button).toHaveAccessibleDescription()
  },
}
