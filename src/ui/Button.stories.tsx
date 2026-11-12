import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Button } from './Button.tsx'

const meta = {
  title: 'UI/Bouton',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Continuer', onClick: fn() },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'link'],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  name: 'Principal',
  args: { variant: 'primary' },
}
export const Secondary: Story = {
  name: 'Secondaire',
  args: { variant: 'secondary' },
}
export const Link: Story = { name: 'Lien', args: { variant: 'link' } }
export const Disabled: Story = {
  name: 'Désactivé',
  args: { variant: 'primary', disabled: true },
}
