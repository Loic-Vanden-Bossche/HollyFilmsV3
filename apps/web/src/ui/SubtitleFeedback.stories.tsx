import type { Meta, StoryObj } from '@storybook/react-vite'
import { SubtitleFeedback, SubtitleStatusBadge } from './SubtitleFeedback.tsx'
const meta = {
  title: 'UI/Sous-titres/Retours',
  component: SubtitleFeedback,
  args: {
    title: 'Recherche en cours…',
    description: 'Les fournisseurs de sous-titres sont interrogés.',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SubtitleFeedback>
export default meta
type Story = StoryObj<typeof meta>
export const Loading: Story = { args: { skeleton: true } }
export const Installed: Story = {
  args: {
    tone: 'success',
    title: 'Sous-titre installé',
    description: 'Le sous-titre est disponible dans cette version du média.',
  },
}
export const Failure: Story = {
  args: {
    tone: 'error',
    title: 'Le service de sous-titres est indisponible.',
    description: undefined,
  },
}
export const Statuses: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {(
        ['PENDING', 'DOWNLOADING', 'DOWNLOADED', 'REJECTED', 'FAILED'] as const
      ).map((status) => (
        <SubtitleStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
}
