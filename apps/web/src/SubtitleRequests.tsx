import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type {
  SubtitleRequest,
  SubtitleRequestPage,
  SubtitleRequestStatus,
} from '@hollyfilms/shared/subtitles'
import { Captions, RotateCcw, ArrowUpRight } from 'lucide-react'
import { getSubtitleRequests, rejectSubtitleRequest } from './subtitles-api.ts'
import { SubtitlePanel } from './ui/SubtitlePanel.tsx'
import { subtitleStatuses } from './subtitle-status.ts'
import { Select } from './ui/Select.tsx'
import { useI18n } from './i18n/I18nProvider.tsx'
import { apiMessage, localizeError } from './i18n/api-messages.ts'
import { usePerformanceReducedMotion } from './performance/PerformanceProvider.tsx'
import {
  SubtitleFeedback,
  SubtitleStatusBadge,
} from './ui/SubtitleFeedback.tsx'
import { SubtitleActionDialog } from './ui/SubtitleActionDialog.tsx'
import { languageFlag } from './ui/language-flags.ts'
import { useMotionPolicy } from './components/reactbits/policy.ts'

export function SubtitleRequests({
  session,
  administrator = false,
}: {
  session: JellyfinSession
  administrator?: boolean
}) {
  const { t, locale } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const { pageVisible } = useMotionPolicy()
  const cache = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<SubtitleRequestStatus | ''>('')
  const [reviewing, setReviewing] = useState<string>()
  const [rejecting, setRejecting] = useState<SubtitleRequest>()
  const submitting = useRef(false)
  const data = useQuery({
    queryKey: ['subtitle-requests', session, administrator, page, status],
    queryFn: ({ signal }) =>
      getSubtitleRequests(
        session,
        administrator,
        page,
        status || undefined,
        signal,
      ),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.items.some((row) => row.status === 'DOWNLOADING')
        ? 2000
        : 10000,
    refetchIntervalInBackground: false,
  })
  const reject = useMutation({
    mutationFn: (id: string) => rejectSubtitleRequest(session, id),
    onSuccess: (_response, id) => {
      cache.setQueriesData<SubtitleRequestPage>(
        { queryKey: ['subtitle-requests', session] },
        (previous) =>
          previous && {
            ...previous,
            items: previous.items.map((row) =>
              row.id === id ? { ...row, status: 'REJECTED' } : row,
            ),
          },
      )
      void Promise.all([
        cache.invalidateQueries({ queryKey: ['subtitle-requests'] }),
        cache.invalidateQueries({ queryKey: ['subtitle-library'] }),
      ])
    },
  })
  const confirmRejection = async () => {
    if (!rejecting || submitting.current) return
    submitting.current = true
    try {
      await reject.mutateAsync(rejecting.id)
    } catch {
      /* Keep the dialog open for retry. */
    } finally {
      submitting.current = false
    }
  }
  const names = new Intl.DisplayNames([locale], { type: 'language' })
  return (
    <section
      className="subtitle-requests"
      aria-label={t('Demandes de sous-titres')}
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="home-section-kicker">{t('SOUS-TITRES À LA DEMANDE')}</p>
        <h1>{t('Demandes de sous-titres')}</h1>
        <p className="requests-intro">
          {administrator
            ? t('Choisissez la bonne version et approuvez son téléchargement.')
            : t(
                'Suivez l’ajout des langues demandées à vos films et épisodes.',
              )}
        </p>
      </motion.div>
      <div className="requests-toolbar">
        <label>
          {t('État des demandes')}
          <Select
            aria-label={t('État des demandes')}
            value={status}
            onValueChange={(value) => {
              if (!value || Object.hasOwn(subtitleStatuses, value)) {
                setStatus(value as SubtitleRequestStatus | '')
                setPage(1)
              }
            }}
          >
            <option value="">{t('Toutes')}</option>
            {Object.entries(subtitleStatuses).map(([key, text]) => (
              <option key={key} value={key}>
                {t(text)}
              </option>
            ))}
          </Select>
        </label>
        <button
          className="glass-control subtitle-action"
          disabled={data.isFetching}
          onClick={() => void data.refetch()}
        >
          <motion.span
            aria-hidden="true"
            animate={{
              rotate: data.isFetching && !reduced && pageVisible ? 360 : 0,
            }}
            transition={
              data.isFetching && !reduced && pageVisible
                ? { duration: 1.3, repeat: Infinity, ease: 'linear' }
                : { duration: 0 }
            }
          >
            <RotateCcw size={15} />
          </motion.span>
          {t('Actualiser')}
        </button>
      </div>
      {data.isError && data.data && (
        <SubtitleFeedback
          tone="error"
          title={localizeError(
            t,
            data.error,
            'Impossible de charger les demandes.',
          )}
        />
      )}
      {data.isPending ? (
        <SubtitleFeedback title={t('Chargement des demandes…')} skeleton />
      ) : !data.data ? (
        <div className="subtitle-recovery">
          <SubtitleFeedback
            tone="error"
            title={localizeError(
              t,
              data.error,
              'Impossible de charger les demandes.',
            )}
          />
          <button
            className="glass-control subtitle-action"
            onClick={() => void data.refetch()}
          >
            {t('Réessayer')}
          </button>
        </div>
      ) : !data.data.items.length ? (
        <div className="request-empty">
          <span className="subtitle-empty-symbol">
            <Captions size={32} />
          </span>
          <h2>{t('Aucune demande de sous-titres pour le moment.')}</h2>
          <p>
            {t(
              'Ouvrez un film ou les sous-titres du lecteur pour demander une langue.',
            )}
          </p>
          <a className="request-link" href="/app">
            {t('Retour au catalogue')}
            <ArrowUpRight size={15} />
          </a>
        </div>
      ) : (
        <div className="requests-list">
          <AnimatePresence initial={false} mode="popLayout">
            {data.data.items.map((row, index) => (
              <motion.article
                layout={reduced ? false : 'position'}
                key={row.id}
                className="request-row glass-panel"
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                transition={{
                  duration: reduced ? 0.1 : 0.28,
                  delay: reduced ? 0 : Math.min(index * 0.035, 0.18),
                }}
              >
                <div className="request-body">
                  <div className="request-heading">
                    <div>
                      <p className="subtitle-request-context">
                        {languageFlag(row.language) && (
                          <img
                            src={languageFlag(row.language)}
                            alt=""
                            className="holly-select-flag"
                          />
                        )}
                        {names.of(row.language) || row.language} ·{' '}
                        {row.sourceName}
                      </p>
                      <h2>{row.itemName}</h2>
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                      <SubtitleStatusBadge
                        key={row.status}
                        status={row.status}
                      />
                    </AnimatePresence>
                  </div>
                  <p className="request-date">
                    {t('Demandé le {date}', {
                      date: new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(row.createdAt)),
                    })}
                    {administrator && row.requester
                      ? ` · ${t('Demandé par')} ${row.requester}`
                      : ''}
                    {row.decidedBy
                      ? ` · ${t('Traité par')} ${row.decidedBy}`
                      : ''}
                  </p>
                  {row.lastError && (
                    <p role="alert" className="request-error">
                      {t(
                        apiMessage(row.lastError) ??
                          'Impossible de traiter les sous-titres.',
                      )}
                    </p>
                  )}
                  <div className="request-actions">
                    <a
                      className="request-link"
                      href={`/app?media=${encodeURIComponent(row.itemId)}`}
                    >
                      {t('Voir la fiche')}
                    </a>
                    {administrator &&
                      ['PENDING', 'FAILED'].includes(row.status) && (
                        <>
                          <button
                            className="glass-control"
                            aria-expanded={reviewing === row.id}
                            aria-controls={'subtitle-review-' + row.id}
                            onClick={() =>
                              setReviewing(
                                reviewing === row.id ? undefined : row.id,
                              )
                            }
                          >
                            {reviewing === row.id
                              ? t('Fermer')
                              : t('Rechercher et approuver')}
                          </button>
                          <button
                            className="glass-control request-reject"
                            disabled={reject.isPending}
                            onClick={() => {
                              reject.reset()
                              setRejecting(row)
                            }}
                          >
                            {t('Refuser')}
                          </button>
                        </>
                      )}
                  </div>
                  <AnimatePresence initial={false}>
                    {reviewing === row.id && (
                      <motion.div
                        id={'subtitle-review-' + row.id}
                        initial={{ opacity: 0, height: reduced ? 'auto' : 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: reduced ? 'auto' : 0 }}
                        transition={{ duration: reduced ? 0.1 : 0.25 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="subtitle-review glass-panel">
                          <SubtitlePanel
                            session={session}
                            itemId={row.itemId}
                            sourceId={row.sourceId}
                            language={row.language}
                            requestId={row.id}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
      <AnimatePresence>
        {rejecting && (
          <SubtitleActionDialog
            action="reject"
            version={rejecting.itemName + ' · ' + rejecting.sourceName}
            language={rejecting.language}
            languageLabel={names.of(rejecting.language) || rejecting.language}
            pending={reject.isPending}
            result={reject.isSuccess ? 'REJECTED' : undefined}
            error={
              reject.isError
                ? localizeError(
                    t,
                    reject.error,
                    'Impossible de traiter les sous-titres.',
                  )
                : undefined
            }
            onConfirm={() => void confirmRejection()}
            onClose={() => setRejecting(undefined)}
          />
        )}
      </AnimatePresence>
      {data.data && data.data.pages > 1 && (
        <nav className="request-pagination" aria-label={t('Pagination')}>
          <button
            className="glass-control"
            disabled={page <= 1 || data.isFetching}
            onClick={() => setPage(page - 1)}
          >
            {t('Précédent')}
          </button>
          <span>
            {page} / {data.data.pages}
          </span>
          <button
            className="glass-control"
            disabled={page >= data.data.pages || data.isFetching}
            onClick={() => setPage(page + 1)}
          >
            {t('Suivant')}
          </button>
        </nav>
      )}
    </section>
  )
}
