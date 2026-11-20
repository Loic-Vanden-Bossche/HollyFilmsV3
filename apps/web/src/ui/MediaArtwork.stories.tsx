import { expect, fn, spyOn, waitFor } from 'storybook/test'
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MediaArtwork } from './MediaArtwork.tsx'
import { homeItems } from '../home-fixtures.ts'
import '../home.css'
import '../home-carousel.css'
const meta = {
  title: 'UI/Images du catalogue',
  component: MediaArtwork,
  args: { source: homeItems[0].backdrop },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <div style={{ width: 'min(100%, 700px)', aspectRatio: '16 / 9' }}>
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof MediaArtwork>
export default meta
type Story = StoryObj<typeof meta>
export const Backdrop: Story = {
  args: { onReady: fn(), eager: true },
  play: async ({ args, canvasElement }) => {
    await waitFor(() => expect(args.onReady).toHaveBeenCalled())
    const image = canvasElement.querySelector('img')!
    await expect(image.complete && image.naturalWidth > 0).toBe(true)
    await expect(
      canvasElement.querySelector('.media-artwork-fallback'),
    ).not.toBeInTheDocument()
  },
}
export const Missing: Story = {
  args: { source: undefined, onReady: fn() },
  play: async ({ args }) => {
    await waitFor(() => expect(args.onReady).toHaveBeenCalled())
  },
}
export const Broken: Story = {
  args: { source: 'data:image/png;base64,broken', onReady: fn() },
  play: async ({ args }) => {
    await waitFor(() => expect(args.onReady).toHaveBeenCalled())
  },
}
export const TransparentLogo: Story = {
  args: {
    source: homeItems[0].logo,
    className: 'hero-logo',
    fallback: <span>Signal</span>,
  },
}
export const TitleFallback: Story = {
  args: {
    source: undefined,
    className: 'hero-logo',
    fallback: <span>Signal</span>,
  },
}

const session = { deviceId: 'artwork-story', accessToken: 'story' }
const source = { itemId: 'signal', type: 'Backdrop', tag: 'story' } as const

export const ResolutionUpgrade: Story = {
  name: 'La vignette reste visible pendant le décodage HD',
  args: { source, session, eager: true, onUnavailable: fn() },
  render: function Render(args) {
    const [width, setWidth] = useState(320)
    const [showThumbnail, setShowThumbnail] = useState(false)
    const [client] = useState(() => {
      const client = new QueryClient()
      const svg = decodeURIComponent(
        String(homeItems[0].backdrop).split(',')[1],
      )
      for (const size of [320, 1280, 1920]) {
        const markup = svg.replace(
          'width="1920" height="1080"',
          `width="${size}" height="${(size * 9) / 16}"`,
        )
        client.setQueryData(
          [
            'library-image',
            session.deviceId,
            source.itemId,
            source.type,
            source.tag,
            size,
            undefined,
          ],
          new Blob([markup], { type: 'image/svg+xml' }),
        )
      }
      return client
    })
    return (
      <QueryClientProvider client={client}>
        <MediaArtwork {...args} width={width} />
        <button onClick={() => setWidth(1280)}>HD</button>
        <button onClick={() => setWidth(1920)}>Full HD</button>
        <button onClick={() => setShowThumbnail(true)}>
          Afficher la vignette
        </button>
        {showThumbnail && (
          <div
            className="artwork-story-thumbnail"
            style={{ width: 160, aspectRatio: '16 / 9' }}
          >
            <MediaArtwork {...args} width={480} />
          </div>
        )}
      </QueryClientProvider>
    )
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const painted = () =>
      canvasElement.querySelector<HTMLImageElement>(
        '[data-decoded] img:not([hidden])',
      )
    await waitFor(() => expect(painted()?.naturalWidth).toBe(320))
    const thumbnail = painted()
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    const decode = HTMLImageElement.prototype.decode
    const upgrade = spyOn(
      HTMLImageElement.prototype,
      'decode',
    ).mockImplementation(async function (this: HTMLImageElement) {
      await decode.call(this)
      if (!canvasElement.contains(this)) return
      if (this.naturalWidth === 1920) throw new Error('Decode failed')
      await pending
    })
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'HD' }))
      await waitFor(() => expect(upgrade).toHaveBeenCalled())
      await expect(painted()).toBe(thumbnail)
      await expect(thumbnail).toBeVisible()
      finish()
      await waitFor(() => expect(painted()?.naturalWidth).toBe(1280))
      const hd = painted()
      await userEvent.click(canvas.getByRole('button', { name: 'Full HD' }))
      await waitFor(() => expect(upgrade).toHaveBeenCalledTimes(2))
      await waitFor(() =>
        expect(canvasElement.querySelectorAll('img')).toHaveLength(1),
      )
      await expect(painted()).toBe(hd)
      await expect(hd).toBeVisible()
      await expect(args.onUnavailable).not.toHaveBeenCalled()
    } finally {
      finish()
      upgrade.mockRestore()
    }
    await userEvent.click(
      canvas.getByRole('button', { name: 'Afficher la vignette' }),
    )
    await waitFor(() => {
      const thumbnail = canvasElement.querySelector<HTMLImageElement>(
        '.artwork-story-thumbnail [data-decoded] img',
      )
      expect(thumbnail?.naturalWidth).toBe(1280)
      expect(thumbnail?.src).toBe(painted()?.src)
    })
  },
}
