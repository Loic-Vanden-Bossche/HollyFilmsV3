import { useEffect, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Clock3, RotateCcw, Check } from 'lucide-react'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type {
  DiscoveryTitle,
  DiscoveryPage,
  MediaRequestItem,
  RequestMediaType,
} from '@hollyfilms/shared/requests'
import {
  createMediaRequest,
  getRequestOptions,
  requestLanguage,
  searchRequestTitles,
} from '../requests-api.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { localizeError } from '../i18n/api-messages.ts'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import {
  duration,
  ease,
  distance,
  scale,
  staggerDelay,
} from '../motion/tokens.ts'
import { claimRequestFollowUp } from '../request-follow-up.ts'
import { MediaRequestDialog } from './MediaRequestDialog.tsx'
import { MediaArtwork } from './MediaArtwork.tsx'
import { ArtworkPreview } from './ArtworkPreview.tsx'
import '../requests.css'

export function DiscoveryResults({
  session,
  query,
  type,
  administrator = false,
  userId,
}: {
  session: JellyfinSession
  query: string
  type?: RequestMediaType
  administrator?: boolean
  userId?: string
}) {
  const { t, locale } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const client = useQueryClient()
  const [debounced, setDebounced] = useState('')
  const [confirming, setConfirming] = useState<DiscoveryTitle>()
  const [success, setSuccess] = useState<MediaRequestItem>()
  const [offerRequests, setOfferRequests] = useState(false)
  const [submitted, setSubmitted] = useState(() => new Set<string>())
  const submitting = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [query])
  const term = query.trim()
  const searching = debounced !== term
  const language = requestLanguage(locale)
  const options = useQuery({
    queryKey: ['request-options', session],
    queryFn: ({ signal }) => getRequestOptions(session, signal),
    staleTime: 60000,
    retry: false,
    enabled: query.trim().length >= 2,
  })
  const results = useInfiniteQuery<
    DiscoveryPage,
    Error,
    InfiniteData<DiscoveryPage>,
    readonly unknown[],
    number
  >({
    queryKey: ['request-search', session, language, type, term],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      searchRequestTitles(session, term, language, pageParam, type, signal),
    getNextPageParam: (page) =>
      page.page < page.pages ? page.page + 1 : undefined,
    enabled:
      debounced.length >= 2 && !searching && options.data?.enabled === true,
    staleTime: 15000,
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: (item: DiscoveryTitle) =>
      createMediaRequest(session, item.type, item.id, language),
    onSuccess: (request, title) => {
      setSuccess(request)
      setSubmitted(
        (previous) => new Set([...previous, `${title.type}:${title.id}`]),
      )
      setOfferRequests(claimRequestFollowUp(userId ?? session.deviceId))
      // Keep the requested badge correct immediately, even if refresh fails.
      client.setQueriesData<InfiniteData<DiscoveryPage>>(
        { queryKey: ['request-search', session] },
        (previous) =>
          previous && {
            ...previous,
            pages: previous.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === title.id && item.type === title.type
                  ? { ...item, requested: true, requestId: request.id }
                  : item,
              ),
            })),
          },
      )
    },
    onSettled: () => {
      // Refresh in the background: the receipt and next action must not wait
      // for a second round-trip after the server accepted this request.
      void Promise.all([
        client.invalidateQueries({ queryKey: ['request-search'] }),
        client.invalidateQueries({ queryKey: ['media-requests'] }),
      ])
    },
  })
  const submit = async () => {
    if (!confirming || submitting.current) return
    submitting.current = true
    try {
      await mutation.mutateAsync(confirming)
    } catch {
      // The modal keeps its title and shows the server error for retry.
    } finally {
      submitting.current = false
    }
  }
  if (query.trim().length < 2) return null
  const replacing = searching && !results.data
  const items = [
    ...new Map(
      results.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [`${item.type}:${item.id}`, item]),
    ).values(),
  ]
  return (
    <section className="discovery-results" aria-label={t('Titres à demander')}>
      <div className="home-section-header">
        <div>
          <p className="home-section-kicker">
            {replacing && items.length ? (
              <span role="status">{t('Recherche en cours…')}</span>
            ) : (
              t('AU-DELÀ DE VOTRE BIBLIOTHÈQUE')
            )}
          </p>
          <h2>{t('Titres à demander')}</h2>
        </div>
        <a className="request-link" href="/requests">
          {t('Mes demandes')}
        </a>
      </div>
      <AnimatePresence initial={false}>
        {success && !confirming && (
          <motion.p
            key={success.id}
            role="status"
            className="request-feedback"
            initial={{ opacity: 0, y: reduced ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? duration.press : duration.micro }}
          >
            <Check size={16} aria-hidden="true" />
            {success.status === 1
              ? t('Demande envoyée. Elle attend une approbation.')
              : [2, 5].includes(success.status)
                ? t('Demande approuvée automatiquement.')
                : t(
                    'Demande déjà enregistrée. Consultez son statut dans Mes demandes.',
                  )}
          </motion.p>
        )}
      </AnimatePresence>
      {options.isError || (results.isError && !searching) ? (
        <div className="request-empty" role="alert">
          <p>{t('La découverte de titres est indisponible.')}</p>
          <button
            className="glass-control"
            onClick={() => {
              void options.refetch()
              void results.refetch()
            }}
          >
            <RotateCcw size={16} />
            {t('Réessayer')}
          </button>
        </div>
      ) : options.data?.enabled === false ? (
        <p className="request-empty">
          {t('Le service de demandes n’est pas configuré.')}
        </p>
      ) : options.isPending ||
        results.isPending ||
        (replacing && !items.length) ? (
        <p role="status">{t('Recherche en cours…')}</p>
      ) : (
        <>
          <div className="discovery-grid" aria-busy={replacing}>
            {items.map((item, index) => {
              const supported =
                item.type === 'movie'
                  ? options.data?.movies
                  : options.data?.series
              const requested =
                item.requested || submitted.has(`${item.type}:${item.id}`)
              return (
                <motion.div
                  key={`${item.type}:${item.id}`}
                  initial={
                    reduced ? false : { opacity: 0.65, y: distance.control }
                  }
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '32px' }}
                  layout={reduced ? false : 'position'}
                  layoutDependency={term}
                  transition={{
                    duration: reduced ? duration.press : duration.panel,
                    ease: ease.out,
                    delay: reduced ? 0 : staggerDelay(index),
                  }}
                >
                  <ArtworkPreview
                    title={item.title}
                    cinematic
                    selectLabel={item.title}
                    wide={false}
                    artwork={<MediaArtwork source={item.poster} />}
                  >
                    <div className="discovery-copy">
                      <motion.button
                        type="button"
                        data-preview-select
                        whileTap={
                          reduced ? undefined : { scale: scale.pressed }
                        }
                        className="request-button glass-control"
                        disabled={
                          replacing ||
                          requested ||
                          !supported ||
                          mutation.isPending
                        }
                        onClick={() => {
                          mutation.reset()
                          setSuccess(undefined)
                          setOfferRequests(false)
                          setConfirming(item)
                        }}
                      >
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={requested ? 'requested' : 'request'}
                            className="request-button-label"
                            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: reduced ? 0 : -6 }}
                            transition={{
                              duration: reduced
                                ? duration.press
                                : duration.micro,
                            }}
                          >
                            {requested ? (
                              <Clock3 size={16} />
                            ) : (
                              <Plus size={16} />
                            )}
                            {requested
                              ? t('Déjà demandé')
                              : !supported
                                ? t('Service indisponible')
                                : t('Demander')}
                          </motion.span>
                        </AnimatePresence>
                      </motion.button>
                      <p>
                        {t(item.type === 'movie' ? 'Film' : 'Série')}
                        {item.year && ` · ${item.year}`}
                        {item.rating ? ` · ★ ${item.rating.toFixed(1)}` : ''}
                      </p>
                      {item.overview && (
                        <p className="discovery-overview">{item.overview}</p>
                      )}
                    </div>
                  </ArtworkPreview>
                </motion.div>
              )
            })}
          </div>
          {!items.length && (
            <p className="request-empty">
              {t('Aucun autre titre à demander pour cette recherche.')}
            </p>
          )}
          {results.hasNextPage && (
            <button
              className="home-more glass-control"
              disabled={replacing || results.isFetchingNextPage}
              onClick={() => void results.fetchNextPage()}
            >
              {results.isFetchingNextPage
                ? t('Chargement…')
                : t('Afficher plus de résultats')}
            </button>
          )}
        </>
      )}
      <p className="request-attribution">
        {t('Métadonnées fournies par TMDB.')}
      </p>
      <AnimatePresence>
        {confirming && (
          <MediaRequestDialog
            key={`${confirming.type}:${confirming.id}`}
            title={confirming}
            administrator={administrator}
            pending={mutation.isPending}
            request={success}
            offerRequests={offerRequests}
            error={
              mutation.isError
                ? localizeError(
                    t,
                    mutation.error,
                    'La demande n’a pas pu être envoyée.',
                  )
                : undefined
            }
            onConfirm={() => void submit()}
            onClose={() => setConfirming(undefined)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
