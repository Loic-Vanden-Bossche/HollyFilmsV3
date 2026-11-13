import { useCallback, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, fireEvent, waitFor } from 'storybook/test'
import { SubtitleOffset } from './SubtitleOffset.tsx'

const meta = {
  title: 'UI/Synchronisation des sous-titres',
  component: SubtitleOffset,
  args: { value: 0, onChange: fn(), onClose: fn() },
  parameters: { layout: 'fullscreen' },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    const [open, setOpen] = useState(true)
    const onClose = args.onClose
    const close = useCallback(() => {
      setOpen(false)
      onClose()
    }, [onClose])
    return (
      <div
        style={{ position: 'relative', minHeight: 400, background: '#080f1b' }}
      >
        <button
          style={{ position: 'absolute', bottom: 20, left: 20 }}
          onClick={() => setOpen(true)}
        >
          Régler le décalage
        </button>
        <AnimatePresence>
          {open && (
            <SubtitleOffset
              value={value}
              onChange={(next) => {
                setValue(next)
                args.onChange(next)
              }}
              onClose={close}
            />
          )}
        </AnimatePresence>
      </div>
    )
  },
} satisfies Meta<typeof SubtitleOffset>
export default meta
type Story = StoryObj<typeof meta>
export const Interactive: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const slider = canvas.getByRole('slider')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retarder de 0,1 seconde' }),
    )
    await expect(args.onChange).toHaveBeenLastCalledWith(0.1)
    fireEvent.change(slider, { target: { value: '-120' } })
    await expect(
      canvas.getByRole('button', { name: 'Avancer de 0,1 seconde' }),
    ).toBeDisabled()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Réinitialiser le décalage' }),
    )
    await expect(slider).toHaveValue('0')
    await userEvent.keyboard('{Escape}')
    await expect(args.onClose).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(canvas.queryByRole('slider')).not.toBeInTheDocument(),
    )
  },
}
export const Delayed: Story = { args: { value: 2.5 } }
