import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

function PageSurface({
  children,
  pageKey,
  direction,
}: {
  children: ReactNode
  pageKey: string
  direction: number
}) {
  const present = useIsPresent()
  const reduced = useReducedMotion()
  return (
    <motion.div
      className="library-page-surface"
      data-page={pageKey}
      data-present={present}
      inert={!present}
      aria-hidden={!present}
      custom={direction}
      initial="enter"
      animate="visible"
      exit="exit"
      variants={{
        enter: (direction: number) => ({
          opacity: 0,
          x: reduced ? 0 : direction * 30,
        }),
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration: reduced ? 0.1 : 0.46, ease },
        },
        exit: (direction: number) => ({
          opacity: 0,
          x: reduced ? 0 : direction * -18,
          transition: { duration: reduced ? 0.08 : 0.16, ease: 'easeIn' },
        }),
      }}
    >
      {children}
    </motion.div>
  )
}

/** Keep navigation outside the presence boundary; rapid changes always settle on the latest page. */
export function LibraryTransition({
  pageKey,
  order,
  children,
}: {
  pageKey: string
  order: number
  children: ReactNode
}) {
  const [previous, setPrevious] = useState({
    key: pageKey,
    order,
    direction: 1,
  })
  if (previous.key !== pageKey)
    setPrevious({
      key: pageKey,
      order,
      direction: order >= previous.order ? 1 : -1,
    })
  return (
    <AnimatePresence mode="wait" custom={previous.direction}>
      <PageSurface
        key={pageKey}
        pageKey={pageKey}
        direction={previous.direction}
      >
        {children}
      </PageSurface>
    </AnimatePresence>
  )
}
