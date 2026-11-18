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
import { AnimatedList } from '../components/reactbits/Effects.tsx'
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
  children,
}: {
  menu: PlayerMenu
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const present = useIsPresent()
  const [Icon, title] = menus[menu]
  const panel = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (document.activeElement?.matches(':focus-visible'))
      panel.current?.focus({ preventScroll: true })
  }, [])
  return (
    <motion.section
      ref={panel}
      tabIndex={-1}
      inert={!present}
      className="player-menu glass-panel"
      data-motion={reduced ? 'reduced' : 'full'}
      aria-label={t('Options du lecteur')}
      initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: reduced ? 0 : 8,
        transition: { duration: reduced ? 0 : 0.1 },
      }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 36,
        opacity: { duration: reduced ? 0 : 0.14 },
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
          className="player-settings-symbol"
          aria-hidden="true"
          initial={reduced ? false : { scale: 0.86, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.2 }}
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
      <AnimatedList className="player-settings-body">{children}</AnimatedList>
    </motion.section>
  )
}
