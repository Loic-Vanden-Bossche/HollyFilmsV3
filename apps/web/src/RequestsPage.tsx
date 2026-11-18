import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, X, RotateCcw, Download, Clock3 } from 'lucide-react'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type {
  MediaRequestItem,
  RequestFilter,
} from '@hollyfilms/shared/requests'
import {
  getMediaRequests,
  getRequestOptions,
  decideMediaRequest,
  requestLanguage,
} from './requests-api.ts'
import { useI18n } from './i18n/I18nProvider.tsx'
import { localizeError } from './i18n/api-messages.ts'
import { usePerformanceReducedMotion } from './performance/PerformanceProvider.tsx'
import { Wordmark } from './ui/Wordmark.tsx'
import { duration, ease, spring } from './motion/tokens.ts'
import { RequestRow } from './ui/RequestRow.tsx'
import { Select } from './ui/Select.tsx'
import './requests.css'
import { SubtitleRequests } from './SubtitleRequests.tsx'

const filters = {
  all: 'Toutes',
  pending: 'En attente',
  approved: 'Approuvées',
  processing: 'En traitement',
  available: 'Disponibles',
  failed: 'En échec',
} as const
const statuses = {
  1: 'En attente',
  2: 'Approuvée',
  3: 'Refusée',
  4: 'Échec',
  5: 'Disponible',
} as const
const downloadStatuses = {
  downloading: 'Téléchargement en cours',
  paused: 'En pause',
  queued: 'En file d’attente',
  pending: 'À télécharger',
  importpending: 'Importation',
  completed: 'Téléchargement terminé',
  failed: 'Échec',
  warning: 'Attention requise',
} as const
function status(item: MediaRequestItem) {
  if (item.status === 3 || item.status === 4) return statuses[item.status]
  if (item.downloads.length) return 'Téléchargement en cours'
  if (item.title.mediaStatus === 5) return 'Disponible'
  if (item.title.mediaStatus === 4) return 'Partiellement disponible'
  return statuses[item.status as keyof typeof statuses] ?? 'État inconnu'
}
export function RequestsPage({
  session,
  administrator = false,
}: {
  session: JellyfinSession
  administrator?: boolean
}) {
  const { t, locale } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const indicator = useId()
  const cache = useQueryClient()
  const [section, setSection] = useState(() =>
    new URLSearchParams(location.search).get('section') === 'subtitles'
      ? 'subtitles'
      : 'media',
  )
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<RequestFilter>('all')
  const [rejecting, setRejecting] = useState<number>()
  const data = useQuery({
    queryKey: ['media-requests', session, administrator, page, filter, locale],
    queryFn: ({ signal }) =>
      getMediaRequests(
        session,
        administrator,
        page,
        filter,
        requestLanguage(locale),
        signal,
      ),
    retry: false,
    enabled: section === 'media',
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  })
  const options = useQuery({
    queryKey: ['request-options', session],
    queryFn: ({ signal }) => getRequestOptions(session, signal),
    staleTime: 30000,
    retry: false,
    enabled: section === 'media',
  })
  const decision = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: number
      action: 'approve' | 'decline' | 'retry'
    }) => decideMediaRequest(session, id, action),
    onSuccess: () => setRejecting(undefined),
    onSettled: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ['media-requests'] }),
        cache.invalidateQueries({ queryKey: ['request-search'] }),
        cache.invalidateQueries({ queryKey: ['request-options'] }),
      ]),
  })
  const date = (value: string) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime())
      ? '—'
      : new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(parsed)
  }
  const header = (
    <header className="requests-header">
      <a href="/app" aria-label={t('Retour au catalogue')}>
        <Wordmark compact />
      </a>
      <nav>
        <a className="glass-control request-link" href="/app">
          <ArrowLeft size={16} />
          {t('Catalogue')}
        </a>
        <a
          className="glass-control request-link"
          href={administrator ? '/requests' : '/profile'}
        >
          {administrator ? t('Mes demandes') : t('Profil')}
        </a>
        {!administrator && options.data?.seerrUrl && (
          <a className="glass-control request-link" href="/admin/requests">
            {t('Gérer les demandes de médias')}
          </a>
        )}
      </nav>
    </header>
  )
  const tabs = (
    <nav className="subtitle-tabs" aria-label={t('Type de demande')}>
      {(['media', 'subtitles'] as const).map((value) => (
        <button
          key={value}
          className="glass-control"
          aria-pressed={section === value}
          onClick={() => {
            setSection(value)
            const url = new URL(location.href)
            url.searchParams.set('section', value)
            history.replaceState(history.state, '', url.pathname + url.search)
          }}
        >
          {section === value && (
            <motion.span
              className="selection-light"
              aria-hidden="true"
              layoutId={reduced ? undefined : indicator}
              transition={spring.control}
            />
          )}
          {t(value === 'media' ? 'Médias' : 'Sous-titres')}
        </button>
      ))}
    </nav>
  )
  return (
    <main className="requests-page">
      {header}
      {tabs}
      {section === 'subtitles' ? (
        <SubtitleRequests session={session} administrator={administrator} />
      ) : (
        <>
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.scene, ease: ease.out }}
          >
            <p className="home-section-kicker">
              {administrator
                ? t('GESTION DU CATALOGUE')
                : t('VOTRE SÉLECTION À VENIR')}
            </p>
            <h1>
              {administrator ? t('Demandes de médias') : t('Mes demandes')}
            </h1>
            <p className="requests-intro">
              {administrator
                ? t('Approuvez les demandes et suivez leur acquisition.')
                : t(
                    'Suivez vos demandes, de l’approbation à la disponibilité.',
                  )}
            </p>
          </motion.div>
          {administrator && options.data && (
            <section
              className="request-admin-summary"
              aria-label={t('Services et statistiques')}
            >
              {Object.entries(options.data.counts ?? {})
                .filter(([key]) =>
                  [
                    'total',
                    'pending',
                    'approved',
                    'processing',
                    'available',
                    'declined',
                    'failed',
                  ].includes(key),
                )
                .map(([key, value]) => (
                  <div className="glass-panel" key={key}>
                    <span>
                      {t(
                        key === 'total'
                          ? 'Toutes'
                          : key === 'declined'
                            ? 'Refusées'
                            : filters[key as keyof typeof filters],
                      )}
                    </span>
                    <strong>{value}</strong>
                  </div>
                ))}
              <div className="glass-panel">
                <span>Radarr</span>
                <strong>
                  {options.data.services
                    ?.filter((service) => service.type === 'movie')
                    .map((service) => service.name)
                    .join(', ') || t('Non configuré')}
                </strong>
              </div>
              <div className="glass-panel">
                <span>Sonarr</span>
                <strong>
                  {options.data.services
                    ?.filter((service) => service.type === 'tv')
                    .map((service) => service.name)
                    .join(', ') || t('Non configuré')}
                </strong>
              </div>
              {options.data.seerrUrl && (
                <a
                  className="request-link"
                  href={options.data.seerrUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('Ouvrir Seerr')}
                </a>
              )}
            </section>
          )}
          <div className="requests-toolbar">
            <label>
              {t('État des demandes')}
              <Select
                aria-label={t('État des demandes')}
                value={filter}
                onValueChange={(value) => {
                  if (Object.hasOwn(filters, value)) {
                    setFilter(value as RequestFilter)
                    setPage(1)
                  }
                }}
              >
                {Object.entries(filters).map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </Select>
            </label>
            <button
              className="glass-control request-link"
              onClick={() => {
                void data.refetch()
                void options.refetch()
              }}
              disabled={data.isFetching}
            >
              <RotateCcw size={16} />
              {t('Actualiser')}
            </button>
          </div>
          {options.isError && (
            <p role="alert" className="request-error">
              {localizeError(
                t,
                options.error,
                'Impossible de charger les services.',
              )}
            </p>
          )}
          {decision.isError && (
            <p role="alert" className="request-error">
              {localizeError(
                t,
                decision.error,
                'Impossible de traiter cette demande.',
              )}
            </p>
          )}
          {!!data.data?.serviceErrors.length && (
            <p role="alert" className="request-error">
              {t('Services indisponibles : {names}', {
                names: data.data.serviceErrors.join(', '),
              })}
            </p>
          )}
          {data.isPending ? (
            <p role="status" className="surface-placeholder">
              {t('Chargement des demandes…')}
            </p>
          ) : data.isError ? (
            <div role="alert" className="request-empty">
              <p>
                {localizeError(
                  t,
                  data.error,
                  'Impossible de charger les demandes.',
                )}
              </p>
              <button
                className="glass-control"
                onClick={() => void data.refetch()}
              >
                {t('Réessayer')}
              </button>
            </div>
          ) : !data.data?.items.length ? (
            <div className="request-empty">
              <Clock3 size={32} />
              <h2>{t('Aucune demande pour le moment.')}</h2>
              <a href="/app" className="request-link">
                {t('Rechercher un titre dans le catalogue')}
              </a>
            </div>
          ) : (
            <section
              className="requests-list"
              aria-label={
                administrator ? t('Demandes de médias') : t('Mes demandes')
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {data.data.items.map((item, index) => (
                  <RequestRow
                    key={item.id}
                    className="request-row glass-panel"
                    order={index}
                  >
                    {item.title.poster && (
                      <img
                        className="request-poster"
                        src={item.title.poster}
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <div className="request-body">
                      <div className="request-heading">
                        <div>
                          <p>
                            {t(item.title.type === 'movie' ? 'Film' : 'Série')}{' '}
                            · {item.title.year}
                            {item.is4k ? ' · 4K' : ''}
                          </p>
                          <h2>{item.title.title}</h2>
                        </div>
                        <motion.span
                          key={status(item)}
                          className={`request-status request-status-${item.status}`}
                          initial={{ opacity: 0, y: reduced ? 0 : 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: reduced ? duration.press : duration.micro,
                            ease: ease.out,
                          }}
                        >
                          {item.downloads.length ? (
                            <Download size={14} />
                          ) : item.status === 1 ? (
                            <Clock3 size={14} />
                          ) : item.status === 3 || item.status === 4 ? (
                            <X size={14} />
                          ) : (
                            <Check size={14} />
                          )}
                          {t(status(item))}
                        </motion.span>
                      </div>
                      <p className="request-date">
                        {administrator && item.admin && (
                          <>
                            {t('Demandé par')} {item.admin.requestedBy} ·{' '}
                          </>
                        )}
                        {t('Demandé le {date}', { date: date(item.createdAt) })}
                      </p>
                      {item.seasons.length > 0 && (
                        <p>
                          {t('Saisons : {seasons}', {
                            seasons: item.seasons.join(', '),
                          })}
                        </p>
                      )}
                      {item.downloads.map((download, i) => (
                        <div className="request-download" key={i}>
                          {download.title && <p>{download.title}</p>}
                          <div
                            role="progressbar"
                            aria-label={t('Progression du téléchargement')}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={download.progress ?? undefined}
                          >
                            <motion.div
                              className="bg-brand-gradient"
                              initial={false}
                              style={{ width: '100%', transformOrigin: 'left' }}
                              animate={{
                                scaleX:
                                  Math.max(
                                    0,
                                    Math.min(100, download.progress ?? 0),
                                  ) / 100,
                              }}
                              transition={{ duration: reduced ? 0 : 0.4 }}
                            />
                          </div>
                          <p>
                            {download.progress == null
                              ? t('Progression indisponible')
                              : `${Math.round(download.progress)}%`}
                            {download.remaining
                              ? ` · ${download.remaining}`
                              : ''}{' '}
                            ·{' '}
                            {t(
                              downloadStatuses[
                                download.status.toLowerCase() as keyof typeof downloadStatuses
                              ] ?? 'État inconnu',
                            )}
                            {administrator ? ` (${download.status})` : ''}
                          </p>
                        </div>
                      ))}
                      {administrator && item.admin && (
                        <details className="request-technical">
                          <summary>{t('Informations administrateur')}</summary>
                          <dl>
                            {Object.entries({
                              [t('Demandé par')]: item.admin.requestedBy,
                              [t('Traité par')]: item.admin.modifiedBy,
                              [t('Mis à jour')]: date(item.updatedAt),
                              TMDB: item.title.id,
                              [t('Serveur')]: item.admin.serverId,
                              [t('Profil de qualité')]:
                                item.admin.profileName ?? item.admin.profileId,
                              [t('Dossier')]: item.admin.rootFolder,
                              [t('Identifiant externe')]: item.admin.externalId,
                            })
                              .filter(
                                ([, value]) => value != null && value !== '',
                              )
                              .map(([key, value]) => (
                                <div key={key}>
                                  <dt>{key}</dt>
                                  <dd>{value}</dd>
                                </div>
                              ))}
                          </dl>
                          {item.admin.serviceUrl && (
                            <a
                              href={item.admin.serviceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('Ouvrir le service')}
                            </a>
                          )}
                        </details>
                      )}
                      {administrator && (
                        <div className="request-actions">
                          {item.status === 1 &&
                            (rejecting === item.id ? (
                              <>
                                <span>{t('Refuser cette demande ?')}</span>
                                <button
                                  className="glass-control request-reject"
                                  disabled={decision.isPending}
                                  onClick={() =>
                                    decision.mutate({
                                      id: item.id,
                                      action: 'decline',
                                    })
                                  }
                                >
                                  {t('Confirmer le refus')}
                                </button>
                                <button
                                  className="glass-control"
                                  onClick={() => setRejecting(undefined)}
                                >
                                  {t('Annuler')}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="home-primary bg-brand-gradient text-primary-foreground"
                                  disabled={decision.isPending}
                                  onClick={() =>
                                    decision.mutate({
                                      id: item.id,
                                      action: 'approve',
                                    })
                                  }
                                >
                                  <Check size={16} />
                                  {t('Approuver')}
                                </button>
                                <button
                                  className="glass-control request-reject"
                                  disabled={decision.isPending}
                                  onClick={() => setRejecting(item.id)}
                                >
                                  <X size={16} />
                                  {t('Refuser')}
                                </button>
                              </>
                            ))}
                          {item.status === 4 && (
                            <button
                              className="glass-control"
                              disabled={decision.isPending}
                              onClick={() =>
                                decision.mutate({
                                  id: item.id,
                                  action: 'retry',
                                })
                              }
                            >
                              <RotateCcw size={16} />
                              {t('Réessayer')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </RequestRow>
                ))}
              </AnimatePresence>
            </section>
          )}
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
        </>
      )}
    </main>
  )
}
