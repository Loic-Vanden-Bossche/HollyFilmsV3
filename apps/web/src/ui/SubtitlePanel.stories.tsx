import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, mocked, waitFor, within } from 'storybook/test'
import { SubtitlePanel } from './SubtitlePanel.tsx'
import {
  getSubtitleLibrary,
  searchSubtitles,
  requestSubtitles,
  downloadSubtitles,
} from '../subtitles-api.ts'
import {
  subtitleCandidates,
  subtitleItemId,
  subtitleLibraryFixture,
  subtitleRequestFixture,
  subtitleSession,
} from '../subtitle-fixtures.ts'

const meta = {
  title: 'UI/Sous-titres externes',
  component: SubtitlePanel,
  args: {
    session: subtitleSession,
    itemId: subtitleItemId,
    onChanged: fn(async () => {}),
  },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      return (
        <QueryClientProvider client={client}>
          <div
            className="glass-panel"
            style={{
              padding: 24,
              borderRadius: 24,
              maxWidth: 720,
              margin: '24px auto',
            }}
          >
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: () => {
    let installed = false
    mocked(getSubtitleLibrary)
      .mockReset()
      .mockImplementation(async () => ({
        ...subtitleLibraryFixture,
        versions: subtitleLibraryFixture.versions.map((source, index) =>
          index === 0 && installed
            ? {
                ...source,
                tracks: [
                  ...source.tracks,
                  {
                    index: 3,
                    language: 'fra',
                    title: 'French · SRT',
                    external: true,
                    codec: 'subrip',
                  },
                ],
              }
            : source,
        ),
      }))
    mocked(searchSubtitles)
      .mockReset()
      .mockResolvedValue({ items: subtitleCandidates })
    mocked(requestSubtitles)
      .mockReset()
      .mockResolvedValue(subtitleRequestFixture)
    mocked(downloadSubtitles)
      .mockReset()
      .mockImplementation(async () => {
        installed = true
        return { ...subtitleRequestFixture, status: 'DOWNLOADED' }
      })
  },
} satisfies Meta<typeof SubtitlePanel>
export default meta
type Story = StoryObj<typeof meta>
export const AdministratorDownload: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Rechercher des sous-titres' }),
    )
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Télécharger ce sous-titre' }),
    )
    await expect(downloadSubtitles).not.toHaveBeenCalled()
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Confirmer le téléchargement',
      }),
    )
    await waitFor(() =>
      expect(downloadSubtitles).toHaveBeenCalledWith(
        subtitleSession,
        subtitleItemId,
        subtitleItemId,
        'fra',
        subtitleCandidates[0].id,
        undefined,
      ),
    )
    await waitFor(() =>
      expect(
        within(canvas.getByRole('dialog')).getByText('Sous-titre installé'),
      ).toBeVisible(),
    )
    await waitFor(() => expect(args.onChanged).toHaveBeenCalledTimes(2))
  },
}
export const MemberRequest: Story = {
  beforeEach: () => {
    mocked(getSubtitleLibrary).mockResolvedValue({
      ...subtitleLibraryFixture,
      administrator: false,
    })
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Demander cette langue' }),
    )
    await expect(requestSubtitles).not.toHaveBeenCalled()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirmer la demande' }),
    )
    await waitFor(() =>
      expect(requestSubtitles).toHaveBeenCalledWith(
        subtitleSession,
        subtitleItemId,
        subtitleItemId,
        'fra',
      ),
    )
    await expect(
      await within(canvas.getByRole('dialog')).findByRole('status'),
    ).toHaveTextContent('En attente')
    await expect(
      canvas.queryByRole('button', { name: 'Rechercher des sous-titres' }),
    ).not.toBeInTheDocument()
    await expect(downloadSubtitles).not.toHaveBeenCalled()
  },
}
export const Approval: Story = {
  args: {
    requestId: subtitleRequestFixture.id,
    language: 'fra',
    sourceId: subtitleItemId,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Rechercher des sous-titres' }),
    )
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Approuver et télécharger' }),
    )
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Confirmer l’approbation et télécharger',
      }),
    )
    await waitFor(() =>
      expect(downloadSubtitles).toHaveBeenCalledWith(
        subtitleSession,
        subtitleItemId,
        subtitleItemId,
        'fra',
        subtitleCandidates[0].id,
        subtitleRequestFixture.id,
      ),
    )
  },
}
export const EmptyProvider: Story = {
  beforeEach: () => {
    mocked(searchSubtitles).mockResolvedValue({ items: [] })
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Rechercher des sous-titres' }),
    )
    await waitFor(() =>
      expect(
        canvas.getByText(
          'Aucun sous-titre trouvé. Essayez sans la correspondance exacte.',
        ),
      ).toBeVisible(),
    )
  },
}
export const UnavailableProvider: Story = {
  beforeEach: () => {
    mocked(searchSubtitles).mockRejectedValue(
      new Error('Le service de sous-titres est indisponible.'),
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Rechercher des sous-titres' }),
    )
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'indisponible',
    )
    await expect(downloadSubtitles).not.toHaveBeenCalled()
  },
}
export const Verifying: Story = {
  beforeEach: () => {
    mocked(getSubtitleLibrary).mockResolvedValue({
      ...subtitleLibraryFixture,
      requests: [{ ...subtitleRequestFixture, status: 'DOWNLOADING' }],
    })
  },
}
export const NarrowPanel: Story = {
  ...MemberRequest,
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
}
export const Unconfirmed: Story = {
  beforeEach: () => {
    mocked(getSubtitleLibrary).mockResolvedValue({
      ...subtitleLibraryFixture,
      requests: [
        {
          ...subtitleRequestFixture,
          status: 'FAILED',
          lastError: 'SUBTITLE_UNCONFIRMED',
        },
      ],
    })
  },
}
export const Loading: Story = {
  beforeEach: () => {
    mocked(getSubtitleLibrary).mockImplementation(() => new Promise(() => {}))
  },
}
export const VersionsAndKeyboard: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('combobox', { name: 'Version du média' }),
    )
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Rechercher des sous-titres' }),
    )
    await waitFor(() =>
      expect(searchSubtitles).toHaveBeenCalledWith(
        subtitleSession,
        subtitleItemId,
        subtitleLibraryFixture.versions[1].id,
        'fra',
        true,
      ),
    )
  },
}

