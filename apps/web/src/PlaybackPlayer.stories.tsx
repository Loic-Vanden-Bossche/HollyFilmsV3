import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import { expect, fn, mocked, waitFor } from 'storybook/test'
import { PlaybackPlayer } from './PlaybackPlayer.tsx'
import { createPlaybackApi } from './playback/playback-api.ts'
import type { PlaybackApi } from './playback/playback-api.ts'
import previewVideo from './assets/hero-preview.webm?url'
import { homeItems } from './home-fixtures.ts'

function mockPlayback(
  resolve: PlaybackApi['resolve'],
  stream?: PlaybackApi['stream'],
) {
  mocked(createPlaybackApi).mockReturnValue({
    sdk: createJellyfinApi(
      new URL('/jellyfin', location.origin).href,
      'story-device',
      'story-token',
    ),
    resolve,
    stream,
    details: async () => ({}),
    segments: async () => [],
    queue: async () => [],
    start: async () => {},
    progress: async () => {},
    stop: async () => {},
    release: async () => {},
  } as unknown as PlaybackApi)
}

const meta = {
  title: 'HollyFilms/Lecture',
  component: PlaybackPlayer,
  args: {
    item: homeItems[1],
    session: { accessToken: 'story-token', deviceId: 'story-device' },
    userId: 'story-user',
    resume: true,
    onClose: fn(),
  },
  parameters: { layout: 'fullscreen' },
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
  beforeEach: () => mockPlayback(() => new Promise(() => {})),
} satisfies Meta<typeof PlaybackPlayer>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent(
        'Ouverture du titre…',
      ),
    )
    await expect(canvasElement.querySelector('video')).toBeInTheDocument()
    await expect(canvasElement.querySelector('.player-projection')).toBeNull()
    const video = canvasElement.querySelector('video')!
    const back = canvas.getByRole('button', { name: 'Retour au catalogue' })
    await userEvent.keyboard(' ')
    await expect(args.onClose).not.toHaveBeenCalled()
    await userEvent.tab()
    await expect(back).toHaveFocus()
    const muted = video.muted
    await userEvent.keyboard('m')
    await expect(video.muted).toBe(!muted)
    await userEvent.keyboard('m')
    await expect(video.muted).toBe(muted)
    await expect(
      getComputedStyle(canvas.getByRole('dialog')).outlineStyle,
    ).toBe('none')
    await expect(
      canvasElement.querySelector('.player-artwork-hero img'),
    ).toBeInTheDocument()
    await expect(canvasElement.querySelector('iframe')).not.toBeInTheDocument()
    await userEvent.keyboard(' ')
    await expect(args.onClose).toHaveBeenCalledOnce()
  },
}

export const KeyboardPlayback: Story = {
  args: { initialPaused: true, resume: false },
  beforeEach: () =>
    mockPlayback(
      async (target) => target,
      async () => {
        const source = { Id: 'preview' }
        return {
          url: previewVideo,
          hls: false,
          method: 'DirectPlay',
          source,
          sources: [source],
          sessionId: 'story-session',
          offset: 0,
        }
      },
    ),
  play: async ({ canvasElement, args, userEvent }) => {
    const video = canvasElement.querySelector('video')!
    await waitFor(() =>
      expect(video.readyState).toBeGreaterThanOrEqual(
        HTMLMediaElement.HAVE_CURRENT_DATA,
      ),
    )
    await expect(video.paused).toBe(true)
    await expect(canvasElement.querySelector('.player-projection')).toBeNull()
    await userEvent.keyboard(' ')
    await waitFor(() => expect(video.paused).toBe(false))
    await userEvent.keyboard(' ')
    await expect(video.paused).toBe(true)
    await expect(args.onClose).not.toHaveBeenCalled()
    video.focus()
    await expect(video.matches(':focus-visible')).toBe(true)
    await expect(getComputedStyle(video).outlineStyle).toBe('solid')
  },
}

export const Unavailable: Story = {
  beforeEach: () =>
    mockPlayback(async () => {
      throw new Error('Le serveur ne propose pas de flux compatible.')
    }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Le serveur ne propose pas de flux compatible.',
    )
  },
}
