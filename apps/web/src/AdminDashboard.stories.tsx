import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, mocked, waitFor, within } from 'storybook/test'
import type { AdminUser } from '@hollyfilms/shared/accounts'
import { AdminDashboard } from './AdminDashboard.tsx'
import {
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
    mocked(setAdminUserAccess)
      .mockReset()
      .mockImplementation(async (_session, id, disabled) => {
        users = users.map((user) =>
          user.id === id ? { ...user, disabled } : user,
        )
      })
    mocked(listRegistrations).mockResolvedValue([])
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
  name: 'Tous les utilisateurs',
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
    const nav = within(
      canvas.getByRole('navigation', { name: 'Administration' }),
    )
    await userEvent.click(nav.getByRole('link', { name: 'Inscriptions' }))
    await expect(
      await canvas.findByText('Aucune demande pour le moment.'),
    ).toBeVisible()
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
    await userEvent.click(nav.getByRole('link', { name: 'Utilisateurs' }))
    await expect(await canvas.findByText('Camille')).toBeVisible()
  },
}
