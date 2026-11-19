import { HorizontalRail } from './HorizontalRail.tsx'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Children, type ReactNode } from 'react'
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
  const reduced = useReducedMotion()
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
      </motion.div>
      <HorizontalRail
        trackClassName="detail-rail-track"
        previousLabel={t('{title} : précédent', { title })}
        nextLabel={t('{title} : suivant', { title })}
      >
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
      </HorizontalRail>
    </section>
  )
}
