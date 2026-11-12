import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn, mocked } from 'storybook/test'
import { registerAccount } from './account-api.ts'
import { LoginForm } from './LoginForm.tsx'

const meta = {
  title: 'HollyFilms/Connexion',
  component: LoginForm,
  args: { onSignIn: fn(async () => {}) },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    mocked(registerAccount).mockResolvedValue({ status: 'pending' })
  },
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Login: Story = { name: 'Mot de passe' }
export const Google: Story = {
  name: 'Avec Google',
  args: { options: { googleStartUrl: '#google' } },
}
export const Registration: Story = {
  name: 'Demande de compte',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Demander un compte' }),
    )
  },
}
export const Pending: Story = {
  name: 'En attente',
  args: { notice: 'Ta demande est en attente d’approbation.' },
}
