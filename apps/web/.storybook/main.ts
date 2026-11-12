import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: [
    {
      name: 'addon-storybook-sync',
      options: {
        port:
          Number(process.env.WEBSTORM_ADDON_STORYBOOK_SYNC_PORT) || undefined,
      },
    },
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
  ],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  viteFinal: (config) => ({
    ...config,
    server: { ...config.server, proxy: undefined },
  }),
}

export default config
