import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
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
export const ProgressiveReveal: StoryObj<typeof meta> = {
  name: 'Apparition progressive des cartes au défilement',
  play: async ({ canvas, userEvent }) => {
    const next = canvas.getByRole('button', { name: 'Distribution : suivant' })
    await waitFor(() => expect(next).toBeEnabled())
    await userEvent.click(next)
    const rail = canvas.getByRole('region', { name: 'Distribution' })
    await waitFor(() =>
      expect(
        rail.querySelector('.detail-rail-track')!.scrollLeft,
      ).toBeGreaterThan(100),
    )
    await expect(
      canvas.getByRole('button', { name: 'Distribution : précédent' }),
    ).toBeEnabled()
  },
}
