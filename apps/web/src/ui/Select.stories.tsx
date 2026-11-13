import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within, waitFor } from 'storybook/test'
import { Select } from './Select.tsx'
import { languageFlag } from './language-flags.ts'

const meta = {
  title: 'UI/Select',
  component: Select,
  args: {
    'aria-label': 'Qualité',
    value: '',
    onValueChange: fn(),
    children: <option value="">Automatique</option>,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return (
      <label style={{ display: 'grid', gap: 10, width: 280, maxWidth: '100%' }}>
        Qualité
        <Select
          {...args}
          value={value}
          onValueChange={(next) => {
            setValue(next)
            args.onValueChange(next)
          }}
        />
      </label>
    )
  },
} satisfies Meta<typeof Select>
export default meta
type Story = StoryObj<typeof meta>
const options = [
  <option key="auto" value="">
    Automatique
  </option>,
  <option key="hd" value="hd">
    1080p · Haute définition
  </option>,
  <option key="4k" value="4k">
    4K · Ultra haute définition
  </option>,
  <option key="disabled" value="unavailable" disabled>
    Source indisponible
  </option>,
]
export const Default: Story = {
  args: { children: options },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox', { name: 'Qualité' })
    if (trigger.tagName === 'SELECT') {
      await userEvent.selectOptions(trigger, 'hd')
    } else {
      await userEvent.click(trigger)
      await userEvent.click(
        await within(canvasElement.ownerDocument.body).findByRole('option', {
          name: '1080p · Haute définition',
        }),
      )
    }
    await expect(args.onValueChange).toHaveBeenCalledWith('hd')
  },
}
export const Keyboard: Story = {
  args: { children: options },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox', { name: 'Qualité' })
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    const body = within(canvasElement.ownerDocument.body)
    await body.findByRole('listbox')
    await userEvent.keyboard('{End}{Enter}')
    await expect(args.onValueChange).not.toHaveBeenCalled()
    await userEvent.keyboard('{ArrowUp}{Enter}')
    await expect(args.onValueChange).toHaveBeenCalledWith('4k')
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(
        body.getByRole('option', { name: '4K · Ultra haute définition' }),
      ).toHaveFocus(),
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    await userEvent.click(canvasElement)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  },
}
export const Disabled: Story = { args: { disabled: true, children: options } }
export const LongList: Story = {
  args: {
    value: '0',
    children: Array.from({ length: 40 }, (_, i) => (
      <option key={i} value={i}>
        Piste {i + 1} · Français — Version originale avec audiodescription
      </option>
    )),
  },
}
export const Languages: Story = {
  args: {
    'aria-label': 'Audio',
    value: 'fra',
    optionIcon: (value) => {
      const flag = languageFlag(value)
      return flag ? (
        <img
          className="holly-select-flag"
          src={flag}
          alt=""
          width={20}
          height={15}
        />
      ) : null
    },
    children: [
      <option key="fr" value="fra">
        Français · DTS 5.1
      </option>,
      <option key="en" value="eng">
        English · AAC Stereo
      </option>,
      <option key="off" value="off">
        Désactivés
      </option>,
    ],
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const select = canvas.getByRole('combobox', { name: 'Audio' })
    if (select.tagName === 'SELECT')
      await userEvent.selectOptions(select, 'eng')
    else {
      await userEvent.click(select)
      await userEvent.click(
        await within(canvasElement.ownerDocument.body).findByRole('option', {
          name: 'English · AAC Stereo',
        }),
      )
    }
    await expect(args.onValueChange).toHaveBeenCalledWith('eng')
    const flag = canvasElement.querySelector(
      '.holly-select-flag',
    ) as HTMLImageElement
    await expect(flag.src).toMatch(/gb/)
  },
}
