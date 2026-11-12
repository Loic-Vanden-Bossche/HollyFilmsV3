import type { ComponentPropsWithoutRef } from 'react'

const variants = {
  primary:
    'rounded-lg bg-primary bg-brand-gradient px-4 py-2.5 font-semibold text-primary-foreground shadow-glass-control enabled:hover:brightness-110 forced-colors:border',
  secondary: 'glass-control rounded-lg px-4 py-2 text-sm font-medium',
  link: 'text-sm text-link underline underline-offset-4 enabled:hover:text-accent-foreground',
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
      className={[variants[variant], 'disabled:opacity-50', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
