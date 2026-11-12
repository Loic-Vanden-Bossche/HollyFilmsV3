import type { Meta, StoryObj } from '@storybook/react-vite'
import { TextInput } from './TextInput.tsx'

const meta = {
  title: 'UI/Champ de saisie',
  component: TextInput,
  parameters: { layout: 'centered' },
  args: { placeholder: 'Nom d’utilisateur', 'aria-label': 'Nom d’utilisateur' },
} satisfies Meta<typeof TextInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { name: 'Texte' }
export const Password: Story = {
  name: 'Mot de passe',
  args: {
    type: 'password',
    placeholder: 'Mot de passe',
    'aria-label': 'Mot de passe',
  },
}
export const Invalid: Story = {
  name: 'Invalide',
  args: { defaultValue: 'Nom indisponible', 'aria-invalid': true },
}
export const Disabled: Story = { name: 'Désactivé', args: { disabled: true } }
