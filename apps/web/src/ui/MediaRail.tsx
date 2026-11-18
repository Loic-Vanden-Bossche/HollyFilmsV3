import { Tooltip } from './Tooltip.tsx'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Children, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { duration, staggerDelay } from '../motion/tokens.ts'
import { cinemaMotion } from '../components/reactbits/policy.ts'

export function MediaRail({
  title,
  children,
  kind = 'poster',
  count,
}: {
  title: string
  children: ReactNode
  kind?: 'poster' | 'person' | 'scene' | 'review'
  count?: number
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion()
  const [edges, setEdges] = useState({ start: true, end: true })
  useEffect(() => {
    const node = ref.current!
    const update = () => {
      const start = node.scrollLeft < 2,
        end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 2
      setEdges((previous) =>
        previous.start === start && previous.end === end
          ? previous
          : { start, end },
      )
    }
    update()
    const resize = new ResizeObserver(update)
    resize.observe(node)
    for (const child of node.children) resize.observe(child)
    node.addEventListener('scroll', update, { passive: true })
    return () => {
      resize.disconnect()
      node.removeEventListener('scroll', update)
    }
  }, [children])
  const move = (direction: number) =>
    ref.current?.scrollBy({
      left: direction * ref.current.clientWidth * 0.85,
      behavior: reduced ? 'instant' : 'smooth',
    })
  return (
    <section className={`detail-rail detail-rail-${kind}`} aria-label={title}>
      <motion.div
        className="detail-section-heading"
        initial={
          reduced ? false : { opacity: 0, transform: 'translateY(14px)' }
        }
        whileInView={{ opacity: 1, transform: 'translateY(0px)' }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: reduced ? 0 : 0.4, ease: cinemaMotion.ease }}
      >
        <h3>
          {title}
          {count != null && <span>{count}</span>}
        </h3>
        <div className="detail-rail-controls">
          <Tooltip>
            <button
              className="glass-control"
              aria-label={t('{title} : précédent', { title })}
              disabled={edges.start}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
          </Tooltip>
          <Tooltip>
            <button
              className="glass-control"
              aria-label={t('{title} : suivant', { title })}
              disabled={edges.end}
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </Tooltip>
        </div>
      </motion.div>
      <div ref={ref} className="detail-rail-track">
        {Children.map(
          children,
          (child, index) =>
            child && (
              <motion.div
                className="detail-rail-entry"
                initial={
                  reduced
                    ? false
                    : { opacity: 0, transform: 'translateY(22px) scale(0.97)' }
                }
                whileInView={{
                  opacity: 1,
                  transform: 'translateY(0px) scale(1)',
                }}
                viewport={{ once: true, amount: 0.08 }}
                onFocusCapture={(event) => {
                  // Keyboard navigation can reach a card before its scroll reveal.
                  event.currentTarget
                    .getAnimations()
                    .forEach((animation) => animation.finish())
                }}
                transition={{
                  duration: reduced ? 0 : duration.scene,
                  delay: reduced ? 0 : staggerDelay(index % 5),
                  ease: cinemaMotion.ease,
                }}
              >
                {child}
              </motion.div>
            ),
        )}
      </div>
    </section>
  )
}
