import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen } from 'storybook/test'
import { I18nProvider } from '../i18n/I18nProvider.tsx'
import { LanguageSelect } from './LanguageSelect.tsx'

const meta = {
  title: 'UI/Display language',
  component: LanguageSelect,
  decorators: [
    (Story) => (
      <I18nProvider initialPreference="fr">
        <Story />
      </I18nProvider>
    ),
  ],
} satisfies Meta<typeof LanguageSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('combobox', { name: 'Langue de l’interface' }),
    )
    await userEvent.click(
      await screen.findByRole('option', { name: 'English' }),
    )
    await expect(
      canvas.getByRole('combobox', { name: 'Display language' }),
    ).toBeVisible()
    await userEvent.click(
      canvas.getByRole('combobox', { name: 'Display language' }),
    )
    await userEvent.click(
      await screen.findByRole('option', { name: '简体中文' }),
    )
    await expect(
      canvas.getByRole('combobox', { name: '界面语言' }),
    ).toBeVisible()
  },
}

export const Compact: Story = { args: { compact: true } }
