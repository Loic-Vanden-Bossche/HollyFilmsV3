import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileAvatar } from './ProfileAvatar.tsx'
import { avatarFixture } from '../profile-fixtures.ts'
const meta = {
  title: 'UI/Avatar de profil',
  component: ProfileAvatar,
  args: { name: 'Alex' },
  decorators: [
    (Story) => (
      <div style={{ width: 80, height: 80, borderRadius: '50%', fontSize: 30 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileAvatar>
export default meta
type Story = StoryObj<typeof meta>
export const Initial: Story = {}
export const Photo: Story = { args: { src: avatarFixture } }
export const MissingPhoto: Story = {
  args: { src: 'data:image/png;base64,invalid' },
}
