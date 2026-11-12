import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Atmosphere } from './Atmosphere.tsx'
const meta = {
  title: 'UI/React Bits/Atmosphère',
  component: Atmosphere,
  args: { kind: 'aurora' },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100dvh', position: 'relative' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Atmosphere>
export default meta
type Story = StoryObj<typeof meta>
export const Aurora: Story = {
  name: 'Aurora — navy, vert et bleu profonds',
}
export const BrightHost: Story = {
  name: 'Fond navy sur un conteneur clair',
  decorators: [
    (Story) => (
      <div style={{ position: 'absolute', inset: 0, background: '#ffffff' }}>
        <Story />
      </div>
    ),
  ],
}
export const LightRays: Story = { args: { kind: 'rays' } }
export const Static: Story = {
  args: { paused: true },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('canvas')).toBeNull()
    await expect(
      canvasElement.querySelector('.rb-atmosphere-fallback'),
    ).toBeVisible()
  },
}
