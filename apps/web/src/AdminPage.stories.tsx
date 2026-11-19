import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { expect, mocked, waitFor } from 'storybook/test'
import type { RegistrationSummary } from '@hollyfilms/shared/accounts'
import { decideRegistration, listRegistrations } from './account-api.ts'
import { AdminPage } from './AdminPage.tsx'

function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const meta = {
  title: 'HollyFilms/Administration',
  component: AdminPage,
  args: {
    session: { accessToken: 'storybook-example', deviceId: 'storybook' },
  },
  argTypes: { session: { control: false } },
  decorators: [
    (Story, { id }) => (
      <QueryProvider key={id}>
        <div className="member-shell mx-auto max-w-7xl p-6">
          <Story />
        </div>
      </QueryProvider>
    ),
  ],
} satisfies Meta<typeof AdminPage>

export default meta
type Story = StoryObj<typeof meta>

export const Requests: Story = {
  name: 'Demandes et reprise',
  beforeEach: () => {
    let requests: RegistrationSummary[] = [
      {
        id: 'password-example',
        username: 'Camille',
        method: 'PASSWORD',
        status: 'PENDING',
        createdAt: '2026-01-12T10:00:00Z',
        decidedAt: null,
        decidedBy: null,
        googleEmail: null,
        lastError: null,
      },
      {
        id: 'google-example',
        username: 'Google-example',
        method: 'GOOGLE',
        status: 'PROVISIONING',
        createdAt: '2026-01-12T09:00:00Z',
        decidedAt: '2026-01-12T11:00:00Z',
        decidedBy: 'Alex',
        googleName: 'Jo Martin',
        googleEmail: 'jo@example.com',
        lastError: 'Impossible de consulter les comptes.',
      },
    ]
    mocked(listRegistrations).mockImplementation(async () => requests)
    mocked(decideRegistration).mockImplementation(
      async (_session, id, action) => {
        requests = requests.map((request) =>
          request.id === id
            ? {
                ...request,
                status:
                  action === 'reject'
                    ? 'REJECTED'
                    : request.method === 'GOOGLE'
                      ? 'ACTIVE'
                      : 'AWAITING_PASSWORD',
                decidedAt: '2026-01-12T11:00:00Z',
                decidedBy: 'Alex',
                lastError: null,
              }
            : request,
        )
      },
    )
  },
}

export const Empty: Story = {
  name: 'Aucune demande',
  beforeEach: () => {
    mocked(listRegistrations).mockResolvedValue([])
  },
}

export const ApproveAndFilter: Story = {
  name: 'Approuver et filtrer les demandes',
  beforeEach: Requests.beforeEach,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Camille')
    await userEvent.click(canvas.getByRole('button', { name: 'À traiter' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Approuver' }))
    await waitFor(() =>
      expect(canvas.queryByText('Camille')).not.toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Approuvées' }))
    await expect(await canvas.findByText('Camille')).toBeVisible()
    await expect(
      canvas.getByText('Approuvée · Première connexion requise'),
    ).toBeVisible()
    await waitFor(() =>
      expect(canvas.queryByText('jo@example.com')).not.toBeInTheDocument(),
    )
  },
}

export const RejectAndRetry: Story = {
  name: 'Refuser et reprendre une création',
  beforeEach: Requests.beforeEach,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Camille')
    await expect(canvas.getByText('Jo Martin')).toBeVisible()
    await expect(canvas.getByText('jo@example.com')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Refuser' }))
    await waitFor(() => expect(canvas.getByText('Refusée')).toBeVisible())
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(canvas.getByText('Active')).toBeVisible())
    await expect(
      canvas.queryByText('Impossible de consulter les comptes.'),
    ).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Refusées' }))
    await expect(canvas.getByText('Camille')).toBeVisible()
    await waitFor(() =>
      expect(canvas.queryByText('jo@example.com')).not.toBeInTheDocument(),
    )
  },
}

export const Unavailable: Story = {
  name: 'Erreur de chargement',
  beforeEach: () => {
    mocked(listRegistrations).mockRejectedValue(
      new Error('Impossible de vérifier les droits auprès du serveur.'),
    )
  },
}
