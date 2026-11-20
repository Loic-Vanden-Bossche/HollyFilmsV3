import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, mocked, waitFor, within } from 'storybook/test'
import type {
  AdminUser,
  RegistrationSummary,
} from '@hollyfilms/shared/accounts'
import { getJellyfinServerInfo } from '@hollyfilms/shared/jellyfin'
import { AdminDashboard } from './AdminDashboard.tsx'
import {
  decideRegistration,
  getAdminUser,
  listAdminUsers,
  listRegistrations,
  setAdminUserAccess,
} from './account-api.ts'
import { getMediaRequests, getRequestOptions } from './requests-api.ts'
import { getSubtitleRequests } from './subtitles-api.ts'
import {
  adminRequestServices,
  requestFixtures,
  requestSession,
} from './request-fixtures.ts'
import { subtitleRequestFixture } from './subtitle-fixtures.ts'

const account: AdminUser = {
  id: 'jellyfin-member',
  username: 'Camille',
  administrator: false,
  disabled: false,
  hidden: false,
  lastActivityAt: '2026-01-12T10:00:00Z',
  registrationMethod: null,
  setupPending: false,
  canChangeAccess: true,
}

const meta = {
  title: 'HollyFilms/Tableau de bord administrateur',
  component: AdminDashboard,
  args: { session: requestSession, initialSection: 'users' },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, { id }) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client} key={id}>
          <main className="member-shell mx-auto max-w-7xl p-6">
            <Story />
          </main>
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: () => {
    mocked(getJellyfinServerInfo).mockResolvedValue({
      Version: '12.4.0',
      StartupWizardCompleted: true,
    })
    let users: AdminUser[] = [
      account,
      {
        ...account,
        id: 'admin',
        username: 'Alex',
        administrator: true,
        canChangeAccess: false,
      },
      {
        ...account,
        id: 'registered',
        username: 'Morgan',
        registrationMethod: 'PASSWORD',
      },
      {
        ...account,
        id: 'google-member',
        username: 'Google-example',
        displayName: 'Jo Martin',
        registrationMethod: 'GOOGLE',
        hidden: true,
      },
      {
        ...account,
        id: 'first-login',
        username: 'Sacha',
        registrationMethod: 'PASSWORD',
        hidden: true,
        disabled: true,
        setupPending: true,
        canChangeAccess: false,
      },
      {
        ...account,
        id: 'paused',
        username: 'Robin',
        disabled: true,
        hidden: true,
      },
    ]
    mocked(listAdminUsers)
      .mockReset()
      .mockImplementation(async () => users)
    mocked(getAdminUser).mockImplementation(async (_session, id) => {
      const user = users.find((entry) => entry.id === id)
      if (!user) throw new Error('Unknown Storybook account')
      return {
        ...user,
        canEdit: !user.setupPending,
        canRename: user.registrationMethod !== 'GOOGLE',
        canChangePassword: user.registrationMethod !== 'GOOGLE',
        canChangeRole: user.canChangeAccess,
        canChangeProviders: false,
        canDelete: user.canChangeAccess,
        isCurrentUser: user.administrator,
        policy: { IsHidden: user.hidden, IsDisabled: user.disabled },
      }
    })
    mocked(setAdminUserAccess)
      .mockReset()
      .mockImplementation(async (_session, id, disabled) => {
        users = users.map((user) =>
          user.id === id ? { ...user, disabled } : user,
        )
      })
    let registration: RegistrationSummary = {
      id: 'signup',
      username: 'Google-pending',
      method: 'GOOGLE',
      status: 'PENDING',
      createdAt: '2026-01-12T10:00:00Z',
      decidedAt: null,
      decidedBy: null,
      googleName: 'Charlie Morel',
      googleEmail: 'charlie@example.com',
      lastError: null,
    }
    mocked(listRegistrations).mockImplementation(async () => [registration])
    mocked(decideRegistration).mockImplementation(
      async (_session, id, action) => {
        if (id !== registration.id || registration.status !== 'PENDING')
          throw new Error('Unknown pending Storybook registration')
        registration = {
          ...registration,
          status: action === 'approve' ? 'ACTIVE' : 'REJECTED',
          decidedAt: '2026-01-12T11:00:00Z',
          decidedBy: 'Alex',
        }
        if (action === 'approve')
          users = [
            ...users,
            {
              ...account,
              id: 'new-member',
              username: registration.username,
              displayName: registration.googleName ?? registration.username,
              registrationMethod: 'GOOGLE',
              hidden: true,
              lastActivityAt: null,
            },
          ]
      },
    )
    mocked(getRequestOptions).mockResolvedValue(adminRequestServices)
    mocked(getMediaRequests).mockResolvedValue({
      items: requestFixtures,
      page: 1,
      pages: 1,
      total: requestFixtures.length,
      serviceErrors: [],
    })
    mocked(getSubtitleRequests).mockResolvedValue({
      items: [subtitleRequestFixture],
      page: 1,
      pages: 1,
      total: 1,
    })
  },
} satisfies Meta<typeof AdminDashboard>
export default meta
type Story = StoryObj<typeof meta>

export const Users: Story = {
  name: 'Inscriptions et utilisateurs',
}

