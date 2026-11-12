import type { Meta, StoryObj } from '@storybook/react-vite'
import { AudioLanguages } from './AudioLanguages.tsx'
import './media-card.css'
const meta = {
  title: 'UI/Langues audio',
  component: AudioLanguages,
  args: { languages: ['fr', 'en', 'ja'] },
} satisfies Meta<typeof AudioLanguages>
export default meta
type Story = StoryObj<typeof meta>
export const Languages: Story = {}
export const Regional: Story = {
  args: { languages: ['fr-ca', 'en-us', 'pt-br'] },
}
export const Many: Story = {
  args: { languages: ['fr', 'en', 'de', 'es', 'ja', 'ko'] },
}
export const Unknown: Story = { args: { languages: ['ar', 'tlh'] } }
export const Missing: Story = { args: { languages: [] } }
