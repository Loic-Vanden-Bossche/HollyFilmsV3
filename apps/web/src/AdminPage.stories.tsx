import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { mocked } from 'storybook/test'
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
        <div className="member-shell mx-auto max-w-xl">
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

export const Unavailable: Story = {
  name: 'Erreur de chargement',
  beforeEach: () => {
    mocked(listRegistrations).mockRejectedValue(
      new Error('Impossible de vérifier les droits auprès du serveur.'),
    )
  },
}
