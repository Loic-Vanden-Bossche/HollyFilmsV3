import type { ComponentPropsWithoutRef } from 'react'

export function TextInput({
  className,
  ...props
}: ComponentPropsWithoutRef<'input'>) {
  return (
    <input
      {...props}
      className={[
        'glass-input w-full rounded-lg border border-input px-3 py-2.5 text-foreground placeholder:text-muted-foreground disabled:opacity-50 aria-invalid:border-destructive',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
