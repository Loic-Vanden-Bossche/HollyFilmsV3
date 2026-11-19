import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, mocked, within } from 'storybook/test'
import type { AdminUserDetails } from '@hollyfilms/shared/accounts'
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUser,
  getAdminUserOptions,
  updateAdminUserName,
  updateAdminUserPassword,
  updateAdminUserPolicy,
} from './account-api.ts'
import { AdminUserEditor } from './AdminUserEditor.tsx'
import { requestSession } from './request-fixtures.ts'

const account: AdminUserDetails = {
  id: 'native-member',
  username: 'Camille',
  administrator: false,
  disabled: false,
  hidden: true,
  lastActivityAt: null,
  registrationMethod: null,
  setupPending: false,
  canChangeAccess: true,
  canEdit: true,
  canRename: true,
  canChangePassword: true,
  canChangeRole: true,
  canChangeProviders: true,
  canDelete: true,
  isCurrentUser: false,
  policy: {
    IsHidden: true,
    EnableRemoteAccess: true,
    EnableAllFolders: true,
    EnableAllDevices: true,
    EnableAllChannels: true,
    EnableMediaPlayback: true,
  },
}

const meta = {
  title: 'HollyFilms/Gestion des utilisateurs',
  component: AdminUserEditor,
  args: { session: requestSession, account, onChanged: fn(), onClose: fn() },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: () => {
    mocked(getAdminUser).mockResolvedValue(account)
    mocked(getAdminUserOptions).mockResolvedValue({
      libraries: [
        { id: 'movies', name: 'Cinéma' },
        { id: 'series', name: 'Séries classiques' },
      ],
      devices: [{ id: 'tv', name: 'TV du salon' }],
      channels: [],
      ratings: [
        {
          id: 'fr-12',
          name: 'Interdit aux moins de 12 ans',
          value: 12,
          subValue: null,
        },
      ],
      authenticationProviders: [{ id: 'default', name: 'Jellyfin' }],
      passwordResetProviders: [{ id: 'default', name: 'Jellyfin' }],
    })
    mocked(createAdminUser).mockResolvedValue()
    mocked(deleteAdminUser).mockResolvedValue()
    mocked(updateAdminUserName).mockResolvedValue()
    mocked(updateAdminUserPassword).mockResolvedValue()
    mocked(updateAdminUserPolicy).mockResolvedValue()
  },
} satisfies Meta<typeof AdminUserEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Settings: Story = {
  name: 'Modifier les permissions et les horaires',
  play: async ({ canvas, userEvent }) => {
    const editor = within(
      await canvas.findByRole('dialog', { name: 'Camille' }),
    )
    const hidden = await editor.findByRole('checkbox', {
      name: /Masquer sur l’écran de connexion/,
    })
    await expect(hidden).toBeChecked()
    await userEvent.click(hidden)
    await userEvent.click(
      editor.getByRole('button', { name: 'Accès aux ressources' }),
    )
    const allowAll = await editor.findByRole('checkbox', {
      name: 'Toutes les bibliothèques',
    })
    await userEvent.click(allowAll)
    await userEvent.click(
      within(editor.getByRole('group', { name: /^Bibliothèques$/ })).getByRole(
        'checkbox',
        { name: 'Cinéma' },
      ),
    )
    await userEvent.click(
      editor.getByRole('button', { name: 'Contrôle parental' }),
    )
    await userEvent.selectOptions(
      await editor.findByRole('combobox', { name: 'Classification maximale' }),
      'fr-12',
    )
    await userEvent.click(
      editor.getByRole('button', { name: 'Ajouter un créneau' }),
    )
    await userEvent.selectOptions(
      within(editor.getByRole('group', { name: 'Créneau 1' })).getByRole(
        'combobox',
        { name: 'Jour' },
      ),
      'Weekend',
    )
    await userEvent.click(
      editor.getByRole('button', { name: 'Enregistrer les paramètres' }),
    )
    await expect(updateAdminUserPolicy).toHaveBeenCalledWith(
      requestSession,
      account.id,
      {
        IsHidden: false,
        EnableAllFolders: false,
        EnabledFolders: ['movies'],
        MaxParentalRating: 12,
        MaxParentalSubRating: null,
        AccessSchedules: [{ DayOfWeek: 'Weekend', StartHour: 8, EndHour: 22 }],
      },
    )
    await expect(
      await editor.findByText('Modifications enregistrées.'),
    ).toBeVisible()
  },
}

export const Create: Story = {
  name: 'Ajouter un utilisateur',
  args: { account: undefined },
  play: async ({ args, canvas, userEvent }) => {
    const editor = within(
      await canvas.findByRole('dialog', { name: 'Ajouter un utilisateur' }),
    )
    await userEvent.type(
      editor.getByRole('textbox', { name: 'Nom d’utilisateur' }),
      'Alix',
    )
    await userEvent.type(
      editor.getByLabelText('Mot de passe'),
      'fictional-test-passphrase',
    )
    await userEvent.click(
      editor.getByRole('button', { name: 'Créer le compte' }),
    )
    await expect(createAdminUser).toHaveBeenCalledWith(
      requestSession,
      'Alix',
      'fictional-test-passphrase',
    )
    await expect(args.onChanged).toHaveBeenCalled()
    await expect(args.onClose).toHaveBeenCalled()
  },
}

const googleAccount: AdminUserDetails = {
  ...account,
  id: 'google-member',
  displayName: 'Jo Martin',
  username: 'Google-example',
  registrationMethod: 'GOOGLE',
  canRename: false,
  canChangePassword: false,
  canChangeProviders: false,
}

export const GoogleAccount: Story = {
  name: 'Compte Google et confirmation de suppression',
  args: { account: googleAccount },
  beforeEach: ({ args }) => {
    mocked(getAdminUser).mockResolvedValue(args.account as AdminUserDetails)
  },
  play: async ({ canvas, userEvent }) => {
    const editor = within(
      await canvas.findByRole('dialog', { name: 'Jo Martin' }),
    )
    await expect(
      await editor.findByText('Ce compte utilise son profil Google.'),
    ).toBeVisible()
    await userEvent.click(editor.getByRole('button', { name: 'Sécurité' }))
    await expect(
      editor.getByText('Le mot de passe de ce compte est géré par Google.'),
    ).toBeVisible()
    await userEvent.click(
      editor.getByRole('button', { name: 'Supprimer le compte' }),
    )
    await expect(
      editor.getByText('Supprimer définitivement le compte de Jo Martin ?'),
    ).toBeVisible()
    await userEvent.click(editor.getByRole('button', { name: 'Annuler' }))
    await expect(deleteAdminUser).not.toHaveBeenCalled()
  },
}
