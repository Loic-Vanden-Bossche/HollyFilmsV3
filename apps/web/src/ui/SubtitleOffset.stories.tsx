import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import {
  originalTiming,
  type SyncJob,
  type SyncSnapshot,
} from '@hollyfilms/shared/subtitle-sync'
import { SubtitleOffset } from './SubtitleOffset.tsx'
const snapshot: SyncSnapshot = {
  fingerprint: 'fixture',
  revision: 1,
  correction: originalTiming,
  canAnalyze: false,
  job: null,
}
const meta = {
  title: 'UI/Synchronisation des sous-titres',
  component: SubtitleOffset,
  args: {
    value: originalTiming,
    initial: snapshot,
    video: null,
    origin: 0,
    trackLabel: 'Français',
    canReplay: false,
    onClose: fn(),
    onTracks: fn(),
    onChange: fn(),
    service: {
      snapshot,
      loading: false,
      retry: fn(),
      save: fn(async () => {}),
      job: fn(),
      status: fn(),
      cancel: fn(),
    },
  },
  parameters: { layout: 'fullscreen' },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    const [open, setOpen] = useState(true)
    return (
      <div
        style={{ position: 'relative', minHeight: 520, background: '#080f1b' }}
      >
        {!open && (
          <button
            onClick={() => {
              setValue(args.value)
              setOpen(true)
            }}
          >
            Corriger la synchronisation
          </button>
        )}
        <AnimatePresence>
          {open && (
            <SubtitleOffset
              {...args}
              value={value}
              onChange={(next) => {
                setValue(next)
                args.onChange(next)
              }}
              onClose={() => {
                args.onClose()
                setOpen(false)
              }}
            />
          )}
        </AnimatePresence>
      </div>
    )
  },
} satisfies Meta<typeof SubtitleOffset>
export default meta
type Story = StoryObj<typeof meta>
export const Interactive: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Trop tôt' }))
    await expect(canvas.getByText('Affichage 0,2 s plus tard')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Trop tard' }))
    await expect(canvas.getByText('Aucun décalage ajouté')).toBeVisible()
  },
}
export const FineAdjustment: Story = {
  play: async ({ canvas, userEvent }) => {
    const fine = () => canvas.getByRole('button', { name: 'Réglage précis' })
    fine().focus()
    await userEvent.keyboard('{Enter}')
    await expect(fine()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Trop tôt · 0,1 s' }),
    )
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Affichage 0,1 s plus tard',
    )
    const reset = canvas.getByRole('button', { name: 'Réinitialiser' })
    const help = canvas.getByRole('button', { name: 'Ça se décale à nouveau' })
    const a = reset.getBoundingClientRect(),
      b = help.getBoundingClientRect()
    await expect(
      Math.max(b.left - a.right, b.top - a.bottom),
    ).toBeGreaterThanOrEqual(8)
    await userEvent.click(reset)
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Aucun décalage ajouté',
    )
    await userEvent.click(help)
    await userEvent.click(canvas.getByRole('button', { name: 'Retour' }))
    await userEvent.click(fine())
    await expect(
      canvas.queryByRole('button', { name: 'Réinitialiser' }),
    ).toBeNull()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(canvas.queryByText('Réglage précis')).toBeNull())
    await userEvent.click(
      canvas.getByRole('button', { name: 'Corriger la synchronisation' }),
    )
    await expect(fine()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(fine())
  },
}
export const AnalysisFailure: Story = {
  args: {
    initial: {
      ...snapshot,
      canAnalyze: true,
      job: {
        id: 'b2382415-7d54-4f51-8d75-50573a7535ad',
        stage: 'failed',
        failure: 'audio',
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'piste audio sélectionnée',
    )
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'b2382415-7d54-4f51-8d75-50573a7535ad',
    )
    await expect(
      canvas.getByRole('button', { name: 'Synchroniser automatiquement' }),
    ).toBeEnabled()
  },
}
export const Delayed: Story = {
  args: { value: { manualMs: 1400, automatic: null } },
}

const proposal: SyncJob = {
  id: 'test-job',
  stage: 'ready',
  alignment: { scale: 25 / 24, shiftMs: 1800 },
}
const job = fn(async () => proposal)
export const LateAnalysis: Story = {
  args: {
    initial: { ...snapshot, canAnalyze: true },
    service: { ...meta.args.service, job },
  },
  play: async ({ canvas, userEvent }) => {
    let done!: (j: SyncJob) => void
    job.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve
        }),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Synchroniser automatiquement' }),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Trop tôt' }))
    done(proposal)
    await canvas.findByText('Proposition disponible')
    await expect(
      canvas.queryByRole('button', { name: 'Essayer cette proposition' }),
    ).not.toBeInTheDocument()
    await expect(canvas.getByText('Affichage 0,2 s plus tard')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Synchroniser automatiquement' }),
    )
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Essayer cette proposition' }),
    )
    await expect(
      canvas.getByText(/Après correction automatique · Aucun décalage ajouté/),
    ).toBeVisible()
  },
}
export const SaveFailure: Story = {
  args: {
    service: {
      ...meta.args.service,
      save: fn(async () => {
        throw Error('503')
      }),
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Trop tard' }))
    await userEvent.click(canvas.getByRole('button', { name: 'C’est bon' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Votre essai est conservé.',
    )
    await expect(canvas.getByText('Affichage 0,2 s plus tôt')).toBeVisible()
  },
}
