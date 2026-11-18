import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, mocked, waitFor } from 'storybook/test'
import { PlayerSubtitleTools } from './PlayerSubtitleTools.tsx'
import { PlayerSettingsPanel } from './PlayerSettingsPanel.tsx'
import { SubtitleSyncActions } from './SubtitleSyncActions.tsx'
import { SubtitlePanel } from './SubtitlePanel.tsx'
import { SubtitleAppearance } from './SubtitleAppearance.tsx'
import { classicSubtitle } from '../playback/preferences.ts'
import { Select } from './Select.tsx'
import { getSubtitleLibrary, searchSubtitles } from '../subtitles-api.ts'
import {
  subtitleCandidates,
  subtitleItemId,
  subtitleLibraryFixture,
  subtitleSession,
} from '../subtitle-fixtures.ts'
import '../player.css'

const triggerName =
  'Sous-titres externes Rechercher ou demander des sous-titres'

const meta = {
  title: 'UI/Lecteur/Sous-titres dépliants',
  component: PlayerSubtitleTools,
  args: {
    children: (
      <SubtitlePanel
        session={subtitleSession}
        itemId={subtitleItemId}
        onChanged={fn(async () => {})}
      />
    ),
  },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      const [styles, setStyles] = useState({
        primary: classicSubtitle,
        secondary: classicSubtitle,
      })
      const [primary, setPrimary] = useState('fr')
      const [secondary, setSecondary] = useState('zh')
      const [open, setOpen] = useState(true)
      return (
        <QueryClientProvider client={client}>
          <div style={{ position: 'relative', height: 'calc(100dvh - 2rem)' }}>
            {open ? (
              <PlayerSettingsPanel
                menu="subtitles"
                onClose={() => setOpen(false)}
              >
                <label>
                  Langue
                  <Select
                    aria-label="Langue"
                    value={primary}
                    onValueChange={(value) => {
                      setPrimary(value)
                      if (value === 'off') setSecondary('off')
                    }}
                  >
                    <option value="off">Désactivés</option>
                    <option value="fr">Français</option>
                  </Select>
                </label>
                {primary !== 'off' && (
                  <label>
                    Deuxième piste
                    <Select
                      aria-label="Deuxième piste"
                      value={secondary}
                      onValueChange={setSecondary}
                    >
                      <option value="off">Désactivée</option>
                      <option value="zh">Chinois</option>
                    </Select>
                  </label>
                )}
                <SubtitleSyncActions
                  primary={
                    primary !== 'off'
                      ? { canAdjust: true, loading: false }
                      : undefined
                  }
                  secondary={
                    secondary !== 'off'
                      ? { canAdjust: true, loading: false }
                      : undefined
                  }
                  onOpen={fn()}
                />
                {primary !== 'off' && (
                  <SubtitleAppearance
                    hasSecondary={secondary !== 'off'}
                    styles={styles}
                    onChange={(slot, style) =>
                      setStyles((current) => ({ ...current, [slot]: style }))
                    }
                  />
                )}
                <Story />
              </PlayerSettingsPanel>
            ) : (
              <button onClick={() => setOpen(true)}>Sous-titres</button>
            )}
          </div>
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: () => {
    mocked(getSubtitleLibrary)
      .mockReset()
      .mockResolvedValue(subtitleLibraryFixture)
    mocked(searchSubtitles)
      .mockReset()
      .mockResolvedValue({ items: subtitleCandidates })
  },
} satisfies Meta<typeof PlayerSubtitleTools>
export default meta
type Story = StoryObj<typeof meta>

export const Collapsed: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: triggerName }),
    ).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() =>
      expect(canvas.getByRole('combobox', { name: /^Langue$/ })).toBeVisible(),
    )
    await expect(
      canvas.queryByRole('region', { name: 'Sous-titres externes' }),
    ).not.toBeInTheDocument()
    await expect(getSubtitleLibrary).not.toHaveBeenCalled()
  },
}

export const Administrator: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: triggerName })
    await userEvent.click(trigger)
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Rechercher des sous-titres' }),
    )
    const download = await canvas.findByRole('button', {
      name: 'Télécharger ce sous-titre',
    })
    await waitFor(() => expect(download).toBeVisible())
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(
      canvas.queryByRole('button', { name: 'Télécharger ce sous-titre' }),
    ).not.toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(download).toBeVisible())
    await expect(searchSubtitles).toHaveBeenCalledTimes(1)
    await expect(getSubtitleLibrary).toHaveBeenCalledTimes(1)
  },
}

export const MemberKeyboard: Story = {
  beforeEach: () => {
    mocked(getSubtitleLibrary).mockResolvedValue({
      ...subtitleLibraryFixture,
      administrator: false,
    })
  },
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: triggerName })
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    const request = await canvas.findByRole('button', {
      name: 'Demander cette langue',
    })
    await waitFor(() => expect(request).toBeVisible())
    await userEvent.keyboard(' ')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(trigger).toHaveFocus())
    await expect(
      canvas.queryByRole('button', { name: 'Demander cette langue' }),
    ).not.toBeInTheDocument()
  },
}
