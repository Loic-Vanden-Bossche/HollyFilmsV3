import { useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { PerformanceProvider } from './PerformanceProvider.tsx'
import { PerformanceController, type ProfileId } from './profiles.ts'
import { CatalogueBackdrop } from '../ui/CatalogueBackdrop.tsx'
import { Atmosphere } from '../components/reactbits/Atmosphere.tsx'

function ProfileScene({
  profile,
  children,
}: {
  profile: ProfileId
  children: ReactNode
}) {
  const [controller] = useState(() => {
    const value = new PerformanceController()
    value.setAdmin(true)
    value.select(profile, 0)
    return value
  })
  return (
    <PerformanceProvider controller={controller} measure={false}>
      {children}
    </PerformanceProvider>
  )
}
const meta = {
  title: 'UI/Profils de performance',
  component: PerformanceProvider,
  args: {
    children: (
      <div
        style={{
          minHeight: '100dvh',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <CatalogueBackdrop />
        <div style={{ position: 'absolute', inset: 0 }}>
          <Atmosphere kind="aurora" />
        </div>
        <div
          className="glass-panel"
          style={{ borderRadius: 24, padding: 32, zIndex: 1 }}
        >
          <h2>HollyFilms</h2>
          <button
            className="glass-control"
            style={{ padding: 12, borderRadius: 12 }}
          >
            Lire
          </button>
        </div>
      </div>
    ),
  },
  parameters: { layout: 'fullscreen', profile: 'balanced' },
  render: (args, { parameters }) => (
    <ProfileScene key={parameters.profile} profile={parameters.profile}>
      {args.children}
    </ProfileScene>
  ),
} satisfies Meta<typeof PerformanceProvider>
export default meta
type Story = StoryObj<typeof meta>
export const Essential: Story = {
  parameters: { profile: 'essential' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('canvas')).toBeNull()
    await expect(
      canvasElement.querySelector('.catalogue-backdrop'),
    ).toHaveAttribute('data-motion', 'paused')
  },
}
export const Light: Story = { ...Essential, parameters: { profile: 'light' } }
export const Balanced: Story = { parameters: { profile: 'balanced' } }
export const High: Story = { parameters: { profile: 'high' } }
export const Ultra: Story = { parameters: { profile: 'ultra' } }
