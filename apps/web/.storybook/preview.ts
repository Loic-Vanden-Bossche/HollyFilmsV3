import type { Preview } from '@storybook/react-vite'
import { sb } from 'storybook/test'
import { createElement } from 'react'
import { ArtworkHeroProvider } from '../src/ui/ArtworkHero.tsx'
import '../src/index.css'

sb.mock(import('../src/account-api.ts'))
sb.mock(import('@hollyfilms/shared/library'), { spy: true })
sb.mock(import('../src/playback/playback-api.ts'), { spy: true })
sb.mock(import('../src/playback/remote-commands.ts'))

const preview: Preview = {
  decorators: [
    (Story) => createElement(ArtworkHeroProvider, null, createElement(Story)),
  ],
  beforeAll: () => {
    document.documentElement.classList.add('dark')
  },
  tags: ['autodocs'],
  parameters: {
    backgrounds: { disable: true },
  },
}

export default preview
