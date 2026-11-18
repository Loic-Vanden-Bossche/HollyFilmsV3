import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor } from 'storybook/test'
import { ProfilePage } from './ProfilePage.tsx'
import { profileFixture, avatarFixture } from './profile-fixtures.ts'

const meta = {
  title: 'HollyFilms/Profil',
  component: ProfilePage,
  parameters: { layout: 'fullscreen' },
  args: {
    profile: profileFixture,
    state: 'ready',
    onRetry: fn(),
    onUpload: fn().mockResolvedValue(undefined),
    onDeleteImage: fn().mockResolvedValue(undefined),
    onPassword: fn().mockResolvedValue(undefined),
    onSignOut: fn(),
  },
} satisfies Meta<typeof ProfilePage>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Google: Story = {
  args: {
    profile: {
      ...profileFixture,
      google: {
        email: 'alex@example.com',
        picture: 'https://lh3.googleusercontent.com/avatar',
      },
    },
    avatarUrl: avatarFixture,
  },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByText('Photo de votre compte Google')).toBeVisible(),
    )
    await expect(
      canvas.queryByLabelText('Nouveau mot de passe'),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole('link', { name: /Gérer la sécurité Google/ }),
    ).toHaveAttribute('href', 'https://myaccount.google.com/security')
  },
}
export const ChangePassword: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.type(
      canvas.getByLabelText('Mot de passe actuel'),
      'old-password',
    )
    await userEvent.type(
      canvas.getByLabelText('Nouveau mot de passe'),
      'new-password',
    )
    await userEvent.type(
      canvas.getByLabelText('Confirmer le mot de passe'),
      'mismatch',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Enregistrer le mot de passe' }),
    )
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'ne correspondent pas',
    )
    await expect(args.onPassword).not.toHaveBeenCalled()
    await userEvent.clear(canvas.getByLabelText('Confirmer le mot de passe'))
    await userEvent.type(
      canvas.getByLabelText('Confirmer le mot de passe'),
      'new-password',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Enregistrer le mot de passe' }),
    )
    await expect(args.onPassword).toHaveBeenCalledWith(
      'old-password',
      'new-password',
    )
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Mot de passe enregistré',
    )
    await expect(canvas.getByLabelText('Mot de passe actuel')).toHaveValue('')
  },
}
export const RemovePassword: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Supprimer le mot de passe' }),
    )
    await userEvent.type(
      canvas.getByLabelText('Mot de passe actuel'),
      'old-password',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirmer la suppression' }),
    )
    await expect(args.onPassword).toHaveBeenCalledWith('old-password', '')
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Mot de passe supprimé',
    )
  },
}
export const UploadPhoto: Story = {
  play: async ({ canvas, args }) => {
    const file = new File(['fixture'], 'avatar.png', { type: 'image/png' })
    await userEvent.upload(
      canvas.getByLabelText('Choisir une photo de profil'),
      file,
    )
    await expect(args.onUpload).toHaveBeenCalledWith(file)
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Photo de profil mise à jour',
    )
  },
}
export const ResetGooglePhoto: Story = {
  args: {
    ...Google.args,
    profile: {
      ...profileFixture,
      imageTag: 'custom-image',
      google: {
        email: 'alex@example.com',
        picture: 'https://lh3.googleusercontent.com/avatar',
      },
    },
  },
  play: async ({ canvas, args }) => {
    const trigger = canvas.getByRole('button', {
      name: 'Revenir à la photo Google',
    })
    await userEvent.click(trigger)
    await expect(canvas.getByRole('button', { name: 'Annuler' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Revenir à la photo Google' }),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await expect(args.onDeleteImage).toHaveBeenCalledOnce()
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Photo réinitialisée',
    )
  },
}
export const UploadFailure: Story = {
  args: {
    onUpload: fn().mockRejectedValue(
      new Error('Choisis une image de moins de 2 Mo.'),
    ),
  },
  beforeEach: ({ args }) => {
    args.onUpload.mockRejectedValue(
      new Error('Choisis une image de moins de 2 Mo.'),
    )
  },
  play: async ({ canvas }) => {
    await userEvent.upload(
      canvas.getByLabelText('Choisir une photo de profil'),
      new File(['fixture'], 'avatar.png', { type: 'image/png' }),
    )
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'moins de 2 Mo',
    )
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument()
  },
}
export const Administrator: Story = {
  args: { profile: { ...profileFixture, isAdministrator: true } },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole('button', { name: 'Supprimer le mot de passe' }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole('link', { name: 'Administration' }),
    ).toHaveAttribute('href', '/admin')
  },
}
export const Restricted: Story = {
  args: { profile: { ...profileFixture, canEdit: false } },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole('button', { name: 'Changer la photo' }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByLabelText('Nouveau mot de passe'),
    ).not.toBeInTheDocument()
  },
}
export const Loading: Story = { args: { state: 'loading', profile: undefined } }
export const LoadError: Story = {
  args: { state: 'error', profile: undefined },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}
