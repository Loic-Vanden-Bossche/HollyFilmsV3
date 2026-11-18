import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn, expect } from 'storybook/test'
import PerformancePanel, { PerformanceGraph } from './PerformancePanel.tsx'
import { PerformanceProvider } from './PerformanceProvider.tsx'
import { PerformanceController } from './profiles.ts'

const meta = {
  title: 'UI/Performance',
  component: PerformancePanel,
  args: { onClose: fn() },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      const [controller] = useState(() => {
        const value = new PerformanceController()
        value.setAdmin(true)
        return value
      })
      return (
        <PerformanceProvider controller={controller} measure={false}>
          <Story />
        </PerformanceProvider>
      )
    },
  ],
} satisfies Meta<typeof PerformancePanel>
export default meta
type Story = StoryObj<typeof meta>
export const Collecting: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByText('Mesure en cours…')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Fermer' }))
    await expect(args.onClose).toHaveBeenCalledOnce()
  },
}
export const EmptyGraph: Story = {
  render: () => <PerformanceGraph trace={{ samples: [], events: [] }} />,
}
