import type { Meta, StoryObj } from '@storybook/react-vite'
import { MediaRail } from './MediaRail.tsx'
import './media-details.css'
const meta = {
  title: 'UI/Fiche média/Carrousel',
  component: MediaRail,
  args: {
    title: 'Distribution',
    kind: 'person',
    count: 12,
    children: Array.from({ length: 12 }, (_, i) => (
      <div
        key={i}
        style={{
          height: 200,
          background: '#163448',
          padding: 20,
          borderRadius: 12,
        }}
      >
        Personnage {i + 1}
      </div>
    )),
  },
  decorators: [
    (Story) => (
      <div
        className="media-dialog"
        style={{ width: 800, maxWidth: '100%', padding: 24 }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MediaRail>
export default meta
export const Default: StoryObj<typeof meta> = {}
