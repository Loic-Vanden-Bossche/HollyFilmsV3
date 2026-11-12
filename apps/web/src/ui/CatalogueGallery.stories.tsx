import type { Meta, StoryObj } from '@storybook/react-vite'
import { CatalogueGallery } from './CatalogueGallery.tsx'
import { catalogueItems } from './catalogue-fixtures.ts'

const meta = {
  title: 'UI/Catalogue',
  component: CatalogueGallery,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="member-shell mx-auto h-dvh max-w-3xl p-6">
        <Story />
      </div>
    ),
  ],
  args: { items: catalogueItems },
} satisfies Meta<typeof CatalogueGallery>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { name: 'Mur d’affiches animé' }
export const FewTitles: Story = {
  name: 'Petit catalogue',
  args: { items: catalogueItems.slice(0, 3) },
}
export const Paused: Story = { name: 'En pause', args: { stopped: true } }
export const SingleTitle: Story = {
  name: 'Un titre sans affiche',
  args: { items: [{ ...catalogueItems[0], poster: null }] },
}
export const Empty: Story = { name: 'Catalogue vide', args: { items: [] } }
