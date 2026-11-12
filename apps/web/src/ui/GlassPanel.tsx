import type { ComponentPropsWithoutRef } from 'react'

export function GlassPanel({
  className,
  ...props
}: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      {...props}
      className={['glass-panel rounded-2xl p-6 sm:p-8', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
