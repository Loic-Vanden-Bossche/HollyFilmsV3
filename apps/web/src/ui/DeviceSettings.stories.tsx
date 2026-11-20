import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor } from 'storybook/test'
import { DeviceSettings } from './DeviceSettings.tsx'

const meta = {
  title: 'UI/Application et alertes',
  component: DeviceSettings,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    installed: false,
    canInstall: true,
    ios: false,
    updateAvailable: false,
    pushState: 'ready',
    canTest: true,
    install:
      fn<
        () => Promise<'accepted' | 'dismissed' | 'unavailable'>
      >().mockResolvedValue('dismissed'),
    applyUpdate: fn(),
    onAction: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof DeviceSettings>
export default meta
type Story = StoryObj<typeof meta>

export const NotificationShortcut: Story = {
  name: 'Accéder aux réglages des alertes',
  beforeEach: () => {
    const { href } = location
    history.replaceState(history.state, '', href.split('#')[0])
    return () => history.replaceState(history.state, '', href)
  },
  render: (args) => (
    <>
      <div style={{ minHeight: '110vh' }}>
        <a href="#device-notifications" target="_self">
          Réglages des alertes
        </a>
      </div>
      <DeviceSettings {...args} />
      <div aria-hidden="true" style={{ height: '100vh' }} />
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    const link = canvas.getByRole('link', { name: 'Réglages des alertes' })
    const heading = canvas.getByRole('heading', { name: 'Sur cet appareil' })
    const section = canvas.getByRole('region', { name: 'Sur cet appareil' })
    await userEvent.click(link)
    await waitFor(() => {
      expect(heading).toHaveFocus()
      expect(
        Math.abs(
          section.getBoundingClientRect().top -
            parseFloat(getComputedStyle(section).scrollMarginTop),
        ),
      ).toBeLessThan(2)
    })
  },
}

export const InstallAndEnable: Story = {
  play: async ({ canvas, args }) => {
    await expect(args.install).not.toHaveBeenCalled()
    await expect(args.onAction).not.toHaveBeenCalled()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Installer HollyFilms' }),
    )
    await expect(args.install).toHaveBeenCalledOnce()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Activer les alertes' }),
    )
    await expect(args.onAction).toHaveBeenCalledWith('enable')
    await expect(
      canvas.getByRole('link', { name: 'Voir toutes les notifications' }),
    ).toHaveAttribute('href', '/notifications')
  },
}
export const EnabledWithUpdate: Story = {
  args: {
    installed: true,
    canInstall: false,
    updateAvailable: true,
    pushState: 'enabled',
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Envoyer un test' }),
    )
    await expect(args.onAction).toHaveBeenCalledWith('test')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Désactiver les alertes' }),
    )
    await expect(args.onAction).toHaveBeenCalledWith('disable')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Recharger pour mettre à jour' }),
    )
    await expect(args.applyUpdate).toHaveBeenCalledOnce()
  },
}
export const PermissionDenied: Story = {
  args: { pushState: 'denied' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Autorisez les notifications/)).toBeVisible()
    await expect(
      canvas.queryByRole('button', { name: 'Activer les alertes' }),
    ).not.toBeInTheDocument()
  },
}
export const IphoneHomeScreen: Story = {
  args: { canInstall: false, ios: true, pushState: 'ios' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Dans Safari/)).toBeVisible()
    await expect(canvas.getByText(/Pour recevoir les alertes/)).toBeVisible()
  },
}
export const Retry: Story = {
  args: { pushState: 'failed' },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}
export const Offline: Story = {
  args: { pushState: 'offline', installed: true },
}
export const ServerConfiguration: Story = {
  args: { pushState: 'unconfigured' },
}
