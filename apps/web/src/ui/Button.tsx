import type { ComponentPropsWithoutRef } from 'react'
import { Magnet } from '../components/reactbits/Effects.tsx'

const variants = {
  primary:
    'rounded-control bg-primary bg-brand-gradient px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glass-control enabled:hover:brightness-110 forced-colors:border',
  secondary: 'glass-control rounded-control px-5 py-3 text-sm font-medium',
  link: 'text-sm text-link underline underline-offset-4 enabled:hover:text-accent-foreground',
}

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: keyof typeof variants
}

export function Button({
  variant = 'secondary',
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={[
        variants[variant],
        'min-h-11 cursor-pointer transition duration-200 enabled:active:scale-[.98] disabled:cursor-wait disabled:opacity-50 motion-reduce:transform-none',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {variant === 'primary' ? <Magnet>{children}</Magnet> : children}
    </button>
  )
}
