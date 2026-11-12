import type { Preview } from '@storybook/react-vite'
import { sb } from 'storybook/test'
import '../src/index.css'

sb.mock(import('../src/account-api.ts'))

const preview: Preview = {
  beforeAll: () => {
    document.documentElement.classList.add('dark')
  },
  tags: ['autodocs'],
  initialGlobals: { backgrounds: { value: 'hollyfilms' } },
  parameters: {
    backgrounds: {
      options: { hollyfilms: { name: 'HollyFilms', value: '#09090b' } },
    },
  },
}

export default preview