export const Searching: Story = {
  beforeEach: () => {
    mocked(searchSubtitles).mockImplementation(() => new Promise(() => {}))
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Rechercher des sous-titres' }),
    )
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent(
        'Recherche en cours…',
      ),
    )
    await expect(
      canvas.getByRole('button', { name: 'Recherche en cours…' }),
    ).toBeDisabled()
  },
}
export const SendingRequest: Story = {
  beforeEach: () => {
    mocked(getSubtitleLibrary).mockResolvedValue({
      ...subtitleLibraryFixture,
      administrator: false,
    })
    mocked(requestSubtitles).mockImplementation(() => new Promise(() => {}))
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Demander cette langue' }),
    )
    await userEvent.dblClick(
      canvas.getByRole('button', { name: 'Confirmer la demande' }),
    )
    await expect(requestSubtitles).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(
        within(canvas.getByRole('dialog')).getByRole('status'),
      ).toHaveTextContent('Envoi…'),
    )
    await userEvent.keyboard('{Escape}')
    await expect(canvas.getByRole('dialog')).toBeVisible()
  },
}
export const FailedInstall: Story = {
  beforeEach: () => {
    mocked(downloadSubtitles).mockRejectedValue(
      new Error('Le service de sous-titres est indisponible.'),
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Rechercher des sous-titres' }),
    )
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Télécharger ce sous-titre' }),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirmer le téléchargement' }),
    )
    await expect(
      await within(canvas.getByRole('dialog')).findByRole('alert'),
    ).toHaveTextContent('indisponible')
    await expect(
      canvas.queryByText('Sous-titre installé'),
    ).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Annuler' }))
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Télécharger ce sous-titre' }),
      ).toHaveFocus(),
    )
  },
}
export const AlreadyRequested: Story = {
  beforeEach: () => {
    mocked(getSubtitleLibrary).mockResolvedValue({
      ...subtitleLibraryFixture,
      administrator: false,
      requests: [subtitleRequestFixture],
    })
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('button', { name: 'Déjà demandé' }),
    ).toBeDisabled()
    await expect(requestSubtitles).not.toHaveBeenCalled()
  },
}

export const RefreshFailure: Story = {
  beforeEach: () => {
    mocked(getSubtitleLibrary)
      .mockResolvedValueOnce(subtitleLibraryFixture)
      .mockRejectedValue(new Error('Impossible de charger les sous-titres.'))
  },
  play: async ({ canvas, userEvent, args }) => {
    await canvas.findByRole('combobox', { name: 'Version du média' })
    await userEvent.click(
      canvas.getByRole('button', { name: 'Actualiser les pistes' }),
    )
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Impossible',
    )
    await expect(
      canvas.getByRole('combobox', { name: 'Version du média' }),
    ).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Rechercher des sous-titres' }),
    ).toBeEnabled()
    await expect(args.onChanged).toHaveBeenCalled()
  },
}

export const InstallationVerification: Story = {
  beforeEach: () => {
    let checking = false,
      reads = 0
    mocked(downloadSubtitles).mockImplementation(async () => {
      checking = true
      return { ...subtitleRequestFixture, status: 'DOWNLOADING' }
    })
    mocked(getSubtitleLibrary).mockImplementation(async () => {
      const installed = checking && ++reads >= 2
      return {
        ...subtitleLibraryFixture,
        requests: checking
          ? [
              {
                ...subtitleRequestFixture,
                status: installed ? 'DOWNLOADED' : 'DOWNLOADING',
              },
            ]
          : [],
        versions: subtitleLibraryFixture.versions.map((source, index) =>
          installed && index === 0
            ? {
                ...source,
                tracks: [
                  ...source.tracks,
                  {
                    index: 3,
                    language: 'fra',
                    title: 'French · SRT',
                    external: true,
                    codec: 'subrip',
                  },
                ],
              }
            : source,
        ),
      }
    })
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Rechercher des sous-titres' }),
    )
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Télécharger ce sous-titre' }),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirmer le téléchargement' }),
    )
    await waitFor(() =>
      expect(
        within(canvas.getByRole('dialog')).getByRole('status'),
      ).toHaveTextContent('Vérification du sous-titre…'),
    )
    await expect(
      canvas.queryByText('Sous-titre installé'),
    ).not.toBeInTheDocument()
    await waitFor(
      () =>
        expect(
          within(canvas.getByRole('dialog')).getByRole('status'),
        ).toHaveTextContent('Sous-titre installé'),
      { timeout: 6000 },
    )
    await expect(args.onChanged).toHaveBeenCalledTimes(2)
    await userEvent.click(canvas.getByRole('button', { name: 'Fermer' }))
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await expect(
      canvas.getByRole('button', { name: 'Installé' }),
    ).toBeDisabled()
  },
}
