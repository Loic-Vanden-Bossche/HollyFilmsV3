import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { PlayerSettingsPanel } from './PlayerSettingsPanel.tsx'

const meta = {
  title: 'UI/Lecteur/Panneau de réglages',
  component: PlayerSettingsPanel,
  args: {
    menu: 'chapters',
    onClose: fn(),
    children: Array.from({ length: 24 }, (_, i) => (
      <button key={i} className="player-menu-list">
        Chapitre {i + 1}
      </button>
    )),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          height: 'min(640px, calc(100dvh - 2rem))',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlayerSettingsPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Scroll: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const panel = canvas.getByRole('region')
    const header = canvas.getByRole('heading').closest('header')!
    const first = canvas.getByRole('button', { name: 'Chapitre 1' })
    const last = canvas.getByRole('button', { name: 'Chapitre 24' })
    const list = first.parentElement!
    await expect(getComputedStyle(header).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    )
    last.focus()
    await expect(list.scrollTop).toBeGreaterThan(0)
    await expect(panel.scrollTop).toBe(0)
    await expect(header.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      list.getBoundingClientRect().top + 1,
    )
    await userEvent.keyboard('{Escape}')
    await expect(args.onClose).toHaveBeenCalledTimes(1)
    first.focus()
  },
}
