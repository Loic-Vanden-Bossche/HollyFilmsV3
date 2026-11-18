import { useI18n } from '../../i18n/I18nProvider.tsx'
import { Tooltip } from '../../ui/Tooltip.tsx'
// React Bits Staggered Menu + Flowing Menu adapted to native dialog, Motion and authenticated artwork.
import { createContext, useContext, useRef } from 'react'
import { motion } from 'motion/react'
import { ArrowUpRight, X } from 'lucide-react'
import type { LibraryFilter, MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { MediaArtwork } from '../../ui/MediaArtwork.tsx'
import { Wordmark } from '../../ui/Wordmark.tsx'
import { useModalPresence } from '../../ui/use-modal-presence.ts'
import { duration, distance, staggerDelay } from '../../motion/tokens.ts'
import { cinemaMotion, useMotionPolicy } from './policy.ts'
import './effects.css'

const CloseMenu = createContext<() => void>(() => {})

export function FlowingMenu({
  items,
  session,
  selected,
  onSelect,
}: {
  items: MediaItem[]
  session?: JellyfinSession
  selected: LibraryFilter
  onSelect: (value: LibraryFilter) => void
}) {
  const { t } = useI18n()
  const { reduced, pageVisible } = useMotionPolicy()
  const closeMenu = useContext(CloseMenu)
  return (
    <nav
      className="rb-flowing-menu"
      data-running={pageVisible && !reduced}
      aria-label={t('Explorer HollyFilms')}
    >
      {(
        [
          ['all', t('Accueil')],
          ['movies', t('Films')],
          ['series', t('Séries')],
        ] as const
      ).map(([value, label], index) => {
        const posters = items
          .filter(
            (item) =>
              value === 'all' ||
              (value === 'movies'
                ? item.kind === 'Film'
                : item.kind !== 'Film'),
          )
          .slice(0, 6)
        return (
          <motion.button
            key={value}
            type="button"
            aria-current={selected === value ? 'page' : undefined}
            onClick={() => {
              onSelect(value)
              closeMenu()
            }}
            initial={{ opacity: 0.6, y: reduced ? 0 : distance.panel }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? duration.press : duration.panel,
              delay: reduced ? 0 : staggerDelay(index),
              ease: cinemaMotion.ease,
            }}
          >
            <span className="rb-flow-number">0{index + 1}</span>
            <span className="rb-flow-label">{label}</span>
            <ArrowUpRight aria-hidden="true" />
            <span className="rb-flow-band" aria-hidden="true">
              <span className="rb-flow-marquee">
                {[0, 1].map((copy) => (
                  <span key={copy} className="rb-flow-group">
                    <strong>{label}</strong>
                    {posters.map((item) => (
                      <span key={item.id} className="rb-flow-art">
                        <MediaArtwork
                          source={item.poster}
                          session={session}
                          width={400}
                        />
                      </span>
                    ))}
                  </span>
                ))}
              </span>
            </span>
          </motion.button>
        )
      })}
    </nav>
  )
}
export function StaggeredMenu({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  const { t } = useI18n()
  const { dialog, surface, present } = useModalPresence()
  const backdrop = useRef(false)
  const { reduced } = useMotionPolicy()
  return (
    <motion.dialog
      ref={dialog}
      inert={!present}
      data-exiting={!present || undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: duration.micro }}
      className="rb-staggered-menu"
      aria-label={t('Navigation HollyFilms')}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onPointerDown={(e) => {
        backdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (backdrop.current && e.target === e.currentTarget) onClose()
        backdrop.current = false
      }}
    >
      <motion.section
        ref={surface}
        className="rb-menu-panel"
        initial={reduced ? false : { scale: 0.98, y: -distance.panel }}
        animate={{ scale: 1, y: 0 }}
        exit={reduced ? {} : { scale: 0.98, y: -distance.panel }}
        transition={{ duration: duration.panel, ease: cinemaMotion.ease }}
      >
        <header>
          <Wordmark compact />
          <span>{t('EXPLORER / HOLLYFILMS 3.0')}</span>
          <Tooltip>
            <button
              type="button"
              aria-label={t('Fermer la navigation')}
              onClick={onClose}
            >
              <X size={24} />
            </button>
          </Tooltip>
        </header>
        <CloseMenu value={onClose}>{children}</CloseMenu>
        <footer>
          <span>{t('VOTRE BIBLIOTHÈQUE, EN GRAND.')}</span>
          <span>{t('Films · Séries · Reprise de lecture')}</span>
        </footer>
      </motion.section>
    </motion.dialog>
  )
}
