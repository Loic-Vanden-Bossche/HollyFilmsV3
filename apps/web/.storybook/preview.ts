import type { Preview } from '@storybook/react-vite'
import { sb } from 'storybook/test'
import { createElement } from 'react'
import { ArtworkHeroProvider } from '../src/ui/ArtworkHero.tsx'
import { TooltipProvider } from '../src/ui/Tooltip.tsx'
import { I18nProvider } from '../src/i18n/I18nProvider.tsx'
import { isLanguagePreference } from '../src/i18n/messages.ts'
import '../src/index.css'

sb.mock(import('../src/account-api.ts'))
sb.mock(import('@hollyfilms/shared/library'), { spy: true })
sb.mock(import('@hollyfilms/shared/media-details'), { spy: true })
sb.mock(import('../src/playback/playback-api.ts'), { spy: true })
sb.mock(import('../src/playback/remote-commands.ts'))

const preview: Preview = {
  initialGlobals: { language: 'fr' },
  globalTypes: {
    language: {
      description: 'HollyFilms display language',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'fr', title: 'Français' },
          { value: 'en', title: 'English' },
          { value: 'zh-Hans', title: '简体中文' },
          { value: 'auto', title: 'Browser language' },
        ],
      },
    },
  },
  decorators: [
    (Story) => createElement(TooltipProvider, null, createElement(Story)),
    (Story) => createElement(ArtworkHeroProvider, null, createElement(Story)),
    (Story, { globals }) => {
      const language = isLanguagePreference(globals.language)
        ? globals.language
        : 'fr'
      return createElement(
        I18nProvider,
        { key: language, initialPreference: language },
        createElement(Story),
      )
    },
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
