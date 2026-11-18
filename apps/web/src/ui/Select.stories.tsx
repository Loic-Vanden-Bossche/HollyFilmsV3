import { useEffect, useRef, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within, waitFor } from 'storybook/test'
import { Select } from './Select.tsx'
import { detectLocale, translate } from '../i18n/messages.ts'
import { languageFlag } from './language-flags.ts'
import '../performance/performance.css'

function NativeDialogScene(args: ComponentProps<typeof Select>) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(args.value)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    return () => element.close()
  }, [])
  return (
    <dialog ref={dialog} className="performance-dialog" aria-label="Réglages">
      <section className="performance-panel">
        <h2>Réglages</h2>
        <Select
          {...args}
          value={value}
          onValueChange={(next) => {
            setValue(next)
            args.onValueChange(next)
          }}
        />
      </section>
    </dialog>
  )
}

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
      await expect(
        within(canvasElement.ownerDocument.body).queryByPlaceholderText(
          'Rechercher une option',
        ),
      ).toBeNull()
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
    await waitFor(() =>
      expect(body.getByRole('option', { name: 'Automatique' })).toHaveFocus(),
    )
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
export const NativeDialog: Story = {
  args: {
    children: [
      ...options,
      ...[240, 360, 480, 720].map((height) => (
        <option key={height} value={height}>
          {height}p
        </option>
      )),
    ],
  },
  render: (args) => <NativeDialogScene {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const shell = await canvas.findByRole('dialog', { name: 'Réglages' })
    const dialog = within(shell)
    const trigger = dialog.getByRole('combobox', { name: 'Qualité' })
    if (trigger.tagName === 'SELECT')
      await userEvent.selectOptions(trigger, '4k')
    else {
      await userEvent.click(trigger)
      await waitFor(() => expect(dialog.getByRole('listbox')).toBeVisible())
      const search = dialog.getByRole('combobox', { name: /.+Qualité/ })
      await userEvent.type(search, 'définition')
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(trigger).toHaveFocus())
      await expect(shell).toBeVisible()
      await userEvent.click(trigger)
      await userEvent.click(
        await dialog.findByRole('option', {
          name: '4K · Ultra haute définition',
        }),
      )
    }
    await expect(args.onValueChange).toHaveBeenCalledWith('4k')
    await expect(shell).toBeVisible()
  },
}
export const LongList: Story = {
  args: {
    value: '0',
    children: Array.from({ length: 40 }, (_, i) => (
      <option key={i} value={i} disabled={i === 39}>
        Piste {i + 1} · Français — Version originale avec audiodescription
      </option>
    )),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox', {
      name: 'Qualité',
    })
    const body = within(canvasElement.ownerDocument.body)
    const native = trigger.tagName === 'SELECT'
    const locale = detectLocale([
      canvasElement.ownerDocument.documentElement.lang,
    ])
    const searchLabel = translate(
      locale,
      'Filtrer les options de « {field} »',
      { field: 'Qualité' },
    )
    if (!native) await userEvent.click(trigger)
    const search = await body.findByLabelText(searchLabel)
    await userEvent.type(search, 'introuvable')
    await expect(
      await body.findByText(translate(locale, 'Aucun résultat')),
    ).toBeVisible()
    await expect(args.onValueChange).not.toHaveBeenCalled()
    await userEvent.clear(search)
    await userEvent.type(search, '39 · FRANCAIS')
    await expect(body.getAllByRole('option')).toHaveLength(1)
    if (native) {
      await expect(trigger).toHaveValue('0')
      await userEvent.selectOptions(trigger, '38')
      await expect(search).toHaveValue('')
    } else {
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(trigger).toHaveFocus())
      await userEvent.click(trigger)
      await expect(await body.findByLabelText(searchLabel)).toHaveValue('')
      await expect(
        body.getByRole('option', { name: /Piste 40/ }),
      ).toHaveAttribute('aria-disabled', 'true')
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(trigger).toHaveFocus())
    }
    await expect(args.onValueChange).toHaveBeenCalledWith('38')
    await expect(args.onValueChange).toHaveBeenCalledTimes(1)
    if (!native) await userEvent.click(trigger)
    await userEvent.type(await body.findByLabelText(searchLabel), 'Piste 3')
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
