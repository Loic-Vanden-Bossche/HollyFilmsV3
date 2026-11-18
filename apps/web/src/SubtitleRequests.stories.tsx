import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, mocked, waitFor, within } from 'storybook/test'
import { SubtitleRequests } from './SubtitleRequests.tsx'
import {
  getSubtitleRequests,
  getSubtitleLibrary,
  rejectSubtitleRequest,
} from './subtitles-api.ts'
import {
  subtitleSession,
  subtitleRequestFixture,
  subtitleLibraryFixture,
} from './subtitle-fixtures.ts'
import './requests.css'
const meta = {
  title: 'HollyFilms/Demandes de sous-titres',
  component: SubtitleRequests,
  args: { session: subtitleSession },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      return (
        <QueryClientProvider client={client}>
          <main className="requests-page">
            <Story />
          </main>
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: () => {
    let rejected = false
    mocked(getSubtitleRequests)
      .mockReset()
      .mockImplementation(async () => ({
        items: [
          {
            ...subtitleRequestFixture,
            status: rejected ? 'REJECTED' : 'PENDING',
          },
        ],
        page: 1,
        pages: 1,
        total: 1,
      }))
    mocked(getSubtitleLibrary).mockResolvedValue(subtitleLibraryFixture)
    mocked(rejectSubtitleRequest)
      .mockReset()
      .mockImplementation(async () => {
        rejected = true
        return { ok: true }
      })
  },
} satisfies Meta<typeof SubtitleRequests>
export default meta
type Story = StoryObj<typeof meta>
export const Member: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText('Orbital')).toBeVisible())
    await expect(
      canvas.queryByRole('button', { name: 'Rechercher et approuver' }),
    ).not.toBeInTheDocument()
  },
}
export const Administration: Story = {
  args: { administrator: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Rechercher et approuver' }),
    )
    await expect(
      await canvas.findByRole('button', { name: 'Rechercher des sous-titres' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Refuser' }))
    await canvas.findByRole('dialog')
    await expect(rejectSubtitleRequest).not.toHaveBeenCalled()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirmer le refus' }),
    )
    await waitFor(() =>
      expect(rejectSubtitleRequest).toHaveBeenCalledWith(
        subtitleSession,
        subtitleRequestFixture.id,
      ),
    )
  },
}
export const Loading: Story = {
  beforeEach: () => {
    mocked(getSubtitleRequests).mockImplementation(() => new Promise(() => {}))
  },
}
export const Verifying: Story = {
  beforeEach: () => {
    mocked(getSubtitleRequests).mockResolvedValue({
      items: [{ ...subtitleRequestFixture, status: 'DOWNLOADING' }],
      page: 1,
      pages: 1,
      total: 1,
    })
  },
}
export const PendingRejection: Story = {
  args: { administrator: true },
  beforeEach: () => {
    mocked(rejectSubtitleRequest).mockImplementation(
      () => new Promise(() => {}),
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Refuser' }),
    )
    await userEvent.dblClick(
      canvas.getByRole('button', { name: 'Confirmer le refus' }),
    )
    await expect(rejectSubtitleRequest).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(
        within(canvas.getByRole('dialog')).getByRole('status'),
      ).toHaveTextContent('Traitement en cours…'),
    )
    await userEvent.keyboard('{Escape}')
    await expect(canvas.getByRole('dialog')).toBeVisible()
  },
}
export const FailedRejection: Story = {
  args: { administrator: true },
  beforeEach: () => {
    mocked(rejectSubtitleRequest).mockRejectedValue(
      new Error('Impossible de traiter les sous-titres.'),
    )
  },
  play: async ({ canvas, userEvent }) => {
    const trigger = await canvas.findByRole('button', { name: 'Refuser' })
    await userEvent.click(trigger)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirmer le refus' }),
    )
    await expect(
      await within(canvas.getByRole('dialog')).findByRole('alert'),
    ).toHaveTextContent('Impossible')
    await userEvent.click(canvas.getByRole('button', { name: 'Annuler' }))
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}
export const StatusUpdate: Story = {
  beforeEach: () => {
    const page = {
      items: [subtitleRequestFixture],
      page: 1,
      pages: 1,
      total: 1,
    }
    mocked(getSubtitleRequests)
      .mockResolvedValueOnce(page)
      .mockResolvedValue({
        ...page,
        items: [{ ...subtitleRequestFixture, status: 'DOWNLOADED' }],
      })
  },
  play: async ({ canvas, userEvent }) => {
    const row = (
      await canvas.findByRole('heading', { name: 'Orbital' })
    ).closest('article')
    await userEvent.click(canvas.getByRole('button', { name: 'Actualiser' }))
    await waitFor(() =>
      expect(canvas.getByText('Sous-titre installé')).toBeVisible(),
    )
    await expect(
      canvas.getByRole('heading', { name: 'Orbital' }).closest('article'),
    ).toBe(row)
  },
}

export const RefreshFailure: Story = {
  beforeEach: () => {
    mocked(getSubtitleRequests)
      .mockResolvedValueOnce({
        items: [subtitleRequestFixture],
        page: 1,
        pages: 1,
        total: 1,
      })
      .mockRejectedValue(new Error('Impossible de charger les demandes.'))
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Orbital' })
    await userEvent.click(canvas.getByRole('button', { name: 'Actualiser' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Impossible',
    )
    await expect(canvas.getByRole('heading', { name: 'Orbital' })).toBeVisible()
  },
}
export const Empty: Story = {
  beforeEach: () => {
    mocked(getSubtitleRequests).mockResolvedValue({
      items: [],
      total: 0,
      pages: 0,
      page: 1,
    })
  },
}
export const Unavailable: Story = {
  beforeEach: () => {
    mocked(getSubtitleRequests).mockRejectedValue(
      new Error('Impossible de charger les demandes.'),
    )
  },
}
