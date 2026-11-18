import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, fireEvent } from 'storybook/test'
import { PlayerVolume } from './PlayerVolume.tsx'

const meta = {
  title: 'UI/Volume du lecteur',
  component: PlayerVolume,
  args: { value: 0.65, muted: false, onChange: fn(), onMute: fn() },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    const [muted, setMuted] = useState(args.muted)
    return (
      <PlayerVolume
        {...args}
        value={value}
        muted={muted}
        onChange={(next) => {
          setValue(next)
          setMuted(false)
          args.onChange(next)
        }}
        onMute={() => {
          setMuted(!muted)
          args.onMute()
        }}
      />
    )
  },
} satisfies Meta<typeof PlayerVolume>
export default meta
type Story = StoryObj<typeof meta>
export const Interactive: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Couper le son' }))
    await expect(args.onMute).toHaveBeenCalledOnce()
    const slider = canvas.getByRole('slider', { name: 'Volume' })
    await expect(slider).toHaveValue('0')
    await expect(
      canvasElement.querySelectorAll('[data-lit="true"]'),
    ).toHaveLength(0)
    fireEvent.change(slider, { target: { value: '0.42' } })
    await expect(args.onChange).toHaveBeenLastCalledWith(0.42)
    await expect(slider).toHaveAttribute('aria-valuetext', '42 %')
    await expect(
      canvasElement.querySelectorAll('[data-lit="true"]'),
    ).toHaveLength(9)
    await expect(
      canvas.getByRole('button', { name: 'Couper le son' }),
    ).toHaveAttribute('aria-pressed', 'false')
  },
}
export const Muted: Story = { args: { muted: true } }
