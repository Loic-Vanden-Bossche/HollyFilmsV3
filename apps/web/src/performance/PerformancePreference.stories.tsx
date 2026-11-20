import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { PerformanceController } from './profiles.ts'
import { PerformancePreference } from './PerformancePreference.tsx'
import { PerformanceProvider } from './PerformanceProvider.tsx'

const meta = {
  title: 'UI/Préférences de performance',
  component: PerformancePreference,
  decorators: [
    (Story) => {
      const [controller] = useState(() => new PerformanceController())
      return (
        <PerformanceProvider controller={controller} measure={false}>
          <div className="max-w-xl">
            <Story />
          </div>
        </PerformanceProvider>
      )
    },
  ],
} satisfies Meta<typeof PerformancePreference>
export default meta
type Story = StoryObj<typeof meta>

export const Member: Story = {
  name: 'Choisir un mode',
  play: async ({ canvas, userEvent }) => {
    const cinema = canvas.getByRole('radio', { name: 'Cinéma' })
    const light = canvas.getByRole('radio', { name: 'Léger' })
    await expect(canvas.getAllByRole('radio')).toHaveLength(2)
    await expect(cinema).toBeChecked()
    await userEvent.click(light)
    await expect(light).toBeChecked()
    await expect(document.documentElement).toHaveAttribute(
      'data-performance',
      'light',
    )
    await userEvent.keyboard('{ArrowLeft}')
    await expect(cinema).toHaveFocus()
    await expect(cinema).toBeChecked()
    await expect(document.documentElement).toHaveAttribute(
      'data-performance',
      'cinema',
    )
  },
}
