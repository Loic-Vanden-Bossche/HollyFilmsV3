import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import type { PlayerState } from '../playback/use-playback.ts'
import { Wordmark } from './Wordmark.tsx'
import '../player.css'

export function PlayerShell({
  title,
  state,
  onClose,
  onRetry,
  showHeading = true,
  onInteraction,
  onBackHover,
  problem,
  children,
}: {
  title: string
  state: PlayerState
  onClose: () => void
  onRetry: () => void
  showHeading?: boolean
  onInteraction?: () => void
  onBackHover?: (hovered: boolean) => void
  problem?: string
  children?: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const element = dialog.current!
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.close()
      document.body.style.overflow = overflow
    }
  }, [])
  return (
    <motion.dialog
      ref={dialog}
      className="player-shell"
      aria-label={`Lecteur · ${title}`}
      initial={{ opacity: 0 }}
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
            aria-label="Retour au catalogue"
            onClick={onClose}
            onHoverStart={() => onBackHover?.(true)}
            onHoverEnd={() => onBackHover?.(false)}
          >
            <ArrowLeft size={20} aria-hidden="true" />
            <span>Retour</span>
          </motion.button>
          <motion.div
            className="player-title-block"
            initial={{ opacity: 0, y: reduced ? 0 : 18 }}
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
            <h2>La lecture n’a pas pu démarrer</h2>
            <p>
              {problem ||
                'Vérifiez votre connexion et la disponibilité de ce titre.'}
            </p>
            <button type="button" className="home-primary" onClick={onRetry}>
              <RotateCcw size={18} /> Réessayer
            </button>
          </motion.div>
        )}
      </div>
    </motion.dialog>
  )
}