export const ManageAccess: Story = {
  name: 'Rechercher et gérer les accès',
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Camille')
    await expect(canvas.getByText('Alex')).toBeVisible()
    await expect(
      canvas.queryByRole('button', { name: /Suspendre l’accès · Alex/ }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole('button', { name: /Rétablir l’accès · Sacha/ }),
    ).not.toBeInTheDocument()
    const search = canvas.getByRole('searchbox', {
      name: 'Rechercher un utilisateur',
    })
    await userEvent.type(search, 'jo mar')
    await expect(
      canvas.getByRole('button', { name: 'Suspendre l’accès · Jo Martin' }),
    ).toBeVisible()
    await expect(canvas.queryByText('Google-example')).not.toBeInTheDocument()
    await expect(
      canvas.getByText('Masqué sur l’écran de connexion'),
    ).toBeVisible()
    const manage = canvas.getByRole('button', { name: 'Gérer Jo Martin' })
    await userEvent.click(manage)
    const edit = await canvas.findByRole('dialog', { name: 'Jo Martin' })
    await expect(
      await within(edit).findByText('Ce compte utilise son profil Google.'),
    ).toBeVisible()
    await userEvent.click(within(edit).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(manage).toHaveFocus())
    await userEvent.clear(search)
    await userEvent.type(search, 'google-example')
    await expect(canvas.getByText('Jo Martin')).toBeVisible()
    await userEvent.clear(search)
    await userEvent.type(search, 'cam')
    await expect(canvas.queryByText('Morgan')).not.toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Suspendre l’accès · Camille' }),
    )
    const confirm = await canvas.findByRole('dialog', {
      name: 'Suspendre l’accès',
    })
    await userEvent.click(
      within(confirm).getByRole('button', { name: 'Annuler' }),
    )
    await expect(confirm).not.toBeInTheDocument()
    await expect(setAdminUserAccess).not.toHaveBeenCalled()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Suspendre l’accès · Camille' }),
    )
    await userEvent.click(
      within(canvas.getByRole('dialog')).getByRole('button', {
        name: 'Suspendre l’accès',
      }),
    )
    const restore = await canvas.findByRole('button', {
      name: 'Rétablir l’accès · Camille',
    })
    await userEvent.click(canvas.getByRole('button', { name: 'Suspendus' }))
    await expect(restore).toBeVisible()
    await userEvent.click(restore)
    await userEvent.click(
      within(canvas.getByRole('dialog')).getByRole('button', {
        name: 'Rétablir l’accès',
      }),
    )
    await waitFor(() =>
      expect(canvas.getByText('Aucun utilisateur trouvé.')).toBeVisible(),
    )
  },
}

export const Navigate: Story = {
  name: 'Demandes et inscriptions dans le tableau de bord',
  play: async ({ canvas, userEvent }) => {
    const navigation = canvas.getByRole('navigation', {
      name: 'Administration',
    })
    const nav = within(navigation)
    const service = canvas.getByRole('region', { name: 'État du service' })
    await expect(navigation.parentElement).toContainElement(service)
    await expect(navigation).not.toContainElement(service)
    await expect(
      await within(service).findByText('Connexion établie'),
    ).toBeVisible()
    await expect(nav.getAllByRole('link')).toHaveLength(3)
    await expect(
      nav.getByRole('link', { name: 'Utilisateurs' }),
    ).toHaveAttribute('aria-current', 'page')
    const inbox = within(
      canvas.getByRole('region', { name: 'Demandes d’inscription' }),
    )
    await expect(await inbox.findByText('Charlie Morel')).toBeVisible()
    await expect(
      await canvas.findByRole('button', { name: 'Gérer Camille' }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole('button', { name: 'Gérer Charlie Morel' }),
    ).toBeNull()
    await userEvent.click(inbox.getByRole('button', { name: 'Approuver' }))
    const manage = await canvas.findByRole('button', {
      name: 'Gérer Charlie Morel',
    })
    await waitFor(() => expect(inbox.queryByText('Charlie Morel')).toBeNull())
    await userEvent.click(inbox.getByRole('button', { name: /^Approuvées/ }))
    await expect(await inbox.findByText('Charlie Morel')).toBeVisible()
    await userEvent.click(manage)
    const editor = await canvas.findByRole('dialog', { name: 'Charlie Morel' })
    await userEvent.click(
      within(editor).getByRole('button', { name: 'Fermer' }),
    )
    await waitFor(() => expect(manage).toHaveFocus())
    await userEvent.click(nav.getByRole('link', { name: 'Demandes de médias' }))
    await expect(
      await canvas.findByRole('heading', { name: 'ORBITAL' }),
    ).toBeVisible()
    await userEvent.click(
      nav.getByRole('link', { name: 'Demandes de sous-titres' }),
    )
    await expect(
      await canvas.findByRole('heading', { name: 'Demandes de sous-titres' }),
    ).toBeVisible()
    await expect(
      nav.getByRole('link', { name: 'Demandes de sous-titres' }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(service).toBeVisible()
    await userEvent.click(nav.getByRole('link', { name: 'Utilisateurs' }))
    await expect(await canvas.findByText('Camille')).toBeVisible()
  },
}
