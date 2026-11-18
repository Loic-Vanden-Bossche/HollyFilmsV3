import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, mocked, userEvent } from 'storybook/test'
import { ProfileScreen } from './ProfileScreen.tsx'
import {
  getProfile,
  getProfileImage,
  updateProfileImage,
  deleteProfileImage,
  updateProfilePassword,
} from './account-api.ts'
import { profileFixture } from './profile-fixtures.ts'
import { useDevicePreferences } from './pwa/use-device-preferences.ts'
const meta = {
  title: 'HollyFilms/Profil connecté',
  component: ProfileScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    session: { accessToken: 'story-token', deviceId: 'profile-story' },
    signingOut: false,
    onSignOut: fn(),
  },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: () => {
    mocked(useDevicePreferences).mockReturnValue({
      installed: false,
      canInstall: true,
      updateAvailable: false,
      workerState: 'ready',
      ios: false,
      pushState: 'ready',
      canTest: true,
      action: undefined,
      notice: undefined,
      install: fn().mockResolvedValue('dismissed'),
      applyUpdate: fn(),
      onAction: fn().mockResolvedValue(undefined),
      onRetry: fn(),
    })
    mocked(getProfile).mockResolvedValue(profileFixture)
    mocked(getProfileImage).mockResolvedValue(new Blob())
    mocked(updateProfileImage).mockResolvedValue(undefined)
    mocked(deleteProfileImage).mockResolvedValue(undefined)
    mocked(updateProfilePassword).mockResolvedValue(undefined)
  },
} satisfies Meta<typeof ProfileScreen>
export default meta
type Story = StoryObj<typeof meta>
export const Connected: Story = {
  play: async ({ canvas, args }) => {
    await canvas.findByRole('heading', { name: 'Alex' })
    await expect(
      canvas.getByRole('region', { name: 'Sur cet appareil' }),
    ).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Activer les alertes' }),
    ).toBeEnabled()
    await userEvent.type(
      canvas.getByLabelText('Mot de passe actuel'),
      'old-password',
    )
    await userEvent.type(
      canvas.getByLabelText('Nouveau mot de passe'),
      'new-password',
    )
    await userEvent.type(
      canvas.getByLabelText('Confirmer le mot de passe'),
      'new-password',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Enregistrer le mot de passe' }),
    )
    await expect(updateProfilePassword).toHaveBeenCalledWith(
      args.session,
      'old-password',
      'new-password',
    )
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'enregistré',
    )
  },
}
