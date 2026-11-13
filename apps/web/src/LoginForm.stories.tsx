import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, mocked, waitFor } from 'storybook/test'
import { registerAccount } from './account-api.ts'
import { LoginForm } from './LoginForm.tsx'

const meta = {
  title: 'HollyFilms/Connexion',
  component: LoginForm,
  args: { onSignIn: fn(async () => {}) },
  decorators: [
    (Story) => (
      <div className="member-shell mx-auto max-w-4xl">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    mocked(registerAccount).mockReset()
    mocked(registerAccount).mockResolvedValue({ status: 'pending' })
  },
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Login: Story = {
  name: 'Mot de passe',
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(
      canvas.getByLabelText('Nom d’utilisateur'),
      'cinephile',
    )
    await userEvent.type(
      canvas.getByLabelText('Mot de passe', { exact: true }),
      'movie-night',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Afficher le mot de passe' }),
    )
    await expect(
      canvas.getByLabelText('Mot de passe', { exact: true }),
    ).toHaveAttribute('type', 'text')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Masquer le mot de passe' }),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Se connecter' }))
    await expect(args.onSignIn).toHaveBeenCalledWith('cinephile', 'movie-night')
    await waitFor(() =>
      expect(
        canvas.getByLabelText('Mot de passe', { exact: true }),
      ).toHaveValue(''),
    )
  },
}
export const Google: Story = {
  name: 'Avec Google',
  args: { options: { googleStartUrl: '#google' } },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('link', { name: 'Continuer avec Google' }),
    ).toHaveAttribute('href', '#google')
  },
}
export const Registration: Story = {
  name: 'Demande de compte',
  args: { initialMode: 'register', options: { googleStartUrl: '#google' } },
  play: async ({ canvas, userEvent }) => {
    const username = canvas.getByLabelText('Nom d’utilisateur')
    const password = canvas.getByLabelText('Mot de passe', { exact: true })
    await userEvent.type(username, 'cinephile')
    await userEvent.type(password, 'movie-night')
    await userEvent.click(canvas.getByRole('button', { name: 'Connexion' }))
    await expect(username).toHaveValue('cinephile')
    await expect(password).toHaveValue('movie-night')
    await expect(password).toHaveAttribute('autocomplete', 'current-password')
    await userEvent.click(canvas.getByRole('button', { name: 'Inscription' }))
    await expect(password).toHaveAttribute('autocomplete', 'new-password')
    await expect(password).toBeRequired()
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Créer votre compte.' }),
      ).toBeVisible(),
    )
    await userEvent.clear(username)
    await userEvent.clear(password)
  },
}
export const Registered: Story = {
  name: 'Inscription envoyée',
  args: { initialMode: 'register' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(
      canvas.getByLabelText('Nom d’utilisateur'),
      'cinephile',
    )
    await userEvent.type(
      canvas.getByLabelText('Mot de passe', { exact: true }),
      'movie-night',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Envoyer la demande' }),
    )
    await expect(mocked(registerAccount)).toHaveBeenCalledWith(
      'cinephile',
      'movie-night',
    )
    await expect(args.onSignIn).not.toHaveBeenCalled()
    const heading = await canvas.findByRole('heading', {
      name: 'Demande envoyée.',
    })
    await waitFor(() => expect(heading).toHaveFocus())
    await expect(canvas.getByText(/Votre compte est en attente/)).toBeVisible()
  },
}
export const ErrorState: Story = {
  name: 'Erreur de connexion',
  args: {
    onSignIn: fn(async () => {
      throw new Error('Vérifie ton nom d’utilisateur et ton mot de passe.')
    }),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(
      canvas.getByLabelText('Nom d’utilisateur'),
      'cinephile',
    )
    await userEvent.type(
      canvas.getByLabelText('Mot de passe', { exact: true }),
      'movie-night',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Se connecter' }))
    await expect(args.onSignIn).toHaveBeenCalledWith('cinephile', 'movie-night')
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Vérifie ton nom d’utilisateur et ton mot de passe.',
    )
    await expect(
      canvas.getByLabelText('Mot de passe', { exact: true }),
    ).toHaveValue('movie-night')
    await expect(
      canvas.getByRole('button', { name: 'Se connecter' }),
    ).toBeEnabled()
  },
}
export const Submitting: Story = {
  name: 'Envoi en cours',
  args: {
    options: { googleStartUrl: '#google' },
    onSignIn: fn(() => new Promise<void>(() => {})),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(
      canvas.getByLabelText('Nom d’utilisateur'),
      'cinephile',
    )
    await userEvent.type(
      canvas.getByLabelText('Mot de passe', { exact: true }),
      'movie-night',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Se connecter' }))
    await expect(args.onSignIn).toHaveBeenCalledTimes(1)
    await expect(canvas.getByLabelText('Nom d’utilisateur')).toBeDisabled()
    await expect(
      canvas.getByRole('button', { name: 'Inscription' }),
    ).toBeDisabled()
    await expect(
      canvas.getByRole('link', { name: 'Continuer avec Google' }),
    ).toHaveAttribute('aria-disabled', 'true')
    await expect(
      await canvas.findByRole('button', { name: 'Envoi…' }),
    ).toBeDisabled()
  },
}
export const Pending: Story = {
  name: 'En attente',
  args: { notice: 'Votre demande est en attente d’approbation.' },
}
