import type { Meta, StoryObj } from '@storybook/react-vite'
import { Wordmark } from './Wordmark.tsx'

const meta = {
  title: 'UI/Logo',
  component: Wordmark,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Wordmark>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
