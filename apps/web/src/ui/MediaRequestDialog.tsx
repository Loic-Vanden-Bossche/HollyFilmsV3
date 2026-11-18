import { useId, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  Check,
  Film,
  LoaderCircle,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react'
import type {
  DiscoveryTitle,
  MediaRequestItem,
} from '@hollyfilms/shared/requests'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useModalPresence } from './use-modal-presence.ts'
import { duration, ease, scale, spring } from '../motion/tokens.ts'
import '../requests.css'

const fallbackFocus = (opener: HTMLElement) =>
  opener
    .closest('.discovery-results')
    ?.querySelector<HTMLElement>('.request-link') ?? null

export function MediaRequestDialog({
  title,
  administrator = false,
  pending = false,
  request,
  error,
  offerRequests = false,
  onConfirm,
  onClose,
}: {
  title: DiscoveryTitle
  administrator?: boolean
  pending?: boolean
  request?: MediaRequestItem
  error?: string
  offerRequests?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const id = useId()
  const { dialog, surface, present } = useModalPresence(fallbackFocus)
  const outside = useRef(false)
  const busy = pending && !request
  return (
    <motion.dialog
      ref={dialog}
      className="media-request-dialog"
      inert={!present}
      data-exiting={!present || undefined}
      aria-labelledby={id + '-heading'}
      aria-describedby={id + '-description'}
      aria-busy={busy}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? duration.press : duration.micro }}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
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
        ref={surface}
        className="media-request-surface"
        initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduced ? 0 : 6, scale: reduced ? 1 : 0.98 }}
        transition={{
          duration: reduced ? duration.press : duration.panel,
          ease: ease.out,
        }}
      >
        <button
          className="glass-control media-request-close"
          type="button"
          aria-label={t('Fermer')}
          onClick={onClose}
          disabled={busy}
        >
          <X size={18} />
        </button>
        <motion.div
          className="media-request-film"
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? duration.press : duration.panel,
            delay: reduced ? 0 : duration.stagger,
            ease: ease.out,
          }}
        >
          <div className="media-request-poster">
            <Film aria-hidden="true" />
            {title.poster && (
              <img
                src={title.poster}
                alt=""
                decoding="async"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            )}
          </div>
          <div>
            <p className="home-section-kicker">{t('DEMANDE DE MÉDIA')}</p>
            <h2>{title.title}</h2>
            <p>
              {t(title.type === 'movie' ? 'Film' : 'Série')}
              {title.year ? ` · ${title.year}` : ''}
            </p>
          </div>
        </motion.div>
        <motion.div
          key={request ? 'success' : 'confirm'}
          className="media-request-content"
          initial={{ opacity: 0, y: reduced ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? duration.press : duration.micro,
            ease: ease.out,
          }}
        >
          {request ? (
            <>
              <div className="media-request-receipt" role="status">
                <motion.span
                  className="media-request-seal"
                  aria-hidden="true"
                  initial={reduced ? false : { scale: 0.7, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={spring.control}
                >
                  <Check size={26} />
                </motion.span>
                <h3 id={id + '-heading'}>{t('Demande enregistrée')}</h3>
                <p id={id + '-description'}>
                  {request.status === 1
                    ? t('Demande envoyée. Elle attend une approbation.')
                    : [2, 5].includes(request.status)
                      ? t('Demande approuvée automatiquement.')
                      : t(
                          'Demande déjà enregistrée. Consultez son statut dans Mes demandes.',
                        )}
                </p>
              </div>
              {offerRequests && (
                <p className="media-request-follow-up">
                  {t(
                    'Retrouvez son avancement dans Mes demandes. Souhaitez-vous y aller ?',
                  )}
                </p>
              )}
              <div className="media-request-actions">
                {offerRequests && (
                  <a
                    autoFocus
                    href="/requests"
                    className="home-primary bg-brand-gradient text-primary-foreground"
                  >
                    {t('Voir mes demandes')}
                    <ArrowRight size={17} />
                  </a>
                )}
                <button
                  autoFocus={!offerRequests}
                  type="button"
                  className="glass-control"
                  onClick={onClose}
                >
                  {t('Continuer à explorer')}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 id={id + '-heading'}>
                {t(
                  title.type === 'tv'
                    ? 'Demander toutes les saisons disponibles ?'
                    : 'Ajouter ce film aux demandes ?',
                )}
              </h3>
              <p id={id + '-description'} className="media-request-policy">
                <ShieldCheck size={18} aria-hidden="true" />
                {administrator
                  ? t(
                      'Les demandes administrateur sont approuvées automatiquement.',
                    )
                  : t('Une approbation administrateur sera nécessaire.')}
              </p>
              <AnimatePresence initial={false}>
                {error && (
                  <motion.p
                    key="error"
                    role="alert"
                    className="request-error"
                    initial={{ opacity: 0, y: reduced ? 0 : -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="media-request-actions">
                <motion.button
                  type="button"
                  className="home-primary bg-brand-gradient text-primary-foreground"
                  whileTap={reduced ? undefined : { scale: scale.pressed }}
                  disabled={busy}
                  onClick={onConfirm}
                >
                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: busy && !reduced ? 360 : 0 }}
                    transition={
                      busy && !reduced
                        ? { duration: 1.2, repeat: Infinity, ease: 'linear' }
                        : { duration: 0.15 }
                    }
                  >
                    {busy ? <LoaderCircle size={17} /> : <Send size={17} />}
                  </motion.span>
                  {busy ? t('Envoi…') : t('Confirmer')}
                </motion.button>
                <button
                  autoFocus
                  type="button"
                  className="glass-control"
                  disabled={busy}
                  onClick={onClose}
                >
                  {t('Annuler')}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.section>
    </motion.dialog>
  )
}
