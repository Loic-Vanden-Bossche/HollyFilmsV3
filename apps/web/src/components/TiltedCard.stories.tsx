import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import TiltedCard from './TiltedCard.tsx'
import { homeItems } from '../home-fixtures.ts'

const meta = {
  title: 'UI/React Bits/Tilted Card',
  component: TiltedCard,
  parameters: { layout: 'centered' },
  args: {
    active: false,
    children: (
      <img
        src={
          typeof homeItems[0].poster === 'string'
            ? homeItems[0].poster
            : undefined
        }
        alt="Affiche de démonstration Orbital"
        className="block w-full rounded-lg"
      />
    ),
  },
  render: function Render(args) {
    const [hovered, setHovered] = useState(false)
    return (
      <div
        className="w-64 p-6"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <TiltedCard {...args} active={args.active || hovered} />
      </div>
    )
  },
} satisfies Meta<typeof TiltedCard>
export default meta
type Story = StoryObj<typeof meta>
export const Pointer: Story = {}
export const Static: Story = { args: { disabled: true, active: true } }
