import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import { expect, fn, mocked } from 'storybook/test'
import { PlaybackPlayer } from './PlaybackPlayer.tsx'
import { createPlaybackApi } from './playback/playback-api.ts'
import type { PlaybackApi } from './playback/playback-api.ts'
import { homeItems } from './home-fixtures.ts'

function mockPlayback(resolve: PlaybackApi['resolve']) {
  mocked(createPlaybackApi).mockReturnValue({
    sdk: createJellyfinApi(
      new URL('/jellyfin', location.origin).href,
      'story-device',
      'story-token',
    ),
    resolve,
    details: async () => ({}),
    segments: async () => [],
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
    await expect(await canvas.findByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    await expect(canvasElement.querySelector('video')).toBeInTheDocument()
    const video = canvasElement.querySelector('video')!
    video.focus()
    await expect(video).toHaveFocus()
    await expect(getComputedStyle(video).outlineStyle).toBe('none')
    await expect(
      getComputedStyle(canvas.getByRole('dialog')).outlineStyle,
    ).toBe('none')
    await expect(
      canvasElement.querySelector('.player-artwork-hero img'),
    ).toBeInTheDocument()
    await expect(canvasElement.querySelector('iframe')).not.toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retour au catalogue' }),
    )
    await expect(args.onClose).toHaveBeenCalledOnce()
  },
}

export const Unavailable: Story = {
  beforeEach: () =>
    mockPlayback(async () => {
      throw new Error('Aucun flux compatible.')
    }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Aucun flux compatible.',
    )
  },
}
