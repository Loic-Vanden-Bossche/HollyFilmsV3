import type { Meta, StoryObj } from '@storybook/react-vite'
import { CatalogueBackdrop } from './CatalogueBackdrop.tsx'

const meta = {
  title: 'UI/Atmosphère du catalogue',
  component: CatalogueBackdrop,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative min-h-dvh overflow-clip bg-background">
        <Story />
        <div className="relative flex min-h-dvh flex-col items-center justify-center gap-5 p-8 text-center text-foreground">
          <span className="text-xs tracking-[.4em] text-link">
            HOLLYFILMS 3.0
          </span>
          <h1 className="text-5xl font-semibold tracking-tight">
            Place au cinéma.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Lumière, profondeur et mouvement, aux couleurs de votre
            bibliothèque.
          </p>
        </div>
      </div>
    ),
  ],
  args: { paused: false },
} satisfies Meta<typeof CatalogueBackdrop>
export default meta
type Story = StoryObj<typeof meta>

export const Animated: Story = {}
export const Paused: Story = { args: { paused: true } }
