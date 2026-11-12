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
export const Backdrop: Story = {}
export const Missing: Story = { args: { source: undefined } }
export const Broken: Story = {
  args: { source: 'data:image/png;base64,broken' },
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
