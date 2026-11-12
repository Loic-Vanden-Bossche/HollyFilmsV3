import type { ComponentPropsWithoutRef } from 'react'

const variants = {
  primary:
    'rounded-lg bg-emerald-300 px-4 py-2.5 font-semibold text-zinc-950 hover:bg-emerald-200',
  secondary:
    'rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-800',
  link: 'text-sm text-emerald-300 underline',
}

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: keyof typeof variants
}

export function Button({
  variant = 'secondary',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={[
        variants[variant],
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
