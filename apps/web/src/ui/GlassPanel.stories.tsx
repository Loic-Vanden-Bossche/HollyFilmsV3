import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { GlassPanel } from './GlassPanel.tsx'
import { Button } from './Button.tsx'
import { TextInput } from './TextInput.tsx'

const meta = {
  title: 'UI/Verre',
  component: GlassPanel,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="member-shell grid min-h-dvh place-items-center p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    className: 'w-full max-w-md',
    'aria-labelledby': 'glass-heading',
    children: (
      <>
        <p className="mb-2 text-xs tracking-widest text-link">HOLLYFILMS</p>
        <h2 id="glass-heading" className="text-2xl font-semibold">
          Votre espace
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Retrouvez votre bibliothèque de films et séries.
        </p>
        <label className="mt-6 grid gap-2 text-sm">
          Nom d’utilisateur
          <TextInput placeholder="Votre nom d’utilisateur" />
        </label>
        <div className="mt-6 flex gap-3">
          <Button variant="primary">Continuer</Button>
          <Button>Annuler</Button>
        </div>
      </>
    ),
  },
} satisfies Meta<typeof GlassPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Panneau et contrôles',
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Nom d’utilisateur' })
    await userEvent.type(input, 'cinephile')
    await expect(input).toHaveValue('cinephile')
    await userEvent.tab()
    await expect(
      canvas.getByRole('button', { name: 'Continuer' }),
    ).toHaveFocus()
  },
}

export const Scrollbars: Story = {
  name: 'Défilement discret — vertical et horizontal',
  args: {
    className: 'w-full max-w-xl',
    children: (
      <>
        <h2 id="glass-heading" className="mb-5 text-xl font-semibold">
          Défilement HollyFilms
        </h2>
        <div
          role="region"
          aria-label="Contenu défilant"
          tabIndex={0}
          className="h-64 overflow-auto rounded-xl border border-glass-edge p-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <div className="grid w-[640px] gap-4 pb-3">
            {Array.from({ length: 12 }, (_, index) => (
              <div key={index} className="rounded-lg bg-background/60 p-4">
                <p className="font-semibold">Sélection {index + 1}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Défilement natif à la souris, au clavier et sur écran tactile.
                </p>
              </div>
            ))}
          </div>
        </div>
      </>
    ),
  },
}
