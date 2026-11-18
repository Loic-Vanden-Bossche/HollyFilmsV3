import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'

import { distance, duration, ease } from '../motion/tokens.ts'

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
          x: reduced ? 0 : direction * distance.scene,
        }),
        visible: {
          opacity: 1,
          x: 0,
          transition: {
            duration: reduced ? 0.08 : duration.scene,
            ease: ease.out,
          },
        },
        exit: (direction: number) => ({
          opacity: 0,
          x: reduced ? 0 : direction * -distance.panel,
          transition: { duration: reduced ? 0 : duration.press, ease: ease.in },
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
    <div className="library-transition">
      <AnimatePresence mode="sync" custom={previous.direction}>
        <PageSurface
          key={pageKey}
          pageKey={pageKey}
          direction={previous.direction}
        >
          {children}
        </PageSurface>
      </AnimatePresence>
    </div>
  )
}
