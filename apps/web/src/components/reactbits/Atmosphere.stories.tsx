import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Atmosphere } from './Atmosphere.tsx'
import { useState } from 'react'
import { PerformanceProvider } from '../../performance/PerformanceProvider.tsx'
import { PerformanceController } from '../../performance/profiles.ts'
const meta = {
  title: 'UI/React Bits/Atmosphère',
  component: Atmosphere,
  args: { kind: 'aurora' },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      const [controller] = useState(() => {
        const value = new PerformanceController()
        value.setAdmin(true)
        value.select('ultra', 0)
        return value
      })
      return (
        <PerformanceProvider controller={controller} measure={false}>
          <div style={{ height: '100dvh', position: 'relative' }}>
            <Story />
          </div>
        </PerformanceProvider>
      )
    },
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
