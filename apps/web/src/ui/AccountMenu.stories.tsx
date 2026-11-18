import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { AccountMenu } from './AccountMenu.tsx'
import { avatarFixture } from '../profile-fixtures.ts'

const meta = {
  title: 'UI/Menu du compte',
  component: AccountMenu,
  args: { username: 'Alex', avatarUrl: avatarFixture },
  decorators: [
    (Story) => (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          maxWidth: 420,
          minHeight: 260,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountMenu>
export default meta
type Story = StoryObj<typeof meta>

export const Member: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Menu du compte : Alex' }),
    )
    await expect(
      canvas.getByRole('link', { name: /^Profil$/ }),
    ).toHaveAttribute('href', '/profile')
    await expect(
      canvas.queryByRole('link', { name: 'Demandes d’approbation' }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole('link', { name: 'Mes demandes' }),
    ).toHaveAttribute('href', '/requests')
    await expect(
      canvas.queryByRole('link', { name: 'Demandes de médias' }),
    ).not.toBeInTheDocument()
  },
}
export const Administrator: Story = {
  args: { isAdmin: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Menu du compte : Alex' }),
    )
    await expect(
      canvas.getByRole('link', { name: /^Profil$/ }),
    ).toHaveAttribute('href', '/profile')
    await expect(
      canvas.getByRole('link', { name: 'Demandes d’approbation' }),
    ).toHaveAttribute('href', '/admin')
    await expect(
      canvas.getByRole('link', { name: 'Demandes de médias' }),
    ).toHaveAttribute('href', '/admin/requests')
  },
}
export const KeyboardAndDismiss: Story = {
  args: { isAdmin: true, avatarUrl: undefined },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', {
      name: 'Menu du compte : Alex',
    })
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: /^Profil$/ })).toHaveFocus()
    await userEvent.tab()
    await expect(
      canvas.getByRole('link', { name: 'Demandes d’approbation' }),
    ).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() =>
      expect(
        canvas.queryByRole('navigation', { name: 'Compte' }),
      ).not.toBeInTheDocument(),
    )
    await userEvent.click(trigger)
    await userEvent.click(canvasElement)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  },
}
