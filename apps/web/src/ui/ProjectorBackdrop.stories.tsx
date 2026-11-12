import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProjectorBackdrop } from './ProjectorBackdrop.tsx'

const meta = {
  title: 'UI/Faisceau projecteur',
  component: ProjectorBackdrop,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', height: '100dvh' }}>
        <Story />
      </div>
    ),
  ],
  args: { paused: false, enabled: true },
} satisfies Meta<typeof ProjectorBackdrop>
export default meta
type Story = StoryObj<typeof meta>

export const Animated: Story = {}
export const Paused: Story = { args: { paused: true } }
export const Fallback: Story = { name: 'Sans WebGL', args: { enabled: false } }
