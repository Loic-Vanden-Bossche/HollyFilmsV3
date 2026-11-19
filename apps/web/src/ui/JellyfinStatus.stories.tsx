import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, mocked } from 'storybook/test'
import { getJellyfinServerInfo } from '@hollyfilms/shared/jellyfin'
import { JellyfinStatus } from './JellyfinStatus.tsx'

const connectedServer = { Version: '12.4.0', StartupWizardCompleted: true }

const meta = {
  title: 'UI/État du service',
  component: JellyfinStatus,
  decorators: [
    (Story, { id }) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client} key={id}>
          <div className="w-full max-w-sm">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  beforeEach: () => {
    mocked(getJellyfinServerInfo).mockReset().mockResolvedValue(connectedServer)
  },
} satisfies Meta<typeof JellyfinStatus>

export default meta
type Story = StoryObj<typeof meta>

export const Panel: Story = {
  name: 'Diagnostic détaillé',
}

export const Compact: Story = {
  name: 'État compact',
  args: { compact: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Connexion établie')).toBeVisible()
    await expect(canvas.getByText('Version du serveur 12.4.0')).toBeVisible()
  },
}

export const Retry: Story = {
  name: 'Vérification et rétablissement',
  args: { compact: true },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Connexion établie')
    const refresh = canvas.getByRole('button', {
      name: 'Vérifier la connexion',
    })
    let finishCheck = () => {}
    const check = new Promise<void>((resolve) => {
      finishCheck = resolve
    })
    mocked(getJellyfinServerInfo).mockImplementationOnce(async () => {
      await check
      throw new Error('Serveur indisponible')
    })

    try {
      await userEvent.click(refresh)
      await expect(
        await canvas.findByText('Vérification de la connexion…'),
      ).toBeVisible()
      await expect(refresh).toBeDisabled()
    } finally {
      finishCheck()
    }

    await expect(
      await canvas.findByText('Impossible de joindre le serveur.'),
    ).toBeVisible()
    await userEvent.click(refresh)
    await expect(await canvas.findByText('Connexion établie')).toBeVisible()
    await expect(refresh).toBeEnabled()
  },
}
