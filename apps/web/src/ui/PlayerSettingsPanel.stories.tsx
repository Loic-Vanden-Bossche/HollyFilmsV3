import type { Meta, StoryObj } from '@storybook/react-vite'
import { homeItems } from '../home-fixtures.ts'
import { PlayerShell } from './PlayerShell.tsx'
import { PlayerControls } from './PlayerControls.tsx'
import { PlayerSessionActions } from './PlayerSessionActions.tsx'
import { AnimatePresence } from 'motion/react'
import { useRef, useState } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { PlayerSettingsPanel, type PlayerMenu } from './PlayerSettingsPanel.tsx'

const meta = {
  title: 'UI/Lecteur/Panneau de réglages',
  component: PlayerSettingsPanel,
  args: {
    menu: 'chapters',
    onClose: fn(),
    children: Array.from({ length: 24 }, (_, i) => (
      <button key={i} className="player-menu-list">
        Chapitre {i + 1}
      </button>
    )),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          height: 'min(640px, calc(100dvh - 2rem))',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlayerSettingsPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Scroll: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const panel = canvas.getByRole('region')
    const header = canvas.getByRole('heading').closest('header')!
    const first = canvas.getByRole('button', { name: 'Chapitre 1' })
    const last = canvas.getByRole('button', { name: 'Chapitre 24' })
    const list = first.parentElement!
    await expect(getComputedStyle(header).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    )
    last.focus()
    await waitFor(() => {
      expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        list.getBoundingClientRect().bottom + 1,
      )
      expect(list.scrollTop).toBeGreaterThan(0)
    })
    await expect(panel.scrollTop).toBe(0)
    await expect(header.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      list.getBoundingClientRect().top + 1,
    )
    await userEvent.keyboard('{Escape}')
    await expect(args.onClose).toHaveBeenCalledTimes(1)
    first.focus()
  },
}

export const AnchoredNavigation: Story = {
  name: 'Navigation et fermeture depuis la commande',
  render: function Render(args) {
    const [menu, setMenu] = useState<PlayerMenu>()
    const anchor = useRef<HTMLButtonElement | null>(null)
    const [paused, setPaused] = useState(false)
    const [position, setPosition] = useState(66)
    const [volume, setVolume] = useState(0.65)
    const [muted, setMuted] = useState(false)
    function open(page: PlayerMenu, trigger: HTMLButtonElement) {
      anchor.current = trigger
      setMenu(page)
    }
    return (
      <PlayerShell
        title="Signal"
        state="playing"
        onClose={() => {}}
        onRetry={() => {}}
        actions={
          <PlayerSessionActions
            onCast={(trigger) => open('devices', trigger)}
            onSync={(trigger) => open('sync', trigger)}
          />
        }
      >
        <div className="player-stage">
          <img
            src={homeItems[0].backdrop as string}
            className="player-video"
            alt=""
          />
          <div className="player-controls-layer">
            <PlayerControls
              media={{
                position,
                duration: 180,
                buffered: 105,
                paused,
                muted,
                volume,
              }}
              fullscreen={false}
              pip={false}
              hasPrevious={false}
              hasNext={false}
              subtitles={false}
              openPanel={
                menu === 'settings' || menu === 'chapters'
                  ? 'settings'
                  : undefined
              }
              onToggle={() => setPaused(!paused)}
              onSeek={setPosition}
              onVolume={setVolume}
              onMute={() => setMuted(!muted)}
              onPrevious={() => {}}
              onNext={() => {}}
              onFullscreen={() => {}}
              onSettings={(trigger) => open('settings', trigger)}
            />
          </div>
          <AnimatePresence initial={false}>
            {menu && (
              <PlayerSettingsPanel
                anchor={anchor.current}
                menu={menu}
                onClose={() => {
                  setMenu(undefined)
                  anchor.current?.focus()
                  args.onClose()
                }}
              >
                {menu === 'settings' ? (
                  <button type="button" onClick={() => setMenu('chapters')}>
                    Chapitres
                  </button>
                ) : menu === 'chapters' ? (
                  args.children
                ) : (
                  <p>Aucun appareil disponible.</p>
                )}
              </PlayerSettingsPanel>
            )}
          </AnimatePresence>
        </div>
      </PlayerShell>
    )
  },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', {
      name: 'Paramètres de lecture',
    })
    await userEvent.click(trigger)
    const panel = canvas.getByRole('region')
    await expect(panel).toHaveAttribute('data-origin', 'controls')
    await userEvent.click(canvas.getByRole('button', { name: 'Chapitres' }))
    await expect(canvas.getByRole('region') === panel).toBe(true)
    await expect(
      canvas.getByRole('button', { name: 'Chapitre 1' }),
    ).toBeEnabled()
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
    await expect(canvas.queryByRole('region')).not.toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Chromecast et appareils' }),
    )
    await expect(canvas.getByRole('region')).toHaveAttribute(
      'data-origin',
      'header',
    )
    await expect(canvas.getByRole('region')).not.toHaveAttribute('inert')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(panel).not.toBeInTheDocument())
    await expect(args.onClose).toHaveBeenCalledTimes(2)
  },
}
