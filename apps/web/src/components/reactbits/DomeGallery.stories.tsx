import type { Meta, StoryObj } from '@storybook/react-vite'
import { DomeGallery } from './DomeGallery.tsx'
import { catalogueItems } from '../../ui/catalogue-fixtures.ts'
const meta = {
  title: 'UI/React Bits/Dome Gallery',
  component: DomeGallery,
  args: { items: catalogueItems },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100dvh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DomeGallery>
export default meta
type Story = StoryObj<typeof meta>
export const Panorama: Story = {}
export const Paused: Story = { args: { paused: true } }
export const MissingArtwork: Story = {
  args: { items: [{ ...catalogueItems[0], poster: null }] },
}
export const Empty: Story = { args: { items: [] } }
