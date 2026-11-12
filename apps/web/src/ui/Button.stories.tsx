import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
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
  play: async ({ args, canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Continuer' })
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onClick).toHaveBeenCalled()
  },
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
