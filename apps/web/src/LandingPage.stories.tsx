import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { LandingPage } from './LandingPage.tsx'

import { catalogueItems as items } from './ui/catalogue-fixtures.ts'

const meta = {
  title: 'HollyFilms/Vitrine',
  component: LandingPage,
  parameters: { layout: 'fullscreen' },
  args: {
    items: [],
    catalogueState: 'ready',
    onSignIn: fn(),
    options: { googleStartUrl: '/api/auth/google/start' },
  },
} satisfies Meta<typeof LandingPage>

export default meta
type Story = StoryObj<typeof meta>

export const Opening: Story = { name: 'Ouverture cinéma', args: { items } }

export const Catalogue: Story = {
  args: { items },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvasElement).not.toHaveTextContent(/jellyfin/i)
    await expect(
      canvas.getByRole('heading', {
        level: 1,
        name: 'HollyFilms 3.0 — Films et séries',
      }),
    ).toBeVisible()
    await expect(
      canvas.getByRole('heading', { name: 'Au catalogue' }),
    ).toBeVisible()
    const catalogue = canvas.getByRole('region', { name: 'Au catalogue' })
    await expect(
      within(catalogue).queryByRole('button'),
    ).not.toBeInTheDocument()
    await expect(within(catalogue).queryByRole('link')).not.toBeInTheDocument()
    const pause = canvas.getByRole('button', {
      name: 'Mettre les animations en pause',
    })
    await userEvent.click(pause)
    await expect(pause).toHaveAttribute('aria-pressed', 'true')
    await expect(canvasElement.querySelector('.showcase')).toHaveAttribute(
      'data-still',
      'true',
    )
    await userEvent.click(pause)
    await expect(pause).toHaveAttribute('aria-pressed', 'false')
    const page = canvasElement.ownerDocument.documentElement
    await expect(page.scrollHeight).toBeLessThanOrEqual(page.clientHeight)
    await expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth)
  },
}
export const Empty: Story = { name: 'Catalogue vide' }
export const Loading: Story = { args: { catalogueState: 'loading' } }
export const Unavailable: Story = { args: { catalogueState: 'error' } }
export const Authenticated: Story = { args: { items, authenticated: true } }
export const SingleTitle: Story = {
  name: 'Un seul titre sans affiche',
  args: { items: [{ ...items[0], poster: null }] },
}
export const Login: Story = {
  args: { items },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Se connecter' }))
    const dialog = canvas.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await userEvent.type(
      canvas.getByLabelText('Nom d’utilisateur'),
      'cinephile',
    )
    await userEvent.type(canvas.getByLabelText('Mot de passe'), 'movie-night')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Se connecter' }),
    )
    await expect(args.onSignIn).toHaveBeenCalledWith('cinephile', 'movie-night')
    await userEvent.click(canvas.getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(dialog).not.toBeVisible())
  },
}
export const Registration: Story = {
  args: { items },
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Créer un compte' })
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: 'Créer votre compte.' }),
      ).toBeVisible(),
    )
    await expect(
      canvas.getByRole('button', { name: 'Envoyer la demande' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

export const DismissOnBackdrop: Story = {
  name: 'Fermer en cliquant sur le fond',
  args: { items },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Se connecter' })
    await userEvent.click(trigger)
    const dialog = canvas.getByRole('dialog')
    const username = canvas.getByLabelText('Nom d’utilisateur')
    await userEvent.click(username)
    await expect(dialog).toBeVisible()
    // A gesture starting in a field must not dismiss the form on release outside.
    await userEvent.pointer([
      { target: username, keys: '[MouseLeft>]' },
      {
        target: dialog,
        coords: { clientX: 0, clientY: 0 },
        keys: '[/MouseLeft]',
      },
    ])
    await expect(dialog).toHaveAttribute('open')
    await userEvent.pointer({
      target: dialog,
      coords: { clientX: 0, clientY: 0 },
      keys: '[MouseLeft]',
    })
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
    await expect(trigger).toHaveFocus()
    await expect(args.onSignIn).not.toHaveBeenCalled()
  },
}
