import type { StoryObj, Meta } from '@storybook/react-vite'
import type { InboxItem } from '@hollyfilms/shared/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { expect, mocked, waitFor } from 'storybook/test'
import { getInbox, markNotificationsRead } from './notification-api.ts'
import { NotificationsPage } from './NotificationsPage.tsx'

const items: InboxItem[] = [
  {
    id: '1',
    title: 'Sous-titres disponibles',
    body: 'Le Voyage de Chihiro',
    url: '/requests?section=subtitles',
    createdAt: '2026-11-18T17:40:00Z',
    readAt: null,
  },
  {
    id: '2',
    title: 'Demande de média approuvée',
    body: 'Les Ailes du désir',
    url: '/requests',
    createdAt: '2026-11-17T18:40:00Z',
    readAt: null,
  },
]

const meta = {
  title: 'HollyFilms/Notifications',
  component: NotificationsPage,
  parameters: { layout: 'fullscreen' },
  args: {
    session: { deviceId: 'story-device', accessToken: 'story-token' },
    userId: 'story-user',
  },
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
    let current = items
    mocked(getInbox).mockImplementation(async () => ({
      items: current,
      unread: current.filter((item) => !item.readAt).length,
      nextCursor: null,
    }))
    mocked(markNotificationsRead).mockImplementation(async (_session, id) => {
      current = current.map((item) =>
        !id || item.id === id
          ? { ...item, readAt: '2026-11-18T17:55:00Z' }
          : item,
      )
    })
  },
} satisfies Meta<typeof NotificationsPage>
export default meta
type Story = StoryObj<typeof meta>

export const ReadMessages: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Non lues · 2')).toBeVisible()
    await expect(
      canvas.getByRole('link', { name: 'Sous-titres disponibles' }),
    ).toHaveAttribute('href', '/requests?section=subtitles&notice=1')
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Marquer comme lu · Sous-titres disponibles',
      }),
    )
    await expect(await canvas.findByText('Non lues · 1')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Tout marquer comme lu' }),
    )
    await expect(await canvas.findByText('Tout est lu')).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2)
  },
}

export const Retry: Story = {
  beforeEach: () => {
    mocked(getInbox).mockRejectedValueOnce(new Error('offline'))
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Impossible de charger',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(canvas.getAllByRole('listitem')).toHaveLength(2))
  },
}

export const Empty: Story = {
  beforeEach: () => {
    mocked(getInbox).mockResolvedValue({
      items: [],
      unread: 0,
      nextCursor: null,
    })
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('Aucune notification pour le moment'),
    ).toBeVisible()
    await expect(
      canvas.getByRole('link', { name: 'Réglages de l’appareil' }),
    ).toHaveAttribute('href', '/profile#device-notifications')
  },
}

export const OlderUpdates: Story = {
  beforeEach: () => {
    mocked(getInbox).mockImplementation(async (_session, _signal, before) =>
      before
        ? { items: [items[1]], unread: 2, nextCursor: null }
        : { items: [items[0]], unread: 2, nextCursor: '1' },
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Notifications précédentes' }),
    )
    await waitFor(() => expect(canvas.getAllByRole('listitem')).toHaveLength(2))
    await expect(
      canvas.queryByRole('button', { name: 'Notifications précédentes' }),
    ).not.toBeInTheDocument()
  },
}
