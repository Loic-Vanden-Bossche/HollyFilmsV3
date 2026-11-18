import colors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'
import { motionVariables } from './src/motion/tokens.ts'

const background = '#080f1b'
const foreground = '#f4f7fc'
const card = '#0d1726'
const border = '#233247'
const ring = colors.sky[300]
const brandStart = colors.green[400]
const brandEnd = colors.blue[500]
const primary = { DEFAULT: brandStart, foreground: background }
const accent = { DEFAULT: '#142e3d', foreground: '#b0f5e8' }

export default {
  plugins: [plugin(({ addBase }) => addBase({ ':root': motionVariables }))],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        logo: ['HollyFilms', 'sans-serif'],
      },
      borderRadius: { panel: '24px', card: '16px', control: '9999px' },
      spacing: { stage: 'clamp(20px, 4vw, 64px)' },
      colors: {
        background,
        foreground,
        card: { DEFAULT: card, foreground },
        popover: { DEFAULT: '#132238', foreground },
        primary,
        secondary: { DEFAULT: '#1a2a3e', foreground },
        muted: { DEFAULT: '#142235', foreground: '#a4b6cb' },
        accent,
        link: '#7dded8',
        success: colors.green[300],
        destructive: { DEFAULT: '#fda4af', foreground: background },
        border,
        input: '#536b84',
        glass: {
          DEFAULT: '#0d1726d9',
          strong: '#0d1726ed',
          control: '#ecf4fb0a',
          edge: '#ecf4fb1f',
        },
        ring,
        chart: {
          1: brandStart,
          2: colors.teal[300],
          3: colors.cyan[400],
          4: brandEnd,
          5: colors.blue[300],
        },
        sidebar: { DEFAULT: card, foreground, primary, accent, border, ring },
      },
      backgroundImage: {
        'glass-sheen':
          'linear-gradient(135deg, #b0f5e80d, #3b82f605 50%, transparent)',
        'brand-gradient': `linear-gradient(105deg in oklab, ${brandStart}, ${brandEnd})`,
      },
      boxShadow: {
        glass: 'inset 0 1px 0 #ecf4fb1f, 0 16px 48px #03081040',
        'glass-control': 'inset 0 1px 0 #ecf4fb14, 0 4px 16px #03081020',
      },
      backdropBlur: { glass: '24px' },
    },
  },
}
