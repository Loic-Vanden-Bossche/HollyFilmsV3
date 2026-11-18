import { useId, useState, type ReactNode } from 'react'
import { Captions, ChevronDown } from 'lucide-react'
import { motion } from 'motion/react'
import { cinemaMotion } from '../components/reactbits/policy.ts'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useI18n } from '../i18n/I18nProvider.tsx'
import './player-subtitle-tools.css'

/** Defers external tools until needed, then retains in-flight work while folded. */
export function PlayerSubtitleTools({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [visited, setVisited] = useState(false)
  const transition = {
    duration: reduced ? 0 : cinemaMotion.interaction,
    ease: cinemaMotion.ease,
  }

  return (
    <div className="player-subtitle-tools" data-open={open}>
      <button
        type="button"
        className="player-subtitle-tools-trigger"
        id={`${id}-trigger`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setVisited(true)
          setOpen((value) => !value)
        }}
      >
        <span className="player-subtitle-tools-icon">
          <Captions size={19} aria-hidden="true" />
        </span>
        <span className="player-subtitle-tools-copy">
          <strong>{t('Sous-titres externes')}</strong>
          <span>{t('Rechercher ou demander des sous-titres')}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={transition}
        >
          <ChevronDown size={17} aria-hidden="true" />
        </motion.span>
      </button>
      <motion.div
        id={id}
        aria-labelledby={`${id}-trigger`}
        aria-hidden={!open}
        inert={!open}
        className="player-subtitle-tools-content"
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={transition}
      >
        {visited && (
          <div className="player-subtitle-tools-inner">{children}</div>
        )}
      </motion.div>
    </div>
  )
}
