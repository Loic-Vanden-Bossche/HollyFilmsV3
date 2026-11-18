import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { motion, useIsPresent } from 'motion/react'
import {
  AudioLines,
  Captions,
  ChartNoAxesColumn,
  Clapperboard,
  ListMusic,
  ListVideo,
  MonitorPlay,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react'
import { duration, ease } from '../motion/tokens.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import '../player.css'

const menus = {
  settings: [SlidersHorizontal, 'Lecture'],
  subtitles: [Captions, 'Sous-titres'],
  queue: [ListMusic, 'File de lecture'],
  stats: [ChartNoAxesColumn, 'Statistiques'],
  chapters: [ListVideo, 'Chapitres'],
  trailers: [Clapperboard, 'Bandes-annonces'],
  sync: [Users, 'SyncPlay'],
  devices: [MonitorPlay, 'Diffusion'],
  lyrics: [AudioLines, 'Paroles'],
} as const

export type PlayerMenu = keyof typeof menus

export function PlayerSettingsPanel({
  menu,
  onClose,
  anchor,
  children,
}: {
  menu: PlayerMenu
  anchor?: HTMLElement | null
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const present = useIsPresent()
  const [Icon, title] = menus[menu]
  const panel = useRef<HTMLElement>(null)
  // Only measure when opening or when the viewport/trigger changes size.
  // The panel stays mounted when navigating between its pages.
  const fromHeading = Boolean(anchor?.closest('.player-heading-actions'))
  useLayoutEffect(() => {
    if (present) panel.current?.focus({ preventScroll: true })
  }, [menu, present])
  useLayoutEffect(() => {
    const surface = panel.current
    const viewport = surface?.offsetParent
    if (!surface || !(viewport instanceof HTMLElement) || !anchor) return
    const place = () => {
      if (!anchor.isConnected) return
      const origin = anchor.getBoundingClientRect()
      const bounds = viewport.getBoundingClientRect()
      const midpoint = origin.left + origin.width / 2 - bounds.left
      const width = surface.offsetWidth
      const left = Math.max(
        16,
        Math.min(midpoint - width * 0.78, bounds.width - width - 16),
      )
      surface.style.setProperty('--menu-left', `${left}px`)
      surface.style.setProperty('--menu-origin-x', `${midpoint - left}px`)
      surface.style.setProperty(
        '--menu-anchor-top',
        `${origin.bottom - bounds.top + 8}px`,
      )
      const dock = anchor.closest('.player-controls')
      if (dock)
        surface.style.setProperty(
          '--menu-anchor-bottom',
          `${bounds.bottom - dock.getBoundingClientRect().top + 8}px`,
        )
    }
    place()
    const resize = new ResizeObserver(place)
    resize.observe(viewport)
    resize.observe(anchor)
    return () => resize.disconnect()
  }, [anchor])
  return (
    <motion.section
      ref={panel}
      tabIndex={-1}
      inert={!present}
      aria-hidden={!present}
      className="player-menu glass-panel"
      data-origin={fromHeading ? 'header' : 'controls'}
      data-anchored={Boolean(anchor)}
      data-motion={reduced ? 'reduced' : 'full'}
      aria-label={t('Options du lecteur')}
      initial={{
        opacity: 0,
        y: reduced ? 0 : fromHeading ? -8 : 10,
        scale: reduced ? 1 : 0.975,
      }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: reduced ? 0 : fromHeading ? -5 : 6,
        scale: reduced ? 1 : 0.985,
        transition: { duration: reduced ? 0 : duration.press, ease: ease.in },
      }}
      transition={{
        duration: reduced ? 0 : duration.panel,
        ease: ease.out,
      }}
      onKeyDown={(event) => {
        // Let a portaled picker or confirmation handle its own Escape.
        if (!event.currentTarget.contains(event.target as Node)) return
        event.stopPropagation()
        if (
          event.key === 'Escape' &&
          !event.defaultPrevented &&
          !event.currentTarget
            .closest('dialog')
            ?.querySelector('.holly-select-popup[data-open]')
        ) {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <header>
        <motion.span
          key={menu}
          className="player-settings-symbol"
          aria-hidden="true"
          initial={reduced ? false : { scale: 0.86, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            duration: reduced ? 0 : duration.micro,
            ease: ease.out,
          }}
        >
          <Icon />
        </motion.span>
        <h2>{title === 'SyncPlay' ? title : t(title)}</h2>
        <Tooltip>
          <button
            className="player-icon player-menu-close"
            type="button"
            aria-label={t('Fermer les options')}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </Tooltip>
      </header>
      <motion.div
        key={menu}
        className="player-settings-body"
        initial={reduced ? false : { opacity: 0.6, x: 6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduced ? 0 : duration.micro, ease: ease.out }}
      >
        {children}
      </motion.div>
    </motion.section>
  )
}
