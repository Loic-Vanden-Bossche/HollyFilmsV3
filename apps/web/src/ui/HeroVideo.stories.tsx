import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { HeroVideo } from './HeroVideo.tsx'
import previewVideo from '../assets/hero-preview.webm?url'
import '../home-carousel.css'
const meta = {
  title: 'UI/Aperçu vidéo',
  component: HeroVideo,
  args: {
    source: { kind: 'video', url: previewVideo },
    running: true,
    muted: true,
    onStatus: fn(),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          background: '#080f1b',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeroVideo>
export default meta
type Story = StoryObj<typeof meta>
export const Playing: Story = {
  play: async ({ args, canvasElement }) => {
    await waitFor(() => expect(args.onStatus).toHaveBeenCalledWith('playing'))
    const video = canvasElement.querySelector('video')!
    await expect(video.controls).toBe(false)
    await expect(video.playsInline).toBe(true)
    await expect(video.disablePictureInPicture).toBe(true)
    await expect(video.disableRemotePlayback).toBe(true)
  },
}
export const Paused: Story = {
  args: { running: false },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('video')?.paused).toBe(true)
  },
}
export const Unavailable: Story = {
  args: { source: { kind: 'video', url: 'data:video/webm;base64,broken' } },
  play: async ({ args }) => {
    await waitFor(() =>
      expect(args.onStatus).toHaveBeenCalledWith('unavailable'),
    )
  },
}
