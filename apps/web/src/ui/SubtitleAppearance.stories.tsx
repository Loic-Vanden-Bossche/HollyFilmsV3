import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn } from 'storybook/test'
import { SubtitleAppearance } from './SubtitleAppearance.tsx'
import { classicSubtitle } from '../playback/preferences.ts'

const meta = {
  title: 'UI/Lecteur/Apparence des sous-titres',
  component: SubtitleAppearance,
  args: {
    styles: { primary: classicSubtitle, secondary: classicSubtitle },
    hasSecondary: true,
    onChange: fn(),
  },
  render: function Editor(args) {
    const [styles, setStyles] = useState(args.styles)
    return (
      <div style={{ width: 'min(310px, 100%)' }}>
        <SubtitleAppearance
          {...args}
          styles={styles}
          onChange={(slot, style) => {
            setStyles((current) => ({ ...current, [slot]: style }))
            args.onChange(slot, style)
          }}
        />
      </div>
    )
  },
} satisfies Meta<typeof SubtitleAppearance>
export default meta
type Story = StoryObj<typeof meta>

export const PrimaryOnly: Story = {
  args: { hasSecondary: false },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Apparence des sous-titres' }),
    )
    await expect(
      canvas.queryByRole('group', { name: 'Piste à personnaliser' }),
    ).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Jaune' }))
    await expect(args.onChange).toHaveBeenLastCalledWith(
      'primary',
      expect.objectContaining({ customized: true }),
    )
  },
}

export const Bilingual: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Apparence des sous-titres' }),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Secondaire' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Jaune' }))
    const size = canvas.getByRole('slider', { name: 'Taille' })
    await fireEvent.change(size, { target: { value: '1.2' } })
    await expect(size).toHaveValue('1.2')
    await userEvent.click(canvas.getByRole('button', { name: 'Principale' }))
    await expect(canvas.getByRole('button', { name: 'Blanc' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(canvas.getByRole('slider', { name: 'Taille' })).toHaveValue(
      '1',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Secondaire' }))
    await expect(canvas.getByRole('button', { name: 'Jaune' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(canvas.getByRole('slider', { name: 'Taille' })).toHaveValue(
      '1.2',
    )
  },
}
