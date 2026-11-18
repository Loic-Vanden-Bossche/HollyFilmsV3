import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, mocked, waitFor, within } from 'storybook/test'
import { requestFollowUpKey } from '../request-follow-up.ts'
import { DiscoveryResults } from './DiscoveryResults.tsx'
import {
  getRequestOptions,
  searchRequestTitles,
  createMediaRequest,
} from '../requests-api.ts'
import {
  requestSession,
  discoveryFixtures,
  requestFixtures,
  requestServices,
} from '../request-fixtures.ts'
import '../home.css'

const meta = {
  title: 'UI/Recherche/Demandes',
  component: DiscoveryResults,
  args: {
    session: requestSession,
    query: 'Orbital',
    userId: 'request-story-user',
  },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      return (
        <QueryClientProvider client={client}>
          <div style={{ padding: 24 }}>
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: ({ args, parameters }) => {
    if (!parameters.preserveRequestFollowUp)
      localStorage.removeItem(
        requestFollowUpKey(args.userId ?? requestSession.deviceId),
      )
    mocked(getRequestOptions).mockResolvedValue(requestServices)
    mocked(searchRequestTitles).mockResolvedValue({
      items: discoveryFixtures,
      page: 1,
      pages: 1,
    })
    mocked(createMediaRequest).mockReset().mockResolvedValue(requestFixtures[0])
  },
} satisfies Meta<typeof DiscoveryResults>
export default meta
type Story = StoryObj<typeof meta>
export const Discover: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('ORBITAL')).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Déjà demandé' }),
    ).toBeDisabled()
    await expect(
      canvas.getByRole('button', { name: 'Service indisponible' }),
    ).toBeDisabled()
  },
}
export const MemberRequest: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: 'Demander' }))[0],
    )
    await expect(createMediaRequest).not.toHaveBeenCalled()
    const dialog = within(await canvas.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() =>
      expect(createMediaRequest).toHaveBeenCalledWith(
        requestSession,
        'movie',
        100,
        'fr',
      ),
    )
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Elle attend une approbation',
    )
    await expect(
      await dialog.findByRole('link', { name: 'Voir mes demandes' }),
    ).toHaveAttribute('href', '/requests')
  },
}
export const FollowUpOnlyOnce: Story = {
  play: async ({ canvas, userEvent }) => {
    mocked(createMediaRequest).mockImplementation(
      async (_session, _type, id) => ({
        ...requestFixtures[0],
        title: discoveryFixtures.find((item) => item.id === id)!,
        id,
      }),
    )
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: 'Demander' }))[0],
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await canvas.findByRole('link', { name: 'Voir mes demandes' })
    await userEvent.click(
      canvas.getByRole('button', { name: 'Continuer à explorer' }),
    )
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(canvas.getByRole('link', { name: 'Mes demandes' })).toHaveFocus(),
    )
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: 'Demander' }))[0],
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await within(await canvas.findByRole('dialog')).findByRole('status')
    await expect(
      canvas.queryByRole('link', { name: 'Voir mes demandes' }),
    ).not.toBeInTheDocument()
    await expect(createMediaRequest).toHaveBeenCalledTimes(2)
  },
}
export const ReturningUser: Story = {
  beforeEach: ({ args }) => {
    localStorage.setItem(
      requestFollowUpKey(args.userId ?? requestSession.deviceId),
      'shown',
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: 'Demander' }))[0],
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await within(await canvas.findByRole('dialog')).findByRole('status')
    await expect(
      canvas.queryByRole('link', { name: 'Voir mes demandes' }),
    ).not.toBeInTheDocument()
  },
}
export const PersistedFollowUp: Story = {
  parameters: { preserveRequestFollowUp: true },
}
export const CancelConfirmation: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = (
      await canvas.findAllByRole('button', { name: 'Demander' })
    )[0]
    await userEvent.click(trigger)
    await userEvent.click(canvas.getByRole('button', { name: 'Annuler' }))
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(trigger).toHaveFocus())
    await expect(createMediaRequest).not.toHaveBeenCalled()
  },
}
export const PendingSubmission: Story = {
  beforeEach: () => {
    mocked(createMediaRequest).mockImplementation(() => new Promise(() => {}))
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: 'Demander' }))[0],
    )
    await userEvent.dblClick(canvas.getByRole('button', { name: 'Confirmer' }))
    await expect(
      await canvas.findByRole('button', { name: 'Envoi…' }),
    ).toBeDisabled()
    await expect(createMediaRequest).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    await expect(canvas.getByRole('dialog')).toBeVisible()
  },
}

export const SlowRefresh: Story = {
  beforeEach: () => {
    mocked(searchRequestTitles)
      .mockResolvedValueOnce({ items: discoveryFixtures, page: 1, pages: 1 })
      .mockImplementation(() => new Promise(() => {}))
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: 'Demander' }))[0],
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await canvas.findByRole('link', { name: 'Voir mes demandes' })
    await userEvent.click(
      canvas.getByRole('button', { name: 'Continuer à explorer' }),
    )
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    const next = (await canvas.findAllByRole('button', { name: 'Demander' }))[0]
    await expect(next).toBeEnabled()
    await expect(
      canvas.getAllByRole('button', { name: 'Déjà demandé' }).length,
    ).toBe(2)
    await expect(createMediaRequest).toHaveBeenCalledTimes(1)
  },
}
export const AdministratorRequest: Story = {
  args: { administrator: true },
  beforeEach: () => {
    mocked(createMediaRequest).mockResolvedValue({
      ...requestFixtures[0],
      status: 2,
    })
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: 'Demander' }))[0],
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'approuvée automatiquement',
    )
  },
}
export const Loading: Story = {
  beforeEach: () => {
    mocked(searchRequestTitles).mockImplementation(() => new Promise(() => {}))
  },
}
export const Empty: Story = {
  beforeEach: () => {
    mocked(searchRequestTitles).mockResolvedValue({
      items: [],
      page: 1,
      pages: 1,
    })
  },
}
export const Unavailable: Story = {
  beforeEach: () => {
    mocked(searchRequestTitles).mockRejectedValue(
      new Error('Service unavailable'),
    )
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'indisponible',
    )
  },
}
export const RejectedSubmission: Story = {
  beforeEach: () => {
    mocked(createMediaRequest).mockRejectedValue(
      new Error('La demande n’a pas pu être envoyée.'),
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: 'Demander' }))[0],
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'La demande n’a pas pu être envoyée.',
    )
    await expect(
      canvas.queryByText(/approuvée automatiquement/),
    ).not.toBeInTheDocument()
  },
}

export const RetrySubmission: Story = {
  beforeEach: () => {
    mocked(createMediaRequest)
      .mockRejectedValueOnce(new Error('La demande n’a pas pu être envoyée.'))
      .mockResolvedValue(requestFixtures[0])
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: 'Demander' }))[0],
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await canvas.findByRole('alert')
    await expect(
      localStorage.getItem(requestFollowUpKey(args.userId!)),
    ).toBeNull()
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Confirmer' })).toBeEnabled(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await canvas.findByRole('link', { name: 'Voir mes demandes' })
    await expect(createMediaRequest).toHaveBeenCalledTimes(2)
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
  },
}
