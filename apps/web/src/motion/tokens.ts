// Motion uses seconds. Tailwind emits the same values as CSS time tokens at build time.
export const duration = {
  press: 0.1,
  micro: 0.18,
  panel: 0.27,
  scene: 0.42,
  feature: 0.72,
  stagger: 0.032,
} as const

export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.45, 0, 0.2, 1],
  in: [0.4, 0, 0.8, 0.3],
} as const

export const spring = {
  control: { type: 'spring', stiffness: 440, damping: 36, mass: 0.7 },
  card: { type: 'spring', stiffness: 270, damping: 30, mass: 0.75 },
} as const

export const scale = { pressed: 0.97, card: 1.018 } as const
export const distance = { control: 3, panel: 12, scene: 22 } as const
export const staggerDelay = (index: number) =>
  Math.min(Math.max(index, 0), 4) * duration.stagger

export const motionVariables = {
  ...Object.fromEntries(
    Object.entries(duration).map(([name, seconds]) => [
      `--hf-${name}`,
      `${seconds}s`,
    ]),
  ),
  '--hf-ease-out': `cubic-bezier(${ease.out.join(',')})`,
  '--hf-ease-in-out': `cubic-bezier(${ease.inOut.join(',')})`,
  '--hf-pressed': String(scale.pressed),
}
