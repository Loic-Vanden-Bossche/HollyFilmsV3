import { useI18n } from '../../i18n/I18nProvider.tsx'
import { Tooltip } from '../../ui/Tooltip.tsx'
// React Bits Staggered Menu + Flowing Menu adapted to native dialog, Motion and authenticated artwork.
import { createContext, useContext, useEffect, useRef } from 'react'
import { motion, useAnimate } from 'motion/react'
import { ArrowUpRight, X } from 'lucide-react'
import type { LibraryFilter, MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { MediaArtwork } from '../../ui/MediaArtwork.tsx'
import { Wordmark } from '../../ui/Wordmark.tsx'
import { lockBodyScroll } from '../../ui/body-scroll-lock.ts'
import { cinemaMotion, useMotionPolicy } from './policy.ts'
import './effects.css'

const CloseMenu = createContext<() => Promise<void>>(async () => {})

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
            onClick={async () => {
              await closeMenu()
              onSelect(value)
            }}
            initial={{ opacity: 0, y: reduced ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0 : 0.4,
              delay: reduced ? 0 : 0.12 + index * 0.07,
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
  const [scope, animate] = useAnimate<HTMLDialogElement>()
  const closing = useRef(false),
    backdrop = useRef(false)
  const { reduced } = useMotionPolicy()
  useEffect(() => {
    const dialog = scope.current
    const trigger = document.activeElement as HTMLElement | null
    const unlockScroll = lockBodyScroll()
    dialog.showModal()
    const controls = animate(
      '.rb-menu-panel',
      {
        opacity: [0, 1],
        clipPath: [
          'inset(0 0 100% 0 round 28px)',
          'inset(0 0 0% 0 round 28px)',
        ],
      },
      { duration: reduced ? 0 : 0.45, ease: cinemaMotion.ease },
    )
    return () => {
      controls.stop()
      dialog.close()
      unlockScroll()
      trigger?.focus({ preventScroll: true })
    }
  }, [scope, animate, reduced])
  async function close() {
    if (closing.current) return
    closing.current = true
    await animate(
      '.rb-menu-panel',
      { opacity: 0, y: reduced ? 0 : -15 },
      { duration: reduced ? 0 : 0.18 },
    )
    onClose()
  }
  return (
    <dialog
      ref={scope}
      className="rb-staggered-menu"
      aria-label={t('Navigation HollyFilms')}
      onCancel={(e) => {
        e.preventDefault()
        void close()
      }}
      onPointerDown={(e) => {
        backdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (backdrop.current && e.target === e.currentTarget) void close()
        backdrop.current = false
      }}
    >
      <div className="rb-menu-panel">
        <div className="rb-menu-curtains" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.i
              key={i}
              initial={{ scaleY: 1 }}
              animate={{ scaleY: 0 }}
              transition={{
                duration: reduced ? 0 : 0.6,
                delay: reduced ? 0 : i * 0.06,
                ease: cinemaMotion.ease,
              }}
            />
          ))}
        </div>
        <header>
          <Wordmark compact />
          <span>{t('EXPLORER / HOLLYFILMS 3.0')}</span>
          <Tooltip>
            <button
              type="button"
              aria-label={t('Fermer la navigation')}
              onClick={() => void close()}
            >
              <X size={24} />
            </button>
          </Tooltip>
        </header>
        <CloseMenu value={close}>{children}</CloseMenu>
        <footer>
          <span>{t('VOTRE BIBLIOTHÈQUE, EN GRAND.')}</span>
          <span>{t('Films · Séries · Reprise de lecture')}</span>
        </footer>
      </div>
    </dialog>
  )
}
