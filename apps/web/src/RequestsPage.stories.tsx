import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, mocked, waitFor, within } from 'storybook/test'
import { RequestsPage } from './RequestsPage.tsx'
import { getSubtitleRequests } from './subtitles-api.ts'
import { subtitleRequestFixture } from './subtitle-fixtures.ts'
import {
  getMediaRequests,
  getRequestOptions,
  decideMediaRequest,
} from './requests-api.ts'
import {
  requestSession,
  requestFixtures,
  requestServices,
  adminRequestServices,
} from './request-fixtures.ts'

const meta = {
  title: 'HollyFilms/Demandes de médias',
  component: RequestsPage,
  args: { session: requestSession },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: () => {
    mocked(getRequestOptions).mockResolvedValue(requestServices)
    mocked(getMediaRequests).mockResolvedValue({
      items: requestFixtures.map(({ admin: _admin, ...item }) => item),
      page: 1,
      pages: 1,
      total: 4,
      serviceErrors: [],
    })
    mocked(decideMediaRequest).mockReset().mockResolvedValue({ ok: true })
  },
} satisfies Meta<typeof RequestsPage>
export default meta
type Story = StoryObj<typeof meta>
export const MyRequests: Story = {
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: 'ORBITAL' })).toBeVisible(),
    )
    await expect(canvas.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '63.7',
    )
    await expect(
      canvas.queryByRole('button', { name: 'Approuver' }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByText('Informations administrateur'),
    ).not.toBeInTheDocument()
  },
}

export const ProgressUpdates: Story = {
  name: 'Suivi — transition vers le téléchargement',
  beforeEach: () => {
    const pending = { ...requestFixtures[0], downloads: [] }
    const page = {
      items: [pending],
      page: 1,
      pages: 1,
      total: 1,
      serviceErrors: [],
    }
    mocked(getMediaRequests)
      .mockResolvedValueOnce(page)
      .mockResolvedValue({
        ...page,
        items: [
          {
            ...pending,
            status: 2,
            downloads: [{ progress: 47.5, status: 'downloading' }],
          },
        ],
      })
  },
  play: async ({ canvas, userEvent }) => {
    const heading = await canvas.findByRole('heading', { name: 'ORBITAL' })
    const row = heading.closest('article')
    await userEvent.click(canvas.getByRole('button', { name: 'Actualiser' }))
    await waitFor(() =>
      expect(canvas.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '47.5',
      ),
    )
    await waitFor(() =>
      expect(canvas.getByText('Téléchargement en cours')).toBeVisible(),
    )
    await expect(
      canvas.getByRole('heading', { name: 'ORBITAL' }).closest('article'),
    ).toBe(row)
  },
}
export const SubtitleTab: Story = {
  beforeEach: () => {
    mocked(getSubtitleRequests).mockResolvedValue({
      items: [subtitleRequestFixture],
      total: 1,
      pages: 1,
      page: 1,
    })
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Sous-titres' }))
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Demandes de sous-titres' }),
      ).toBeVisible(),
    )
    await expect(new URLSearchParams(location.search).get('section')).toBe(
      'subtitles',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Médias' }))
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Mes demandes' }),
      ).toBeVisible(),
    )
  },
}
export const Administration: Story = {
  args: { administrator: true },
  beforeEach: () => {
    mocked(getRequestOptions).mockResolvedValue(adminRequestServices)
    mocked(getMediaRequests).mockResolvedValue({
      items: requestFixtures,
      page: 1,
      pages: 1,
      total: 4,
      serviceErrors: [],
    })
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Approuver' }),
    )
    await waitFor(() =>
      expect(decideMediaRequest).toHaveBeenCalledWith(
        requestSession,
        1,
        'approve',
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Refuser' }))
    await expect(decideMediaRequest).not.toHaveBeenCalledWith(
      requestSession,
      1,
      'decline',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirmer le refus' }),
    )
    await waitFor(() =>
      expect(decideMediaRequest).toHaveBeenCalledWith(
        requestSession,
        1,
        'decline',
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() =>
      expect(decideMediaRequest).toHaveBeenCalledWith(
        requestSession,
        4,
        'retry',
      ),
    )
  },
}
export const Empty: Story = {
  beforeEach: () => {
    mocked(getMediaRequests).mockResolvedValue({
      items: [],
      page: 1,
      pages: 0,
      total: 0,
      serviceErrors: [],
    })
  },
}
export const Unavailable: Story = {
  beforeEach: () => {
    mocked(getMediaRequests).mockRejectedValue(
      new Error('Le service de demandes est momentanément indisponible.'),
    )
  },
}
export const Loading: Story = {
  beforeEach: () => {
    mocked(getMediaRequests).mockImplementation(() => new Promise(() => {}))
  },
}
export const PaginationAndFilters: Story = {
  beforeEach: () => {
    mocked(getMediaRequests).mockResolvedValue({
      items: requestFixtures,
      page: 1,
      pages: 3,
      total: 48,
      serviceErrors: [],
    })
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Suivant' }),
    )
    await waitFor(() =>
      expect(getMediaRequests).toHaveBeenLastCalledWith(
        requestSession,
        false,
        2,
        'all',
        'fr',
        expect.any(AbortSignal),
      ),
    )
    const filter = canvas.getByRole('combobox', { name: 'État des demandes' })
    if (filter.tagName === 'SELECT') {
      await userEvent.selectOptions(filter, 'pending')
    } else {
      await userEvent.click(filter)
      const body = within(filter.ownerDocument.body)
      await waitFor(() =>
        expect(body.getByRole('option', { name: 'Toutes' })).toHaveFocus(),
      )
      await userEvent.keyboard('{ArrowDown}{Enter}')
    }
    await waitFor(() =>
      expect(getMediaRequests).toHaveBeenLastCalledWith(
        requestSession,
        false,
        1,
        'pending',
        'fr',
        expect.any(AbortSignal),
      ),
    )
  },
}
