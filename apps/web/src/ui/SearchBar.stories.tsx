import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { SearchBar } from './SearchBar.tsx'
import '../home.css'

const meta = {
  title: 'UI/Recherche/Barre cinéma',
  component: SearchBar,
  parameters: { layout: 'fullscreen' },
  args: {
    value: '',
    expanded: false,
    loading: false,
    onChange: fn(),
    onExpand: fn(),
    onClose: fn(),
  },
  render: function Render(args) {
    const [expanded, setExpanded] = useState(args.expanded)
    const [value, setValue] = useState(args.value)
    return (
      <header className="home-topbar" data-search={expanded}>
        <strong>HOLLYFILMS</strong>
        <div className="home-tools">
          <SearchBar
            {...args}
            value={value}
            expanded={expanded}
            onExpand={() => {
              args.onExpand()
              setExpanded(true)
            }}
            onChange={(value) => {
              args.onChange(value)
              setValue(value)
            }}
            onClose={() => {
              args.onClose()
              setExpanded(false)
              setValue('')
            }}
          />
        </div>
      </header>
    )
  },
} satisfies Meta<typeof SearchBar>
export default meta
type Story = StoryObj<typeof meta>
export const FocusAndEscape: Story = {
  name: 'Focus, saisie et fermeture animée',
  play: async ({ canvas, args, userEvent, canvasElement }) => {
    const input = canvas.getByRole('searchbox')
    await userEvent.click(input)
    await expect(args.onExpand).toHaveBeenCalled()
    await expect(canvasElement.querySelector('.cinema-search')).toHaveAttribute(
      'data-expanded',
      'true',
    )
    await userEvent.type(input, 'Signal')
    await expect(args.onChange).toHaveBeenLastCalledWith('Signal')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Effacer la recherche' }),
    )
    await expect(input).toHaveValue('')
    await expect(input).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(args.onClose).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(canvasElement.querySelector('.cinema-search')).toHaveAttribute(
        'data-expanded',
        'false',
      ),
    )
    await expect(input).toHaveFocus()
  },
}
export const Expanded: Story = {
  args: { expanded: true, value: 'Le Seigneur des anneaux' },
}
export const Loading: Story = {
  args: { expanded: true, value: 'Signal', loading: true },
}
