import { useEffect, useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { PlayerLoading } from './PlayerLoading.tsx'
import { homeItems } from '../home-fixtures.ts'
import { loadingRevealDelay } from '../playback/use-loading-stage.ts'
import '../player.css'

const meta = {
  title: 'UI/Préparation de la lecture',
  component: PlayerLoading,
  parameters: { layout: 'fullscreen' },
  args: { wait: null },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          minHeight: '100dvh',
          background: '#080f1b',
        }}
      >
        <img
          src={homeItems[0].backdrop as string}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'relative',
            padding: 'max(26px, 5vw)',
            color: '#edf4fc',
          }}
        >
          <div className="player-title-block">
            <h1 className="player-title">
              Le Seigneur des anneaux · Le Retour du roi
            </h1>
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof PlayerLoading>
export default meta
type Story = StoryObj<typeof meta>

export const Opening: Story = {
  name: 'Ouverture du titre',
  render: function Render(args) {
    const [since] = useState(Date.now)
    return (
      <PlayerLoading
        {...args}
        wait={{ operation: 'opening', position: 0, since }}
      />
    )
  },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent(
        'Ouverture du titre…',
      ),
    )
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument()
    const spinner = canvasElement.querySelector('.player-loading-spinner')
    await expect(spinner).toBeVisible()
    await expect(spinner).toHaveAttribute('aria-hidden', 'true')
    const titleLeft = canvas.getByRole('heading').getBoundingClientRect().left
    await expect(
      Math.abs(spinner!.getBoundingClientRect().left - titleLeft),
    ).toBeLessThanOrEqual(1)
    const notice = spinner!.closest('.player-loading')!
    await expect(getComputedStyle(notice).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    )
    await expect(getComputedStyle(notice).borderInlineStartWidth).toBe('0px')
    const rotor = spinner!.querySelector('.player-loading-rotor')!
    const running = rotor
      .getAnimations()
      .filter((animation) => animation.playState === 'running')
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.performance === 'light' ||
      document.hidden
    ) {
      await expect(running).toHaveLength(0)
    } else {
      await expect(
        running.some(
          (animation) => animation.effect?.getTiming().iterations === Infinity,
        ),
      ).toBe(true)
      const initial = getComputedStyle(rotor).transform
      await waitFor(() =>
        expect(getComputedStyle(rotor).transform).not.toBe(initial),
      )
    }
  },
}

export const Negotiating: Story = {
  name: 'Préparation par le serveur',
  render: function Render(args) {
    const [since] = useState(() => Date.now() - 400)
    return (
      <PlayerLoading
        {...args}
        wait={{ operation: 'preparing', position: 0, since }}
      />
    )
  },
}

export const FastStart: Story = {
  name: 'Démarrage instantané',
  render: function Render() {
    const [since, setSince] = useState<number>()
    const [playing, setPlaying] = useState(false)
    useEffect(() => {
      if (since === undefined) return
      const timer = window.setTimeout(() => {
        setSince(undefined)
        setPlaying(true)
      }, 50)
      return () => window.clearTimeout(timer)
    }, [since])
    return (
      <>
        {playing ? (
          <p>Lecture en cours</p>
        ) : (
          <button type="button" onClick={() => setSince(Date.now())}>
            Lire
          </button>
        )}
        <PlayerLoading
          wait={
            since === undefined
              ? null
              : { operation: 'preparing', since, position: 0 }
          }
        />
      </>
    )
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    let noticeMounted = false
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches('.player-loading') ||
              node.querySelector('.player-loading'))
          )
            noticeMounted = true
        }
      }
    })
    observer.observe(canvasElement, { childList: true, subtree: true })
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Lire' }))
      await canvas.findByText('Lecture en cours')
      await new Promise((resolve) => setTimeout(resolve, loadingRevealDelay))
      await expect(noticeMounted).toBe(false)
      await expect(canvas.getByRole('status')).toBeEmptyDOMElement()
    } finally {
      observer.disconnect()
    }
  },
}

export const Buffering: Story = {
  name: 'Interruption et détails',
  args: {
    wait: { operation: 'buffering', since: 0, position: 2538 },
    bufferedAhead: 3.4,
    method: 'DirectPlay',
    onRetry: fn(),
    lowerBitrate: 4_000_000,
    onLowerQuality: fn(),
  },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Mise en mémoire tampon…',
    )
    const disclosure = canvas.getByRole('button', { name: 'Détails' })
    disclosure.focus()
    await userEvent.keyboard('{Enter}')
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText('3 s en mémoire à 42:18')).toBeVisible()
    const method = canvas.getByText('Lecture directe')
    const retry = canvas.getByRole('button', { name: 'Réessayer' })
    const label = canvas.getByText('Mise en mémoire tampon…', {
      selector: '.player-loading-label',
    })
    await expect(method).toBeVisible()
    const textLeft = label.getBoundingClientRect().left
    for (const element of [method, retry]) {
      await expect(
        Math.abs(element.getBoundingClientRect().left - textLeft),
      ).toBeLessThanOrEqual(1)
    }
    await userEvent.click(retry)
    await expect(args.onRetry).toHaveBeenCalledOnce()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Réduire la qualité · 4 Mbit/s' }),
    )
    await expect(args.onLowerQuality).toHaveBeenCalledOnce()
  },
}

function ResumingPlayer() {
  const [waiting, setWaiting] = useState(true)
  const video = useRef<HTMLVideoElement>(null)
  return (
    <>
      <video ref={video} tabIndex={0} aria-label="Film" width="1" height="1" />
      <PlayerLoading
        wait={
          waiting ? { operation: 'buffering', since: 0, position: 2538 } : null
        }
        onRestoreFocus={() => video.current?.focus()}
        onRetry={() => setWaiting(false)}
      />
    </>
  )
}

export const PlaybackResumes: Story = {
  name: 'Retour au film après une attente',
  render: () => <ResumingPlayer />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Détails' }))
    await expect(
      canvas.getByText('En attente des informations de lecture.'),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(
      canvas.queryByRole('button', { name: 'Détails' }),
    ).not.toBeInTheDocument()
    await expect(canvas.getByLabelText('Film')).toHaveFocus()
    await expect(
      canvasElement.querySelector('.player-loading-spinner'),
    ).not.toBeInTheDocument()
  },
}
