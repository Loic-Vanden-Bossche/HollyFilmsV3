import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { localizeText } from '../i18n/messages.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import type { PlayerState } from '../playback/use-playback.ts'
import { Wordmark } from './Wordmark.tsx'
import { lockBodyScroll } from './body-scroll-lock.ts'
import '../player.css'

export function PlayerShell({
  title,
  continueOpening = false,
  state,
  onClose,
  onRetry,
  showHeading = true,
  onInteraction,
  onBackHover,
  problem,
  interrupted = false,
  actions,
  loading,
  alternativeRecovery,
  children,
}: {
  title: string
  continueOpening?: boolean
  state: PlayerState
  onClose: () => void
  onRetry: () => void
  showHeading?: boolean
  onInteraction?: () => void
  onBackHover?: (hovered: boolean) => void
  problem?: string
  interrupted?: boolean
  actions?: ReactNode
  loading?: ReactNode
  alternativeRecovery?: ReactNode
  children?: ReactNode
}) {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const element = dialog.current!
    const unlockScroll = lockBodyScroll()
    element.showModal()
    return () => {
      element.close()
      unlockScroll()
    }
  }, [])
  return (
    <motion.dialog
      ref={dialog}
      className="player-shell"
      aria-label={t('Lecteur · {title}', { title: title })}
      initial={continueOpening ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0.12 : 0.45, ease: [0.16, 1, 0.3, 1] }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div
        className="player-viewport"
        data-state={state}
        onPointerMove={onInteraction}
        onFocus={onInteraction}
      >
        <motion.div
          className="player-heading"
          initial={false}
          animate={{
            opacity: showHeading ? 1 : 0,
            y: reduced || showHeading ? 0 : -14,
          }}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 36,
            opacity: { duration: reduced ? 0 : 0.16 },
          }}
          data-visible={showHeading}
          aria-hidden={!showHeading}
          inert={!showHeading}
        >
          <div
            className="player-heading-actions"
            onPointerEnter={() => onBackHover?.(true)}
            onPointerLeave={() => onBackHover?.(false)}
          >
            <Tooltip>
              <motion.button
                initial={{ opacity: 0, y: reduced ? 0 : -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduced ? 0 : 0.45,
                  delay: reduced ? 0 : 0.08,
                }}
                whileHover={reduced ? undefined : { x: -2 }}
                whileTap={reduced ? undefined : { scale: 0.94 }}
                type="button"
                className="player-back"
                aria-label={t('Retour au catalogue')}
                onClick={onClose}
                onHoverStart={() => onBackHover?.(true)}
                onHoverEnd={() => onBackHover?.(false)}
              >
                <ArrowLeft size={20} aria-hidden="true" />
                <span>{t('Retour')}</span>
              </motion.button>
            </Tooltip>
            {actions}
          </div>
          <motion.div
            className="player-title-block"
            initial={
              continueOpening ? false : { opacity: 0, y: reduced ? 0 : 18 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0 : 0.65,
              delay: reduced ? 0 : 0.16,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.p
                key={title}
                className="player-title"
                initial={{ opacity: 0, y: reduced ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -4 }}
                transition={{ duration: reduced ? 0 : 0.16 }}
              >
                {title}
              </motion.p>
            </AnimatePresence>
            {loading}
          </motion.div>
          <motion.div
            className="player-brand"
            initial={{ opacity: 0, y: reduced ? 0 : -10 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{
              duration: reduced ? 0 : 0.55,
              delay: reduced ? 0 : 0.12,
            }}
          >
            <Wordmark compact />
          </motion.div>
        </motion.div>
        {children}
        {state === 'error' && (
          <motion.div
            className="player-status"
            role="alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            <div className="player-status-glow" aria-hidden="true" />
            <h2>
              {t(
                interrupted
                  ? 'Lecture interrompue'
                  : 'La lecture n’a pas pu démarrer',
              )}
            </h2>
            <p>
              {problem
                ? localizeText(
                    t,
                    problem,
                    'Vérifiez votre connexion et la disponibilité de ce titre.',
                  )
                : t(
                    'Vérifiez votre connexion et la disponibilité de ce titre.',
                  )}
            </p>
            <button type="button" className="home-primary" onClick={onRetry}>
              <RotateCcw size={18} /> {t('Réessayer')}
            </button>
            {alternativeRecovery}
          </motion.div>
        )}
      </div>
    </motion.dialog>
  )
}
