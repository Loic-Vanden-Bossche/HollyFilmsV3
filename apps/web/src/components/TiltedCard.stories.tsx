import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, waitFor } from 'storybook/test'
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

export const Expanded: Story = {
  name: 'Agrandissement de la carte entière',
  args: { hoverScale: 1.18, tiltStrength: 0.2 },
}

export const TiltWithoutZoom: Story = {
  name: 'Relief 3D sans agrandissement',
  args: { hoverScale: 1, hoverLift: 0, tiltStrength: 0.75 },
  play: async ({ canvasElement, userEvent }) => {
    const card = canvasElement.querySelector<HTMLElement>('.tilted-card')!
    const body = card.querySelector<HTMLElement>('.tilted-card__body')!
    const before = card.getBoundingClientRect()
    await userEvent.hover(card)
    fireEvent.pointerMove(card, {
      pointerType: 'mouse',
      clientX: before.left + 10,
      clientY: before.top + 10,
    })
    await waitFor(() => {
      if (!body.style.transform.includes('rotate'))
        throw new Error('Le ressort commence son mouvement')
    })
    await expect(card.getBoundingClientRect().width).toBe(before.width)
    await expect(card.getBoundingClientRect().height).toBe(before.height)
    await userEvent.unhover(card)
    await waitFor(() => {
      if (
        getComputedStyle(card).perspective !== 'none' ||
        getComputedStyle(card.querySelector('.tilted-card__halo')!)
          .visibility !== 'hidden'
      )
        throw new Error('Le relief termine son retour au repos')
    })
    await expect(card.querySelector('.tilted-card__halo')).not.toBeVisible()
  },
}
