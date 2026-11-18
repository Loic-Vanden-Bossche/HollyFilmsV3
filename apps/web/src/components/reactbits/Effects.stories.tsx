import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, waitFor } from 'storybook/test'
import { Play } from 'lucide-react'
import {
  AnimatedContent,
  AnimatedList,
  BlurText,
  ClickSpark,
  CountUp,
  ElasticSlider,
  GlareHover,
  GooeyNav,
  GradualBlur,
  MagicBento,
  Magnet,
  RotatingText,
  ShinyText,
  SpotlightCard,
  StarBorder,
} from './Effects.tsx'
import { MotionEnvironment } from './MotionEnvironment.tsx'

const meta = {
  title: 'UI/React Bits/Effets',
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 'min(880px, calc(100vw - 48px))' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Text: Story = {
  render: function TextEffects() {
    const [index, setIndex] = useState(0)
    return (
      <>
        <h1 className="text-4xl">
          <BlurText text="Votre bibliothèque, en grand." />
        </h1>
        <p className="my-6 text-accent">
          <ShinyText>HOLLYFILMS 3.0</ShinyText>
        </p>
        <RotatingText
          items={['Films et séries', 'Reprise de lecture', 'Plusieurs langues']}
          index={index}
        />
        <button
          className="glass-control rounded-2xl px-5 py-3"
          onClick={() => setIndex((i) => (i + 1) % 3)}
        >
          Fonctionnalité suivante
        </button>
      </>
    )
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const highlight = canvasElement.querySelector('.rb-shiny-highlight')!
    await expect(highlight).toHaveAttribute('aria-hidden', 'true')
    await expect(getComputedStyle(highlight).backgroundClip).toBe('text')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Fonctionnalité suivante' }),
    )
    await waitFor(() =>
      expect(canvas.getByText('Reprise de lecture')).toBeVisible(),
    )
  },
}
export const Actions: Story = {
  render: function Actions() {
    const [burst, setBurst] = useState(0)
    return (
      <StarBorder className="inline-block rounded-full">
        <button
          className="relative rounded-full bg-brand-gradient px-6 py-4 text-primary-foreground"
          onClick={() => setBurst((n) => n + 1)}
        >
          <Magnet>
            <Play size={18} /> Confirmer
          </Magnet>
          <ClickSpark burst={burst} />
        </button>
      </StarBorder>
    )
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(
      canvasElement.querySelector('.rb-click-spark'),
    ).toHaveAttribute('data-burst', '0')
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer' }))
    await expect(
      canvasElement.querySelector('.rb-click-spark'),
    ).toHaveAttribute('data-burst', '1')
  },
}
export const Surfaces: Story = {
  render: function Surfaces() {
    const [active, setActive] = useState(false)
    return (
      <SpotlightCard className="rb-bento-cell">
        <button
          className="relative w-full p-12 text-left"
          onPointerEnter={() => setActive(true)}
          onPointerLeave={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
        >
          <BlurText text="Lumière, profondeur et reflet" />
          <GlareHover active={active} />
        </button>
        <GradualBlur size="20px" strength={3} />
      </SpotlightCard>
    )
  },
}
export const Bento: Story = {
  render: function Bento() {
    const [count, setCount] = useState(12)
    return (
      <>
        <MagicBento>
          <dl>
            <dt>En attente</dt>
            <dd>
              <CountUp value={count} />
            </dd>
          </dl>
          <dl>
            <dt>Approuvées</dt>
            <dd>
              <CountUp value={8} />
            </dd>
          </dl>
          <dl>
            <dt>Refusées</dt>
            <dd>
              <CountUp value={2} />
            </dd>
          </dl>
        </MagicBento>
        <button
          className="glass-control rounded-2xl px-5 py-3"
          onClick={() => setCount((n) => n + 1)}
        >
          Nouvelle demande
        </button>
      </>
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Nouvelle demande' }),
    )
    await expect(canvas.getByLabelText('13')).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByLabelText('13')).toHaveTextContent('13'),
    )
  },
}
export const List: Story = {
  render: function List() {
    const [items, setItems] = useState(['Français', 'English'])
    return (
      <AnimatedContent>
        <AnimatedList as="ul" label="Pistes audio">
          {items.map((item) => (
            <li key={item} className="p-4">
              {item}
            </li>
          ))}
        </AnimatedList>
        <button
          className="glass-control rounded-2xl px-5 py-3"
          disabled={items.length === 3}
          onClick={() => setItems([...items, '日本語'])}
        >
          Ajouter une piste
        </button>
      </AnimatedContent>
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ajouter une piste' }),
    )
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3)
  },
}
export const Navigation: Story = {
  render: function Navigation() {
    const [value, setValue] = useState('all')
    return (
      <GooeyNav
        items={[
          { value: 'all', label: 'Accueil' },
          { value: 'movies', label: 'Films' },
          { value: 'series', label: 'Séries' },
        ]}
        value={value}
        onChange={setValue}
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    canvas.getByRole('button', { name: 'Films' }).focus()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('button', { name: 'Films' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}
export const Volume: Story = {
  render: function Volume() {
    const [volume, setVolume] = useState(0.75)
    return (
      <>
        <ElasticSlider value={volume} onChange={setVolume} />
        <output className="ml-6">{Math.round(volume * 100)} %</output>
      </>
    )
  },
  play: async ({ canvas }) => {
    const slider = canvas.getByRole('slider', { name: 'Volume' })
    slider.focus()
    await expect(slider).toHaveFocus()
    // Synthetic key events do not run a native range input's default action.
    fireEvent.change(slider, { target: { value: '0.76' } })
    await expect(slider).toHaveAttribute('aria-valuetext', '76 %')
    fireEvent.change(slider, { target: { value: '0' } })
    await expect(slider).toHaveValue('0')
    fireEvent.change(slider, { target: { value: '1' } })
    await expect(slider).toHaveValue('1')
  },
}
export const Paused: Story = {
  render: () => (
    <MotionEnvironment paused>
      <StarBorder>
        <SpotlightCard className="rb-bento-cell">
          <BlurText text="Les effets décoratifs sont suspendus." />
          <ShinyText>HOLLYFILMS 3.0</ShinyText>
        </SpotlightCard>
      </StarBorder>
    </MotionEnvironment>
  ),
  play: async ({ canvasElement }) => {
    for (const effect of canvasElement.querySelectorAll('[data-running]'))
      await expect(effect).toHaveAttribute('data-running', 'false')
  },
}
