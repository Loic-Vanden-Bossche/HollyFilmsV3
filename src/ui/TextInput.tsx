import type { ComponentPropsWithoutRef } from 'react'

export function TextInput({
  className,
  ...props
}: ComponentPropsWithoutRef<'input'>) {
  return (
    <input
      {...props}
      className={[
        'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:opacity-50 aria-invalid:border-rose-400',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
