import { useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Captions, Download, Send, X } from 'lucide-react'
import type { SubtitleRequestStatus } from '@hollyfilms/shared/subtitles'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { subtitleStatuses } from '../subtitle-status.ts'
import { lockBodyScroll } from './body-scroll-lock.ts'
import { languageFlag } from './language-flags.ts'
import { SubtitleFeedback } from './SubtitleFeedback.tsx'
import '../requests.css'

export function SubtitleActionDialog({
  action,
  version,
  language,
  languageLabel,
  fileName,
  approval = false,
  pending = false,
  result,
  error,
  onConfirm,
  onClose,
}: {
  action: 'request' | 'download' | 'reject'
  version: string
  language: string
  languageLabel: string
  fileName?: string
  approval?: boolean
  pending?: boolean
  result?: SubtitleRequestStatus
  error?: string
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const previous = useRef(document.activeElement as HTMLElement | null)
  const outside = useRef(false)
  const busy = pending && !result
  useEffect(() => {
    const element = dialog.current!
    const target = previous.current
    const fallback = target?.closest('.subtitle-panel, .subtitle-requests')
    const unlock = lockBodyScroll()
    element.showModal()
    return () => {
      element.close()
      unlock()
      if (target?.isConnected && !target.matches(':disabled'))
        target.focus({ preventScroll: true })
      else
        fallback
          ?.querySelector<HTMLElement>(
            '.subtitle-history, .subtitle-action:not(:disabled), .request-link',
          )
          ?.focus({ preventScroll: true })
    }
  }, [])
  const flag = languageFlag(language)
  const confirmLabel =
    action === 'request'
      ? t('Confirmer la demande')
      : action === 'reject'
        ? t('Confirmer le refus')
        : approval
          ? t('Confirmer l’approbation et télécharger')
          : t('Confirmer le téléchargement')
  return (
    <motion.dialog
      ref={dialog}
      className="media-request-dialog subtitle-action-dialog"
      aria-labelledby={`${id}-action ${id}`}
      aria-describedby={`${id}-version ${id}-phase`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.1 : 0.2 }}
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!busy) onClose()
      }}
      onKeyDown={(event) => {
        // Arrow/space shortcuts belong to this dialog, never to the video underneath.
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          if (!busy) onClose()
        }
      }}
      onPointerDownCapture={(event) => {
        outside.current = event.target === event.currentTarget
      }}
      onPointerCancel={() => {
        outside.current = false
      }}
      onClick={(event) => {
        if (outside.current && event.target === event.currentTarget && !busy)
          onClose()
        outside.current = false
      }}
    >
      <motion.section
        className="media-request-surface subtitle-action-surface"
        layout={reduced ? false : 'size'}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduced ? 0 : 10 }}
        transition={{ duration: reduced ? 0.1 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          type="button"
          className="glass-control media-request-close"
          aria-label={t('Fermer la confirmation')}
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <div className="subtitle-dialog-header">
          <span>
            <Captions size={25} />
          </span>
          <div>
            <p id={id + '-action'}>{t('Sous-titres externes')}</p>
            <h2 id={id}>{languageLabel}</h2>
          </div>
          {flag && <img src={flag} alt="" width={32} height={24} />}
        </div>
        <div className="subtitle-dialog-version" id={id + '-version'}>
          <span>{t('Version du média')}</span>
          <strong>{version}</strong>
          {fileName && <p>{fileName}</p>}
        </div>
        <div className="subtitle-action-phase" id={id + '-phase'}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={result ? 'result' : busy ? 'pending' : 'confirm'}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {result ? (
                <SubtitleFeedback
                  tone={
                    result === 'DOWNLOADING'
                      ? 'loading'
                      : result === 'DOWNLOADED'
                        ? 'success'
                        : result === 'FAILED'
                          ? 'error'
                          : 'neutral'
                  }
                  title={t(subtitleStatuses[result])}
                  description={
                    result === 'DOWNLOADING'
                      ? t(
                          'Le téléchargement est envoyé. Vérification de son apparition dans la bibliothèque…',
                        )
                      : result === 'PENDING'
                        ? t(
                            'Un administrateur choisira et téléchargera le sous-titre demandé.',
                          )
                        : result === 'DOWNLOADED'
                          ? t(
                              'Le sous-titre est disponible dans cette version du média.',
                            )
                          : undefined
                  }
                />
              ) : busy ? (
                <SubtitleFeedback
                  title={
                    action === 'download'
                      ? t('Téléchargement…')
                      : action === 'request'
                        ? t('Envoi…')
                        : t('Traitement en cours…')
                  }
                  description={
                    action === 'download'
                      ? t(
                          'Installation puis vérification de la piste dans votre bibliothèque.',
                        )
                      : undefined
                  }
                />
              ) : (
                <p className="subtitle-dialog-question">
                  {action === 'request'
                    ? t('Demander des sous-titres dans cette langue ?')
                    : action === 'reject'
                      ? t('Refuser cette demande ?')
                      : t('Installer ce sous-titre pour cette version ?')}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {error && <SubtitleFeedback key="error" title={error} tone="error" />}
        </AnimatePresence>
        <div className="media-request-actions">
          {result ? (
            <button
              type="button"
              autoFocus
              className="glass-control"
              onClick={onClose}
            >
              {t('Fermer')}
            </button>
          ) : (
            <>
              <motion.button
                type="button"
                className={
                  action === 'reject'
                    ? 'glass-control request-reject'
                    : 'home-primary bg-brand-gradient text-primary-foreground'
                }
                disabled={busy}
                onClick={onConfirm}
                whileTap={reduced ? undefined : { scale: 0.98 }}
              >
                {action === 'download' ? (
                  <Download size={16} />
                ) : action === 'request' ? (
                  <Send size={16} />
                ) : (
                  <X size={16} />
                )}
                {confirmLabel}
              </motion.button>
              <button
                type="button"
                autoFocus
                className="glass-control"
                disabled={busy}
                onClick={onClose}
              >
                {t('Annuler')}
              </button>
            </>
          )}
        </div>
      </motion.section>
    </motion.dialog>
  )
}
