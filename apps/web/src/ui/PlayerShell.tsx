import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { duration, ease } from '../motion/tokens.ts'
import { localizeText } from '../i18n/messages.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import {
  useLayoutEffect,
  useContext,
  useRef,
  type KeyboardEventHandler,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import type { PlayerState } from '../playback/use-playback.ts'
import { Wordmark } from './Wordmark.tsx'
import { lockBodyScroll } from './body-scroll-lock.ts'
import { ArtworkHeroContext } from './artwork-hero-context.ts'
import '../player.css'

export function PlayerShell({
  title,
  continueOpening = false,
  state,
  onClose,
  onRetry,
  showHeading = true,
  onInteraction,
  onKeyDown,
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
  onInteraction?: (intent: 'pointer' | 'keyboard' | 'focus') => void
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>
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
  const viewport = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const hero = useContext(ArtworkHeroContext)
  useLayoutEffect(() => {
    if (state === 'error') hero?.finishPlayerProjection()
    else if (interrupted || state === 'playing')
      hero?.finishPlayerProjection(true)
  }, [hero, state, interrupted])
  useLayoutEffect(() => {
    const element = dialog.current!
    const unlockScroll = lockBodyScroll()
    element.showModal()
    viewport.current?.focus({ preventScroll: true })
    return () => {
      element.close()
      unlockScroll()
    }
  }, [])

  useLayoutEffect(() => {
    // A focused control can disappear or become inert when playback resumes.
    const focused = document.activeElement
    if (
      focused === document.body ||
      (dialog.current?.contains(focused) && focused?.closest('[inert]'))
    )
      viewport.current?.focus({ preventScroll: true })
  })
  return (
    <dialog
      ref={dialog}
      className="player-shell"
      aria-label={t('Lecteur · {title}', { title: title })}
      onKeyDown={onKeyDown}
      data-motion={reduced ? 'reduced' : 'full'}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div
        ref={viewport}
        tabIndex={-1}
        className="player-viewport"
        data-state={state}
        data-has-frame={interrupted}
        onPointerMove={() => onInteraction?.('pointer')}
        onPointerDown={() => onInteraction?.('pointer')}
        onKeyDownCapture={() => onInteraction?.('keyboard')}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) onInteraction?.('focus')
        }}
      >
        <motion.div
          className="player-heading"
          initial={false}
          animate={{
            opacity: showHeading ? 1 : 0,
            y: reduced || showHeading ? 0 : -14,
          }}
          transition={{
            duration: reduced ? 0 : duration.micro,
            ease: ease.out,
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
                initial={reduced ? false : { opacity: 0.7, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduced ? 0 : duration.micro,
                  ease: ease.out,
                }}
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
              continueOpening ? false : { opacity: 0, y: reduced ? 0 : 10 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0 : duration.scene,
              ease: ease.out,
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
            initial={reduced ? false : { opacity: 0.7, y: -4 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{
              duration: reduced ? 0 : duration.panel,
              ease: ease.out,
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
    </dialog>
  )
}
