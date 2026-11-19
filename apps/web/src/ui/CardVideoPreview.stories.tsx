import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, mocked, waitFor } from 'storybook/test'
import { getHeroPreview, getItemPreviewClip } from '@hollyfilms/shared/library'
import { homeItems, homeResume } from '../home-fixtures.ts'
import previewVideo from '../assets/hero-preview.webm?url'
import { CardVideoPreview } from './CardVideoPreview.tsx'
import { MediaTile } from './MediaTile.tsx'

const playItem = fn()
const selectItem = fn()
const remoteTrailer = {
  url: 'https://www.youtube.com/watch?v=abcdefghijk',
  name: 'Bande-annonce VF',
}
const meta = {
  title: 'UI/Affiche média/Aperçu vidéo',
  component: CardVideoPreview,
  args: {
    item: { ...homeItems[0], kind: 'Film' },
    session: { accessToken: 'story-token', deviceId: 'story-device' },
    userId: 'story-user',
  },
  beforeEach: () => {
    mocked(getHeroPreview).mockReset().mockResolvedValue(null)
    mocked(getItemPreviewClip).mockReset().mockReturnValue(null)
    playItem.mockClear()
    selectItem.mockClear()
  },
  render: function Render({ item, session, userId }, { parameters }) {
    const [client] = useState(() => new QueryClient())
    const wide = parameters.resumeRow === true
    return (
      <QueryClientProvider client={client}>
        <div style={{ width: wide ? 320 : 260, maxWidth: '100%', margin: 28 }}>
          <MediaTile
            wide={wide}
            item={item}
            session={session}
            userId={userId}
            onPlay={playItem}
            onSelect={selectItem}
          />
        </div>
      </QueryClientProvider>
    )
  },
} satisfies Meta<typeof CardVideoPreview>
export default meta
type Story = StoryObj<typeof meta>

export const HoverTrailer: Story = {
  name: 'Bande-annonce au survol',
  beforeEach: () => {
    mocked(getHeroPreview).mockResolvedValue({
      kind: 'video',
      url: previewVideo,
    })
  },
  play: async ({ canvas, userEvent, args }) => {
    const card = canvas.getByRole('article')
    await expect(card.querySelector('video')).toBeNull()
    await userEvent.hover(card)
    await userEvent.unhover(card)
    await expect(getHeroPreview).not.toHaveBeenCalled()
    await userEvent.hover(card)
    await waitFor(
      () => {
        const video = card.querySelector('video')
        expect(video?.muted).toBe(true)
        expect(video?.paused).toBe(false)
        expect(video?.currentTime).toBeGreaterThan(0)
      },
      { timeout: 5000 },
    )
    await expect(getHeroPreview).toHaveBeenCalledTimes(1)
    const video = card.querySelector('video')!
    await expect(video.controls).toBe(false)
    const captions = video.addTextTrack('captions', 'Français', 'fr')
    captions.mode = 'showing'
    await waitFor(() => expect(captions.mode).toBe('disabled'))
    const heading = canvas.getByRole('heading', { name: args.item.title })
    await waitFor(() => {
      const logo = heading.querySelector('img')
      expect(logo?.naturalWidth).toBeGreaterThan(0)
      expect(logo).toBeVisible()
    })
    const videoBounds = card.querySelector('video')!.getBoundingClientRect()
    const logoBounds = heading.querySelector('img')!.getBoundingClientRect()
    expect(logoBounds.top).toBeGreaterThanOrEqual(videoBounds.top - 1)
    expect(logoBounds.bottom).toBeLessThanOrEqual(videoBounds.bottom + 1)
    await userEvent.unhover(card)
    await waitFor(() => expect(card.querySelector('video')).toBeNull())
    await expect(playItem).not.toHaveBeenCalled()
    await expect(selectItem).not.toHaveBeenCalled()
  },
}

export const WithoutTrailer: Story = {
  name: 'Décor de la série si seule une bande-annonce YouTube est disponible',
  args: { item: { ...homeItems[0], kind: 'Série', trailers: [remoteTrailer] } },
  play: async ({ canvas, userEvent, args }) => {
    const card = canvas.getByRole('article')
    await userEvent.hover(card)
    await waitFor(() => expect(getHeroPreview).toHaveBeenCalledTimes(1), {
      timeout: 3500,
    })
    await expect(
      canvas.getByRole('heading', { name: args.item.title }),
    ).toBeVisible()
    await expect(card.querySelector('.artwork-preview-hero img')).toBeVisible()
    await expect(card.querySelector('video, iframe')).toBeNull()
    await expect(
      canvas.getByRole('button', { name: 'Lire ' + args.item.title }),
    ).toBeEnabled()
  },
}

export const YouTubeTrailerWithLocalExcerpt: Story = {
  name: 'Extrait du film quand la bande-annonce est sur YouTube',
  args: { item: { ...homeItems[0], kind: 'Film', trailers: [remoteTrailer] } },
  beforeEach: () => {
    mocked(getItemPreviewClip).mockReturnValue({
      kind: 'video',
      url: previewVideo,
    })
  },
  play: async ({ canvas, userEvent, args }) => {
    const card = canvas.getByRole('article')
    await userEvent.hover(card)
    await waitFor(
      () => {
        const video = card.querySelector('video')
        expect(video?.getAttribute('src')).toBe(previewVideo)
        expect(video?.currentTime).toBeGreaterThan(0)
        expect(video?.muted).toBe(true)
        expect(video?.controls).toBe(false)
      },
      { timeout: 5000 },
    )
    await expect(card.querySelector('iframe')).toBeNull()
    await expect(
      canvas
        .getByRole('heading', { name: args.item.title })
        .querySelector('img'),
    ).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Lire ' + args.item.title }),
    ).toBeEnabled()
    await expect(playItem).not.toHaveBeenCalled()
  },
}

export const ResumeClip: Story = {
  name: 'Extrait à la position de reprise',
  args: { item: { ...homeResume[0], playbackPosition: 0.7 } },
  parameters: { resumeRow: true },
  beforeEach: () => {
    mocked(getItemPreviewClip).mockReturnValue({
      kind: 'video',
      url: previewVideo + '#t=0.7,2.7',
    })
  },
  play: async ({ canvas, userEvent }) => {
    const card = canvas.getByRole('article')
    await userEvent.hover(card)
    await waitFor(
      () =>
        expect(card.querySelector('video')?.currentTime).toBeGreaterThan(0.7),
      { timeout: 5000 },
    )
    await expect(getHeroPreview).not.toHaveBeenCalled()
    await expect(playItem).not.toHaveBeenCalled()
  },
}

export const ClipAfterTrailerError: Story = {
  name: 'Extrait du film après une bande-annonce illisible',
  beforeEach: () => {
    mocked(getHeroPreview).mockResolvedValue({
      kind: 'video',
      url: 'data:video/webm;base64,broken',
    })
    mocked(getItemPreviewClip).mockReturnValue({
      kind: 'video',
      url: previewVideo,
    })
  },
  play: async ({ canvas, userEvent }) => {
    const card = canvas.getByRole('article')
    await userEvent.hover(card)
    await waitFor(
      () => {
        const video = card.querySelector('video')
        expect(video?.getAttribute('src')).toBe(previewVideo)
        expect(video?.currentTime).toBeGreaterThan(0)
      },
      { timeout: 5000 },
    )
    await expect(playItem).not.toHaveBeenCalled()
    await expect(selectItem).not.toHaveBeenCalled()
  },
}
