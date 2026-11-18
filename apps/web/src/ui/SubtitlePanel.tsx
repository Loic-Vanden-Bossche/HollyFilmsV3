import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  Download,
  Search,
  RotateCcw,
  Captions,
  Check,
  ChevronDown,
  ArrowUpRight,
  Send,
} from 'lucide-react'
import type {
  SubtitleLibrary,
  SubtitleRequest,
} from '@hollyfilms/shared/subtitles'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import {
  getSubtitleLibrary,
  searchSubtitles,
  requestSubtitles,
  downloadSubtitles,
} from '../subtitles-api.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { localizeError, apiMessage } from '../i18n/api-messages.ts'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useMotionPolicy } from '../components/reactbits/policy.ts'
import { Select } from './Select.tsx'
import { Tooltip } from './Tooltip.tsx'
import { languageFlag } from './language-flags.ts'
import { SubtitleFeedback, SubtitleStatusBadge } from './SubtitleFeedback.tsx'
import { SubtitleActionDialog } from './SubtitleActionDialog.tsx'
import './subtitles.css'

export function SubtitlePanel({
  session,
  itemId,
  sourceId: lockedSource,
  language: lockedLanguage,
  requestId,
  onChanged,
}: {
  session: JellyfinSession
  itemId: string
  sourceId?: string
  language?: string
  requestId?: string
  onChanged?: () => Promise<void>
}) {
  const { t, locale } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const { pageVisible } = useMotionPolicy()
  const cache = useQueryClient()
  const [chosenSource, setChosenSource] = useState('')
  const [chosenLanguage, setChosenLanguage] = useState(
    locale === 'fr' ? 'fra' : locale === 'zh-Hans' ? 'zho' : 'eng',
  )
  const [perfect, setPerfect] = useState(true)
  const [confirming, setConfirming] = useState<string>()
  const [requesting, setRequesting] = useState(false)
  const [tracksOpen, setTracksOpen] = useState(false)
  const tracksId = useId()
  const submitting = useRef(false)
  const [refreshError, setRefreshError] = useState(false)
  const library = useQuery({
    queryKey: ['subtitle-library', session, itemId],
    queryFn: ({ signal }) => getSubtitleLibrary(session, itemId, signal),
    retry: false,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.requests.some((row) => row.status === 'DOWNLOADING')
        ? 2000
        : query.state.data?.requests.some((row) => row.status === 'PENDING')
          ? 10000
          : false,
    refetchIntervalInBackground: false,
  })
  const sourceId =
    lockedSource ?? (chosenSource || library.data?.versions[0]?.id || '')
  const language = lockedLanguage ?? chosenLanguage
  const source = library.data?.versions.find((entry) => entry.id === sourceId)
  const processing = library.data?.requests.some(
    (row) => row.sourceId === sourceId && row.status === 'DOWNLOADING',
  )
  const changeRef = useRef(onChanged)
  useEffect(() => {
    changeRef.current = onChanged
  }, [onChanged])
  const signature = library.data?.versions
    .map(
      (version) =>
        version.id +
        ':' +
        version.tracks
          .map(
            (track) =>
              `${track.index}:${track.language}:${track.codec}:${track.title}`,
          )
          .join('|'),
    )
    .join(';')
  useEffect(() => {
    if (signature !== undefined && changeRef.current)
      void changeRef
        .current()
        .then(() => setRefreshError(false))
        .catch(() => setRefreshError(true))
  }, [signature])
  const search = useMutation({
    mutationFn: ({
      sourceId,
      language,
      perfect,
    }: {
      sourceId: string
      language: string
      perfect: boolean
    }) => searchSubtitles(session, itemId, sourceId, language, perfect),
  })
  const invalidate = () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: ['subtitle-library'] }),
      cache.invalidateQueries({ queryKey: ['subtitle-requests'] }),
      cache.invalidateQueries({ queryKey: ['media-details'] }),
    ])
  const receive = (request: SubtitleRequest) => {
    cache.setQueryData<SubtitleLibrary>(
      ['subtitle-library', session, itemId],
      (previous) =>
        previous && {
          ...previous,
          requests: [
            request,
            ...previous.requests.filter((row) => row.id !== request.id),
          ],
        },
    )
    void invalidate()
  }
  const ask = useMutation({
    mutationFn: () => requestSubtitles(session, itemId, sourceId, language),
    onSuccess: receive,
  })
  const download = useMutation({
    mutationFn: (remoteId: string) =>
      downloadSubtitles(
        session,
        itemId,
        sourceId,
        language,
        remoteId,
        requestId,
      ),
    onSuccess: receive,
  })
  const resetSearch = () => {
    search.reset()
    download.reset()
    ask.reset()
    setConfirming(undefined)
    setRequesting(false)
  }
  const busy = download.isPending || ask.isPending || Boolean(processing)
  const names = new Intl.DisplayNames([locale], { type: 'language' })
  const languageName = (code: string, iso2?: string, fallback?: string) => {
    try {
      return names.of(iso2 || code) || fallback || code
    } catch {
      return fallback || code
    }
  }
  const searchMatches =
    search.variables?.sourceId === sourceId &&
    search.variables.language === language
  const error = ask.error || download.error || search.error
  const activeRequest =
    library.data?.requests.find(
      (row) => row.sourceId === sourceId && row.language === language,
    ) ??
    (ask.data?.sourceId === sourceId && ask.data.language === language
      ? ask.data
      : undefined)
  const duplicate =
    activeRequest && ['PENDING', 'DOWNLOADING'].includes(activeRequest.status)
  const actionOpen = !!confirming || requesting
  const downloadResult = download.data
    ? (library.data?.requests.find((row) => row.id === download.data!.id) ??
      download.data)
    : undefined
  const result = confirming ? downloadResult : requesting ? ask.data : undefined
  const latest = result
    ? (library.data?.requests.find((row) => row.id === result.id) ?? result)
    : undefined
  const confirmAction = async () => {
    if (submitting.current) return
    submitting.current = true
    try {
      if (confirming) await download.mutateAsync(confirming)
      else await ask.mutateAsync()
    } catch {
      /* Keep the confirmation open for a retry. */
    } finally {
      submitting.current = false
    }
  }
  const stage = library.data?.administrator
    ? downloadResult?.status === 'DOWNLOADED'
      ? 4
      : download.isPending || download.data || processing
        ? 3
        : searchMatches && (search.isPending || search.isSuccess)
          ? 2
          : 1
    : activeRequest?.status === 'DOWNLOADED'
      ? 4
      : activeRequest?.status === 'DOWNLOADING'
        ? 3
        : ask.isPending || activeRequest
          ? 2
          : 1
  return (
    <section className="subtitle-panel" aria-label={t('Sous-titres externes')}>
      <div className="subtitle-heading">
        <span className="subtitle-heading-symbol">
          <Captions size={22} />
        </span>
        <div>
          <h3>{t('Sous-titres externes')}</h3>
          <p>
            {t('Choisissez la langue et la version qui vous correspondent.')}
          </p>
        </div>
        <Tooltip>
          <button
            className="glass-control"
            aria-label={t('Actualiser les pistes')}
            onClick={() => {
              void library.refetch()
              void changeRef
                .current?.()
                .then(() => setRefreshError(false))
                .catch(() => setRefreshError(true))
            }}
            disabled={library.isFetching}
          >
            <motion.span
              aria-hidden="true"
              animate={{
                rotate: library.isFetching && !reduced && pageVisible ? 360 : 0,
              }}
              transition={
                library.isFetching && !reduced && pageVisible
                  ? { duration: 1.3, repeat: Infinity, ease: 'linear' }
                  : { duration: 0 }
              }
            >
              <RotateCcw size={15} />
            </motion.span>
          </button>
        </Tooltip>
      </div>
      {library.isPending ? (
        <SubtitleFeedback title={t('Chargement des sous-titres…')} skeleton />
      ) : !library.data ? (
        <div className="subtitle-recovery">
          <SubtitleFeedback
            tone="error"
            title={localizeError(
              t,
              library.error,
              'Impossible de charger les sous-titres.',
            )}
          />
          <button
            className="glass-control subtitle-action"
            onClick={() => void library.refetch()}
          >
            <RotateCcw size={15} />
            {t('Réessayer')}
          </button>
        </div>
      ) : (
        <>
          {library.isError && (
            <SubtitleFeedback
              tone="error"
              title={localizeError(
                t,
                library.error,
                'Impossible de charger les sous-titres.',
              )}
            />
          )}
          <ol
            className="subtitle-steps"
            data-motion={reduced ? 'reduced' : 'full'}
            aria-label={t('Parcours des sous-titres')}
          >
            {[
              t('Langue'),
              library.data.administrator ? t('Recherche') : t('Approbation'),
              t('Installation'),
            ].map((label, index) => (
              <li
                key={index}
                data-state={
                  index + 1 < stage
                    ? 'complete'
                    : index + 1 === stage
                      ? 'current'
                      : 'next'
                }
                aria-current={index + 1 === stage ? 'step' : undefined}
              >
                <motion.span
                  className="subtitle-step-marker"
                  aria-hidden="true"
                  key={index + 1 < stage ? 'done' : 'number'}
                  initial={reduced ? false : { opacity: 0.6, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: reduced ? 0 : 0.18 }}
                >
                  {index + 1 < stage ? <Check size={13} /> : index + 1}
                </motion.span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <div className="subtitle-fields">
            <label>
              {t('Version du média')}
              <Select
                aria-label={t('Version du média')}
                value={sourceId}
                disabled={!!lockedSource || busy}
                onValueChange={(value) => {
                  setChosenSource(value)
                  resetSearch()
                }}
              >
                {library.data.versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              {t('Langue des sous-titres')}
              <Select
                aria-label={t('Langue des sous-titres')}
                value={language}
                disabled={!!lockedLanguage || busy}
                onValueChange={(value) => {
                  setChosenLanguage(value)
                  resetSearch()
                }}
                optionIcon={(value) => {
                  const flag = languageFlag(
                    library.data.languages.find((entry) => entry.code === value)
                      ?.iso2 ?? value,
                  )
                  return flag ? (
                    <img
                      className="holly-select-flag"
                      src={flag}
                      alt=""
                      width={20}
                      height={15}
                    />
                  ) : null
                }}
              >
                {library.data.languages.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {languageName(entry.code, entry.iso2, entry.name)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {source?.tracks.length ? (
            <div className="subtitle-installed">
              <button
                type="button"
                aria-expanded={tracksOpen}
                aria-controls={tracksId}
                onClick={() => setTracksOpen((value) => !value)}
              >
                <Captions size={16} />
                {t('Pistes installées')} · {source.tracks.length}
                <motion.span
                  animate={{ rotate: tracksOpen ? 180 : 0 }}
                  transition={{ duration: reduced ? 0 : 0.2 }}
                >
                  <ChevronDown size={15} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {tracksOpen && (
                  <motion.ul
                    id={tracksId}
                    initial={{ height: reduced ? 'auto' : 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: reduced ? 'auto' : 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0.08 : 0.24 }}
                    style={{ overflow: 'hidden' }}
                  >
                    {source.tracks.map((track) => (
                      <li key={track.index}>
                        <span>
                          {languageFlag(track.language) && (
                            <img
                              className="holly-select-flag"
                              src={languageFlag(track.language)}
                              alt=""
                            />
                          )}
                          {track.title}
                        </span>
                        <small>
                          {track.external ? t('Externe') : t('Intégré')}
                          {track.codec ? ` · ${track.codec.toUpperCase()}` : ''}
                        </small>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <p>{t('Aucune piste de sous-titres pour cette version.')}</p>
          )}
          {library.data.administrator ? (
            <>
              <label className="subtitle-match">
                <input
                  type="checkbox"
                  checked={perfect}
                  disabled={busy}
                  onChange={(event) => {
                    setPerfect(event.target.checked)
                    resetSearch()
                  }}
                />
                {t('Correspondance exacte uniquement')}
              </label>
              <motion.button
                className="subtitle-action subtitle-primary bg-brand-gradient text-primary-foreground"
                whileHover={reduced ? undefined : { y: -1 }}
                whileTap={reduced ? undefined : { scale: 0.98 }}
                disabled={!source || search.isPending || busy}
                onClick={() => {
                  setConfirming(undefined)
                  download.reset()
                  search.mutate({ sourceId, language, perfect })
                }}
              >
                <Search size={16} />
                {search.isPending
                  ? t('Recherche en cours…')
                  : t('Rechercher des sous-titres')}
              </motion.button>
              <AnimatePresence initial={false}>
                {searchMatches && search.isPending && (
                  <SubtitleFeedback
                    key="searching"
                    title={t('Recherche en cours…')}
                    description={t(
                      'Les fournisseurs de sous-titres sont interrogés.',
                    )}
                    skeleton
                  />
                )}
              </AnimatePresence>
              {searchMatches && search.isSuccess && (
                <div className="subtitle-results">
                  {!search.data.items.length && (
                    <SubtitleFeedback
                      tone="neutral"
                      title={t('Aucun résultat')}
                      description={t(
                        'Aucun sous-titre trouvé. Essayez sans la correspondance exacte.',
                      )}
                    />
                  )}
                  {search.data.items.length > 0 && (
                    <p className="subtitle-results-count">
                      {t('Sous-titres trouvés : {count}', {
                        count: search.data.items.length,
                      })}
                    </p>
                  )}
                  {search.data.items.map((candidate, index) => (
                    <motion.article
                      key={candidate.id}
                      className="subtitle-candidate glass-panel"
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reduced ? 0.08 : 0.28,
                        delay: reduced ? 0 : Math.min(index * 0.035, 0.2),
                      }}
                    >
                      <div className="subtitle-candidate-heading">
                        <span className="subtitle-file-symbol">
                          <Captions size={20} />
                        </span>
                        <strong>{candidate.name}</strong>
                        {languageFlag(candidate.language ?? language) && (
                          <img
                            src={languageFlag(candidate.language ?? language)}
                            className="holly-select-flag"
                            alt=""
                          />
                        )}
                      </div>
                      <p>
                        {[
                          candidate.provider,
                          candidate.format?.toUpperCase(),
                          candidate.author,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <div className="subtitle-badges">
                        {candidate.hashMatch && (
                          <span>
                            <Check size={12} />
                            {t('Correspondance exacte')}
                          </span>
                        )}
                        {candidate.hearingImpaired && (
                          <span>{t('Malentendants')}</span>
                        )}
                        {candidate.forced && <span>{t('Forcés')}</span>}
                        {candidate.machineTranslated && (
                          <span>{t('Traduction automatique')}</span>
                        )}
                        {candidate.rating != null && (
                          <span>★ {candidate.rating}</span>
                        )}
                        {candidate.downloads != null && (
                          <span>
                            <Download size={12} />{' '}
                            {new Intl.NumberFormat(locale).format(
                              candidate.downloads,
                            )}
                          </span>
                        )}
                      </div>
                      <motion.button
                        key="download"
                        className="glass-control subtitle-action"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        disabled={
                          busy ||
                          (download.variables === candidate.id &&
                            downloadResult?.status === 'DOWNLOADED')
                        }
                        whileTap={reduced ? undefined : { scale: 0.98 }}
                        onClick={() => {
                          download.reset()
                          setConfirming(candidate.id)
                        }}
                      >
                        <Download size={15} />
                        {download.variables === candidate.id &&
                        downloadResult?.status === 'DOWNLOADED'
                          ? t('Installé')
                          : requestId
                            ? t('Approuver et télécharger')
                            : t('Télécharger ce sous-titre')}
                      </motion.button>
                    </motion.article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="subtitle-request">
              <p>
                {t(
                  'Un administrateur choisira et téléchargera le sous-titre demandé.',
                )}
              </p>
              <motion.button
                className="subtitle-action subtitle-primary bg-brand-gradient text-primary-foreground"
                whileTap={reduced ? undefined : { scale: 0.98 }}
                disabled={!source || busy || !!duplicate}
                onClick={() => {
                  ask.reset()
                  setRequesting(true)
                }}
              >
                <Send size={16} />
                {duplicate
                  ? t('Déjà demandé')
                  : ask.isPending
                    ? t('Envoi…')
                    : t('Demander cette langue')}
              </motion.button>
            </div>
          )}
          <AnimatePresence initial={false}>
            {error && !actionOpen && (
              <SubtitleFeedback
                key="error"
                tone="error"
                title={localizeError(
                  t,
                  error,
                  'Impossible de traiter les sous-titres.',
                )}
              />
            )}
            {processing && !actionOpen && (
              <SubtitleFeedback
                key="verifying"
                title={t('Vérification du sous-titre…')}
                description={t(
                  'Le téléchargement est envoyé. Vérification de son apparition dans la bibliothèque…',
                )}
              />
            )}
            {refreshError && !actionOpen && (
              <SubtitleFeedback
                key="refresh-error"
                tone="error"
                title={t(
                  'Impossible d’actualiser les pistes du lecteur. Réessayez.',
                )}
              />
            )}
          </AnimatePresence>
          {library.data.requests
            .filter((row) => row.sourceId === sourceId)
            .filter((row) => !actionOpen || row.id !== latest?.id)
            .slice(0, 5)
            .map((row) => (
              <motion.div
                className="subtitle-request-state"
                key={row.id}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="subtitle-request-state-heading">
                  <span>
                    {languageFlag(row.language) && (
                      <img
                        className="holly-select-flag"
                        src={languageFlag(row.language)}
                        alt=""
                      />
                    )}
                    {languageName(row.language)}
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    <SubtitleStatusBadge key={row.status} status={row.status} />
                  </AnimatePresence>
                </div>
                {row.lastError && (
                  <p role="alert">
                    {t(
                      apiMessage(row.lastError) ??
                        'Impossible de traiter les sous-titres.',
                    )}
                  </p>
                )}
              </motion.div>
            ))}
          <a
            className="subtitle-history"
            href={
              (library.data.administrator ? '/admin/requests' : '/requests') +
              '?section=subtitles'
            }
          >
            {t('Suivre les demandes de sous-titres')}
            <ArrowUpRight size={15} />
          </a>
        </>
      )}
      <AnimatePresence>
        {actionOpen && (
          <SubtitleActionDialog
            action={confirming ? 'download' : 'request'}
            version={source?.name ?? t('Version du média')}
            language={language}
            languageLabel={languageName(language)}
            fileName={
              confirming
                ? search.data?.items.find((item) => item.id === confirming)
                    ?.name
                : undefined
            }
            approval={!!requestId}
            pending={confirming ? download.isPending : ask.isPending}
            result={latest?.status}
            error={
              latest?.lastError
                ? t(
                    apiMessage(latest.lastError) ??
                      'Impossible de traiter les sous-titres.',
                  )
                : error
                  ? localizeError(
                      t,
                      error,
                      'Impossible de traiter les sous-titres.',
                    )
                  : refreshError
                    ? t(
                        'Impossible d’actualiser les pistes du lecteur. Réessayez.',
                      )
                    : undefined
            }
            onConfirm={() => void confirmAction()}
            onClose={() => {
              setConfirming(undefined)
              setRequesting(false)
            }}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
