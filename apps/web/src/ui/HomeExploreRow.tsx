import { useId } from 'react'
import { motion } from 'motion/react'
import { ArrowDownRight } from 'lucide-react'
import type { HomeShelf } from '../home-shelves.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { localizeText } from '../i18n/messages.ts'
import { duration, ease } from '../motion/tokens.ts'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { HorizontalRail } from './HorizontalRail.tsx'
import './home-explore-row.css'

export function HomeExploreRow({ shelves }: { shelves: readonly HomeShelf[] }) {
  const heading = useId()
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  if (shelves.length < 2) return null

  const title = t('Explorer les sélections')
  const transition = { duration: reduced ? 0 : duration.panel, ease: ease.out }
  return (
    <nav
      className="home-shelf"
      data-home-shelf="explore"
      aria-labelledby={heading}
    >
      <div className="home-section-header">
        <h2 id={heading}>{title}</h2>
      </div>
      <HorizontalRail
        previousLabel={t('Sélections précédentes')}
        nextLabel={t('Sélections suivantes')}
        trackClassName="home-shelf-track home-explore-track"
      >
        {shelves.map((shelf) => (
          <motion.a
            key={shelf.id}
            className="home-explore-tile"
            data-theme={shelf.id}
            href={'#home-shelf-' + shelf.id}
            initial="rest"
            animate="rest"
            variants={{ rest: { scale: 1 }, active: { scale: 1.035 } }}
            transition={transition}
            whileHover="active"
            whileFocus="active"
            whileTap={reduced ? undefined : { scale: 0.985 }}
          >
            <motion.span
              className="home-explore-light"
              aria-hidden="true"
              variants={{
                rest: { scale: 1, x: '0%', opacity: 0.84 },
                active: {
                  scale: reduced ? 1 : 1.07,
                  x: reduced ? '0%' : '-3%',
                  opacity: 1,
                },
              }}
              transition={transition}
            />
            <span className="home-explore-label">
              {t(
                shelf.title,
                shelf.genre
                  ? { genre: localizeText(t, shelf.genre) }
                  : undefined,
              )}
            </span>
            <motion.span
              className="home-explore-direction"
              aria-hidden="true"
              variants={{
                rest: { opacity: 0, x: reduced ? 0 : -4, y: reduced ? 0 : -4 },
                active: { opacity: 1, x: 0, y: 0 },
              }}
              transition={transition}
            >
              <ArrowDownRight size={18} />
            </motion.span>
          </motion.a>
        ))}
      </HorizontalRail>
    </nav>
  )
}
