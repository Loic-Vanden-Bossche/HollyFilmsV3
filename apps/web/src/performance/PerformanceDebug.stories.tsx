import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import { PerformanceDebug } from './PerformanceDebug.tsx'
import { PerformanceProvider } from './PerformanceProvider.tsx'
import { PerformanceController, type PerformanceSample } from './profiles.ts'
import { CatalogueBackdrop } from '../ui/CatalogueBackdrop.tsx'

function Scene({
  administrator = true,
  live = false,
}: {
  administrator?: boolean
  live?: boolean
}) {
  const [controller] = useState(() => {
    const value = new PerformanceController()
    value.setAdmin(administrator)
    if (!live) {
      for (let i = 0; i < 24; i++) {
        if (i === 12) value.select('light', i * 2000)
        if (i === 18) value.select('cinema', i * 2000)
        const slow = i >= 8 && i <= 10
        const sample: PerformanceSample = {
          time: i * 2000,
          fps: slow ? 25 : 60,
          frameP95: slow ? 60 : 17,
          slowFrames: slow ? 0.5 : 0,
          blocking: slow ? 0.25 : 0,
          interaction: null,
          state: 'active',
          profile: value.getSettings().profile.id,
        }
        value.ingest(sample)
      }
    }
    return value
  })
  return (
    <PerformanceProvider controller={controller} measure={live}>
      <main style={{ minHeight: '100dvh', padding: 24, position: 'relative' }}>
        <CatalogueBackdrop />
        <p>
          {live ? 'Live browser measurements' : 'Simulated performance history'}
        </p>
        <PerformanceDebug />
      </main>
    </PerformanceProvider>
  )
}
const meta = {
  title: 'HollyFilms/Performance',
  component: PerformanceDebug,
  parameters: { layout: 'fullscreen' },
  render: () => <Scene />,
} satisfies Meta<typeof PerformanceDebug>
export default meta
type Story = StoryObj<typeof meta>

export const Administrator: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Débogage des performances' }),
    )
    const dialog = within(
      await canvas.findByRole('dialog', { name: 'Débogage des performances' }),
    )
    await waitFor(() =>
      expect(
        dialog.getByRole('img', {
          name: 'Fréquence des images et changements de profil',
        }),
      ).toBeVisible(),
    )
    await expect(
      within(dialog.getByRole('list')).getByText('Cinéma → Léger'),
    ).toBeVisible()
  },
}
export const Member: Story = {
  render: () => <Scene administrator={false} />,
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole('button', { name: 'Débogage des performances' }),
    ).not.toBeInTheDocument()
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}
export const LiveMeasurements: Story = { render: () => <Scene live /> }
export const ManualSelection: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Débogage des performances' }),
    )
    const dialog = within(await canvas.findByRole('dialog'))
    await expect(dialog.getAllByRole('radio')).toHaveLength(2)
    const light = dialog.getByRole('radio', { name: /Léger/ })
    await userEvent.click(light)
    await expect(light).toBeChecked()
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Débogage des performances' }),
      ).toHaveFocus(),
    )
    await userEvent.keyboard('{Enter}')
    await expect(await canvas.findByRole('dialog')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
  },
}
