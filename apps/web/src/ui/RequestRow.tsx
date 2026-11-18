import { useState, type ReactNode, type RefCallback } from 'react'
import { motion, useIsPresent } from 'motion/react'
import { duration, ease, staggerDelay } from '../motion/tokens.ts'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'

export function RequestRow({
  as = 'article',
  order = 0,
  className,
  children,
  ref,
}: {
  as?: 'article' | 'li'
  order?: number
  className?: string
  children: ReactNode
  ref?: RefCallback<HTMLElement>
}) {
  const Row = as === 'li' ? motion.li : motion.article
  const present = useIsPresent()
  const reduced = usePerformanceReducedMotion()
  const [visibility, setVisibility] = useState<'new' | 'near' | 'away'>('new')
  return (
    <Row
      ref={ref}
      className={className}
      inert={!present}
      viewport={{ margin: '64px 0px' }}
      onViewportEnter={() => setVisibility('near')}
      onViewportLeave={() => setVisibility('away')}
      layout={!reduced && visibility === 'near' ? 'position' : false}
      initial={false}
      animate={
        visibility === 'new' && !reduced
          ? { opacity: 0.7, y: 5 }
          : { opacity: 1, y: 0 }
      }
      exit={{
        opacity: 0,
        transition: { duration: visibility === 'near' ? duration.press : 0 },
      }}
      transition={{
        duration: reduced ? duration.press : duration.panel,
        delay: reduced ? 0 : staggerDelay(order),
        ease: ease.out,
        layout: { duration: reduced ? 0 : duration.panel, ease: ease.out },
      }}
    >
      {children}
    </Row>
  )
}
