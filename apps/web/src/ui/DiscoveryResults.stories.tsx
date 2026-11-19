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
type PlayContext = Parameters<NonNullable<Story['play']>>[0]

async function previewAction(
  { canvas, userEvent }: Pick<PlayContext, 'canvas' | 'userEvent'>,
  index = 0,
  action = 'Demander',
) {
  const card = await canvas.findByRole('article', {
    name: discoveryFixtures[index].title,
  })
  const trigger = within(card).getByRole('button', {
    name: discoveryFixtures[index].title,
  })
  await userEvent.hover(trigger)
  return within(card).findByRole('button', { name: action })
}

export const Discover: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('button', { name: 'ORBITAL' })
    await expect(canvas.queryByRole('heading', { name: 'ORBITAL' })).toBeNull()
    await expect(
      await previewAction({ canvas, userEvent }, 4, 'Déjà demandé'),
    ).toBeDisabled()
    await expect(
      await previewAction({ canvas, userEvent }, 5, 'Service indisponible'),
    ).toBeDisabled()
    await expect(await previewAction({ canvas, userEvent })).toBeEnabled()
    await expect(canvas.getByRole('heading', { name: 'ORBITAL' })).toBeVisible()
  },
}
export const RefineSearch: Story = {
  render: function Render(args) {
    const [query, setQuery] = useState(args.query)
    return (
      <>
        <input
          aria-label="Recherche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <DiscoveryResults {...args} query={query} />
      </>
    )
  },
  play: async ({ canvas, userEvent }) => {
    const title = await canvas.findByRole('button', { name: 'ORBITAL' })
    const field = canvas.getByRole('textbox', { name: 'Recherche' })
    await userEvent.type(field, ' 2')
    await expect(canvas.getByRole('button', { name: 'ORBITAL' })).toBe(title)
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Recherche en cours',
    )
    await waitFor(() => expect(canvas.queryByRole('status')).toBeNull())
    await expect(canvas.getByRole('button', { name: 'ORBITAL' })).toBe(title)
    await expect(field).toHaveFocus()
  },
}
export const MemberRequest: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await previewAction({ canvas, userEvent }))
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
    await userEvent.click(await previewAction({ canvas, userEvent }))
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await canvas.findByRole('link', { name: 'Voir mes demandes' })
    await userEvent.click(
      canvas.getByRole('button', { name: 'Continuer à explorer' }),
    )
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: discoveryFixtures[0].title }),
      ).toHaveFocus(),
    )
    await userEvent.click(await previewAction({ canvas, userEvent }, 1))
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
    await userEvent.click(await previewAction({ canvas, userEvent }))
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
    const trigger = await canvas.findByRole('button', {
      name: discoveryFixtures[0].title,
    })
    await userEvent.click(await previewAction({ canvas, userEvent }))
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
    await userEvent.click(await previewAction({ canvas, userEvent }))
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
    await userEvent.click(await previewAction({ canvas, userEvent }))
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await canvas.findByRole('link', { name: 'Voir mes demandes' })
    await userEvent.click(
      canvas.getByRole('button', { name: 'Continuer à explorer' }),
    )
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await expect(await previewAction({ canvas, userEvent }, 1)).toBeEnabled()
    await expect(
      await previewAction({ canvas, userEvent }, 0, 'Déjà demandé'),
    ).toBeDisabled()
    await expect(
      await previewAction({ canvas, userEvent }, 4, 'Déjà demandé'),
    ).toBeDisabled()
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
    await userEvent.click(await previewAction({ canvas, userEvent }))
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
    await userEvent.click(await previewAction({ canvas, userEvent }))
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
    await userEvent.click(await previewAction({ canvas, userEvent }))
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
