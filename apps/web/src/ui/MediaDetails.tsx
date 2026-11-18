import { localizeText } from '../i18n/messages.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { useEffect, useId, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { duration, ease } from '../motion/tokens.ts'
import { motion } from 'motion/react'
import {
  X,
  Star,
  Play,
  Heart,
  Check,
  ExternalLink,
  Users,
  Clock3,
  Layers,
  MoreHorizontal,
} from 'lucide-react'
import type { MediaItem, LibraryPage } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { MediaArtwork } from './MediaArtwork.tsx'
import { formatDuration } from '../format-duration.ts'
import { AudioLanguages } from './AudioLanguages.tsx'
import { SubtitlePanel } from './SubtitlePanel.tsx'
import {
  getMediaDetails,
  getMediaRelations,
  getRelatedPage,
  mediaRequest,
  safeExternalUrl,
  type MediaDetailsData,
  type MediaRelations,
  type WatchProviders,
  type ReviewPage,
} from '@hollyfilms/shared/media-details'
import { MediaRail } from './MediaRail.tsx'
import { MediaCommunity } from './MediaCommunity.tsx'
import { MediaTile } from './MediaTile.tsx'
import { useMediaDetailsMotion } from './use-media-details-motion.ts'
import { detailSections, useDetailSections } from './use-detail-sections.ts'
import { formatTime } from '../playback/format-time.ts'
import './media-card.css'
import '../home.css'
import '../player.css'
import './media-details.css'

export function MediaDetails({
  item: summary,
  session,
  userId,
  detailsData,
  relationsData,
  providersData,
  reviewsData,
  loadRelatedPage,
  onClose,
  onPlay,
  onSelect,
  onFavorite,
  onWatched,
}: {
  item: MediaItem
  session?: JellyfinSession
  userId?: string
  detailsData?: MediaDetailsData
  relationsData?: MediaRelations
  providersData?: WatchProviders
  reviewsData?: ReviewPage
  loadRelatedPage?: (
    filter: { parentId?: string; personId?: string },
    startIndex: number,
    signal?: AbortSignal,
  ) => Promise<LibraryPage>
  onPlay?: (item: MediaItem, resume: boolean, queue?: MediaItem[]) => void
  onSelect?: (item: MediaItem) => void
  onFavorite?: (item: MediaItem, value: boolean) => Promise<boolean>
  onWatched?: (item: MediaItem, value: boolean) => Promise<boolean>
  onClose: () => void
}) {
  const { t } = useI18n()
  const { scope, reduced, present, dismiss } = useMediaDetailsMotion()
  const marker = useId()
  const activeSection = useDetailSections(scope, reduced)
  const collectionRequest = useRef<AbortController | null>(null)
  const outside = useRef(false)
  const queryClient = useQueryClient()
  const base = new URL('/jellyfin', window.location.origin).href
  const enabled = !!session && !!userId
  const key = ['media-details', session?.deviceId, userId, summary.id]
  const details = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      getMediaDetails(base, session!, userId!, summary.id, signal),
    enabled: enabled && !detailsData,
    staleTime: 60000,
    retry: false,
  })
  const relations = useQuery({
    queryKey: [...key, 'relations'],
    queryFn: ({ signal }) =>
      getMediaRelations(base, session!, userId!, summary.id, signal),
    enabled: enabled && !relationsData,
    staleTime: 60000,
    retry: false,
  })
  const data = detailsData ?? details.data,
    related = relationsData ?? relations.data
  const [patch, setPatch] = useState<Partial<MediaItem>>({}),
    [pending, setPending] = useState(''),
    [actionError, setActionError] = useState('')
  const [collectionPatches, setCollectionPatches] = useState<
    Record<string, Partial<MediaItem>>
  >({})
  const item = { ...(data?.item ?? summary), ...patch }
  const [region, setRegion] = useState(() => {
    try {
      const stored = localStorage.getItem(
        'hollyfilms-region-' + (userId ?? 'preview'),
      )
      return stored && /^[A-Z]{2}$/.test(stored) ? stored : 'FR'
    } catch {
      return 'FR'
    }
  })
  const [page, setPage] = useState(1)
  const [showSubtitles, setShowSubtitles] = useState(false)
  const providers = useQuery({
    queryKey: [...key, 'providers', region],
    queryFn: ({ signal }) =>
      mediaRequest<WatchProviders>(
        session!,
        summary.id + '/providers?region=' + region,
        { signal },
      ),
    enabled: enabled && !providersData,
    staleTime: 60000,
    retry: false,
  })
  const reviews = useQuery({
    queryKey: [...key, 'reviews', page],
    queryFn: ({ signal }) =>
      mediaRequest<ReviewPage>(session!, summary.id + '/reviews?page=' + page, {
        signal,
      }),
    enabled: enabled && !reviewsData,
    staleTime: 30000,
    retry: false,
  })
  const [browsing, setBrowsing] = useState<{
    id: string
    title: string
    type: 'collection' | 'person'
  }>()
  const browserOpener = useRef<HTMLElement | null>(null)
  function openBrowser(next: NonNullable<typeof browsing>) {
    browserOpener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setBrowsing(next)
  }
  const browser = useRef<HTMLDivElement>(null)
  const members = useInfiniteQuery({
    queryKey: [...key, 'browse', browsing?.type, browsing?.id],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      loadRelatedPage
        ? loadRelatedPage(
            browsing?.type === 'person'
              ? { personId: browsing.id }
              : { parentId: browsing?.id },
            pageParam,
            signal,
          )
        : getRelatedPage(
            base,
            session!,
            userId!,
            browsing?.type === 'person'
              ? { personId: browsing.id }
              : { parentId: browsing?.id },
            pageParam,
            signal,
          ),
    getNextPageParam: (last, pages) =>
      pages.reduce((n, p) => n + p.items.length, 0) < last.total
        ? pages.reduce((n, p) => n + p.items.length, 0)
        : undefined,
    enabled: (enabled || !!loadRelatedPage) && !!browsing,
    retry: false,
  })
  const memberItems = members.data?.pages.flatMap((p) => p.items) ?? []
  useEffect(() => {
    if (browsing) {
      browser.current?.focus({ preventScroll: true })
      browser.current?.scrollIntoView({
        behavior: reduced ? 'instant' : 'smooth',
        block: 'start',
      })
    }
  }, [browsing, reduced])
  async function update(
    target: MediaItem,
    kind: 'favorite' | 'watched',
    value: boolean,
  ) {
    const fn = kind === 'favorite' ? onFavorite : onWatched
    if (!fn) return value
    const result = await fn(target, value)
    setCollectionPatches((old) => ({
      ...old,
      [target.id]: { ...old[target.id], [kind]: result },
    }))
    if (target.id === item.id)
      setPatch((p) => ({
        ...p,
        [kind]: result,
        ...(kind === 'watched'
          ? {
              progress: result ? 1 : 0,
              playbackPosition: 0,
              remainingMinutes: undefined,
            }
          : {}),
      }))
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key, exact: true }),
      queryClient.invalidateQueries({
        queryKey: [...key, 'relations'],
        exact: true,
      }),
      queryClient.invalidateQueries({ queryKey: [...key, 'browse'] }),
    ])
    return result
  }
  async function action(kind: 'favorite' | 'watched') {
    setPending(kind)
    setActionError('')
    try {
      await update(item, kind, !item[kind])
    } catch {
      setActionError('La modification n’a pas été enregistrée. Réessaie.')
    } finally {
      setPending('')
    }
  }
  async function playCollection(collectionId = browsing?.id) {
    if (!collectionId || (!loadRelatedPage && (!session || !userId))) return
    collectionRequest.current?.abort()
    const controller = new AbortController()
    collectionRequest.current = controller
    setPending('collection')
    setActionError('')
    try {
      const current =
        browsing?.type === 'collection' && browsing.id === collectionId
      let queue = current ? [...memberItems] : [],
        total = current ? members.data?.pages[0]?.total : undefined
      while (total === undefined || queue.length < total) {
        const next = loadRelatedPage
          ? await loadRelatedPage(
              { parentId: collectionId },
              queue.length,
              controller.signal,
            )
          : await getRelatedPage(
              base,
              session!,
              userId!,
              { parentId: collectionId },
              queue.length,
              controller.signal,
            )
        if (!next.items.length && next.total > queue.length)
          throw new Error(t('Collection incomplète'))
        queue.push(...next.items)
        total = next.total
      }
      if (!queue.length)
        setActionError('Aucun titre accessible dans cette collection.')
      if (queue.length && !controller.signal.aborted)
        onPlay?.(queue[0], true, queue)
    } catch {
      if (!controller.signal.aborted)
        setActionError('Impossible de charger la collection. Réessaie.')
    } finally {
      setPending('')
    }
  }
  const navigate = onSelect ?? (() => {})
  useEffect(() => {
    return () => {
      collectionRequest.current?.abort()
    }
  }, [])
  function close() {
    collectionRequest.current?.abort()
    dismiss(onClose)
  }
  function isOutside(x: number, y: number) {
    const rect = scope.current.getBoundingClientRect()
    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom
  }
  return (
    <motion.dialog
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: reduced ? 0 : 6,
        transition: { duration: reduced ? 0 : duration.micro, ease: ease.in },
      }}
      transition={{ duration: reduced ? 0 : duration.panel, ease: ease.out }}
      inert={!present}
      aria-hidden={!present}
      data-present={present}
      data-phase={present ? 'opening' : 'closing'}
      onAnimationComplete={() => {
        if (present && scope.current?.open)
          scope.current.setAttribute('data-phase', 'open')
      }}
      ref={scope}
      className="media-dialog glass-panel"
      aria-labelledby="media-detail-title"
      onCancel={(event) => {
        event.preventDefault()
        void close()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          const menu = scope.current.querySelector<HTMLDetailsElement>(
            '.detail-card-menu[open]',
          )
          if (menu) {
            menu.open = false
            event.preventDefault()
            event.stopPropagation()
          } else {
            event.preventDefault()
            void close()
          }
        }
      }}
      onPointerDown={(event) => {
        outside.current =
          event.button === 0 &&
          event.target === event.currentTarget &&
          isOutside(event.clientX, event.clientY)
      }}
      onPointerCancel={() => {
        outside.current = false
      }}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('.detail-card-menu'))
          scope.current
            .querySelectorAll<HTMLDetailsElement>('.detail-card-menu[open]')
            .forEach((menu) => {
              menu.open = false
            })
        const dismiss =
          outside.current &&
          event.target === event.currentTarget &&
          isOutside(event.clientX, event.clientY)
        outside.current = false
        if (dismiss) void close()
      }}
    >
      <div className="detail-toolbar">
        <nav
          className="detail-section-nav"
          aria-label={t('Sections de la fiche')}
        >
          {detailSections.map(([id, label]) => (
            <button
              key={id}
              aria-controls={id}
              aria-current={activeSection === id ? 'location' : undefined}
              onClick={() =>
                scope.current.querySelector('#' + id)?.scrollIntoView({
                  behavior: reduced ? 'instant' : 'smooth',
                  block: 'start',
                })
              }
            >
              {activeSection === id && (
                <motion.i
                  className="detail-nav-marker"
                  layoutId={reduced ? undefined : marker}
                  aria-hidden="true"
                  transition={{
                    duration: reduced ? 0 : duration.panel,
                    ease: ease.out,
                  }}
                />
              )}
              {t(label)}
            </button>
          ))}
        </nav>
        <Tooltip>
          <motion.button
            className="media-detail-close glass-control"
            aria-label={t('Fermer la fiche')}
            onClick={() => void close()}
            whileTap={reduced ? undefined : { scale: 0.9 }}
          >
            <X size={20} />
          </motion.button>
        </Tooltip>
      </div>
      <div className="media-detail-art">
        <div className="detail-art-reveal">
          <MediaArtwork
            source={item.backdrop ?? item.poster}
            session={session}
            width={2560}
            eager
          />
        </div>
      </div>

      <div className="media-detail-body">
        {item.poster && (
          <div className="media-detail-poster">
            <MediaArtwork
              source={item.poster}
              session={session}
              width={400}
              eager
            />
          </div>
        )}
        <p id="detail-overview" className="home-eyebrow">
          {t(item.kind)} {item.year && '· ' + item.year}
        </p>
        <h2 id="media-detail-title">{item.title}</h2>
        <div className="home-meta">
          {item.minutes && <span>{formatDuration(item.minutes, t)}</span>}
          {item.classification && (
            <span className="home-rating">{item.classification}</span>
          )}
          {item.rating != null && (
            <span>
              <Star size={13} />
              {item.rating.toFixed(1)}
            </span>
          )}
          {item.criticRating != null && (
            <span
              aria-label={t('Rotten Tomatoes : {rating} %', {
                rating: item.criticRating,
              })}
            >
              <span aria-hidden="true">🍅</span>
              {item.criticRating}%
            </span>
          )}
          {item.watched && <span className="text-success">{t('Déjà vu')}</span>}
        </div>
        {item.episode && <p className="media-detail-episode">{item.episode}</p>}
        <p className="media-detail-overview">
          {item.overview ||
            t('Le synopsis de ce titre n’est pas encore disponible.')}
        </p>
        {item.genres.length > 0 && (
          <div className="media-genres">
            {item.genres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
        )}
        {(onPlay || onFavorite || onWatched) && (
          <div className="media-play-actions">
            {onPlay && (
              <motion.button
                className="home-primary"
                data-artwork-open="player"
                onClick={() => onPlay(item, true)}
                whileTap={reduced ? undefined : { scale: 0.97 }}
              >
                <Play size={18} fill="currentColor" />{' '}
                {item.progress > 0
                  ? t('Reprendre')
                  : item.kind === 'Série'
                    ? t('Lire la série')
                    : t('Lire')}
              </motion.button>
            )}
            {onPlay && item.progress > 0 && (
              <button
                className="glass-control"
                data-artwork-open="player"
                onClick={() => onPlay(item, false)}
              >
                {t('Depuis le début')}
              </button>
            )}
            {onFavorite && (
              <Tooltip>
                <button
                  className="glass-control"
                  aria-label={
                    item.favorite
                      ? t('Retirer des favoris')
                      : t('Ajouter aux favoris')
                  }
                  aria-pressed={!!item.favorite}
                  disabled={!!pending}
                  onClick={() => void action('favorite')}
                >
                  <Heart
                    size={19}
                    fill={item.favorite ? 'currentColor' : 'none'}
                  />
                </button>
              </Tooltip>
            )}
            {onWatched && (
              <Tooltip>
                <button
                  className="glass-control"
                  aria-label={
                    item.watched
                      ? t('Marquer comme non vu')
                      : t('Marquer comme vu')
                  }
                  aria-pressed={!!item.watched}
                  disabled={!!pending}
                  onClick={() => void action('watched')}
                >
                  <Check size={19} />
                </button>
              </Tooltip>
            )}
            {!!item.trailers?.length && (
              <a
                className="glass-control"
                href={safeExternalUrl(
                  item.trailers.find((t) => safeExternalUrl(t.url))?.url,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('Bande-annonce')} <ExternalLink size={15} />
              </a>
            )}
          </div>
        )}
        {actionError && (
          <p role="alert" className="detail-error">
            {localizeText(t, actionError)}
          </p>
        )}
        {item.progress > 0 && (
          <p className="media-detail-progress">
            {Math.round(item.progress * 100)} {t('% visionné')}
            {item.remainingMinutes
              ? ' · ' +
                t('Encore {duration}', {
                  duration: formatDuration(item.remainingMinutes, t),
                })
              : ''}
          </p>
        )}
        {item.quality ||
        item.audioLanguages?.length ||
        item.editions?.length ? (
          <dl className="media-detail-specs">
            {item.quality && (
              <div>
                <dt>{t('Qualité disponible')}</dt>
                <dd>{item.quality}</dd>
              </div>
            )}
            {Boolean(item.audioLanguages?.length) && (
              <div>
                <dt>{t('Langues audio')}</dt>
                <dd>
                  <AudioLanguages languages={item.audioLanguages!} />
                </dd>
              </div>
            )}
            {Boolean(item.editions?.length) && (
              <div>
                <dt>{t('Éditions')}</dt>
                <dd>
                  {item
                    .editions!.map((edition) => localizeText(t, edition))
                    .join(' · ')}
                </dd>
              </div>
            )}
          </dl>
        ) : null}
        {session && (item.kind === 'Film' || item.kind === 'Épisode') && (
          <details
            className="subtitle-detail glass-panel"
            open={showSubtitles}
            onToggle={(event) => setShowSubtitles(event.currentTarget.open)}
          >
            <summary>{t('Sous-titres externes')}</summary>
            {showSubtitles && (
              <SubtitlePanel session={session} itemId={item.id} />
            )}
          </details>
        )}
        {enabled && details.isPending && (
          <p role="status" className="detail-status">
            {t('Chargement de la fiche complète…')}
          </p>
        )}
        {details.isError && (
          <p role="alert" className="detail-status">
            {t('La fiche complète n’a pas pu être chargée.')}{' '}
            <button onClick={() => void details.refetch()}>
              {t('Réessayer')}
            </button>
          </p>
        )}
        {!!data?.tags.length && (
          <details className="detail-tags">
            <summary>
              {t('Étiquettes')} <span>{data.tags.length}</span>
            </summary>
            <div>
              {data.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </details>
        )}
        {!!data?.links.length && (
          <div
            className="detail-external-links"
            aria-label={t('Liens externes')}
          >
            {data.links.map((link) => (
              <a
                key={link.url}
                href={safeExternalUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.name}
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="detail-sections">
        <MediaCommunity
          providers={providersData ?? providers.data}
          providerLoading={enabled && providers.isPending}
          providerError={providers.isError}
          onRetryProviders={() => void providers.refetch()}
          reviews={reviewsData ?? reviews.data}
          reviewsLoading={enabled && reviews.isPending}
          reviewsError={reviews.isError}
          onRetryReviews={() => void reviews.refetch()}
          region={region}
          onRegion={(value) => {
            setRegion(value)
            try {
              localStorage.setItem(
                'hollyfilms-region-' + (userId ?? 'preview'),
                value,
              )
            } catch {
              /* Storage may be disabled. */
            }
          }}
          page={page}
          onPage={setPage}
          onSave={
            session
              ? async (content, rating) => {
                  await mediaRequest(session, summary.id + '/review', {
                    method: 'PUT',
                    body: { content, rating },
                  })
                  await queryClient.invalidateQueries({
                    queryKey: [...key, 'reviews'],
                  })
                }
              : undefined
          }
          onDelete={
            session
              ? async () => {
                  await mediaRequest(session, summary.id + '/review', {
                    method: 'DELETE',
                  })
                  await queryClient.invalidateQueries({
                    queryKey: [...key, 'reviews'],
                  })
                }
              : undefined
          }
        />
        <dl className="detail-credits">
          {[
            [t('Réalisation'), data?.directors],
            [t('Scénario'), data?.writers],
            [t('Studios'), data?.studios],
            [t('Genres'), item.genres],
          ].map(([label, values]) =>
            Array.isArray(values) && values.length ? (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{values.join(', ')}</dd>
              </div>
            ) : null,
          )}
        </dl>
        <div id="detail-cast">
          <MediaRail
            title={t('Distribution & équipe')}
            kind="person"
            count={data?.people.length ?? 0}
          >
            {data?.people.map((person, index) => (
              <button
                key={person.id ?? index}
                className="detail-person"
                disabled={!person.id || (!enabled && !loadRelatedPage)}
                onClick={() =>
                  person.id &&
                  openBrowser({
                    id: person.id,
                    title: person.name,
                    type: 'person',
                  })
                }
              >
                <div className="detail-person-art">
                  <MediaArtwork
                    source={person.image}
                    session={session}
                    width={300}
                    fallback={<Users size={36} />}
                  />
                </div>
                <strong>{person.name}</strong>
                <span>{person.role}</span>
              </button>
            ))}
          </MediaRail>
          {!data?.people.length && (
            <p className="detail-status">{t('Distribution non renseignée.')}</p>
          )}
        </div>
        {browsing && (
          <div ref={browser} tabIndex={-1} className="detail-browser">
            <div className="detail-section-heading">
              <h3>
                {browsing.type === 'person' ? t('Avec') + ' ' : ''}
                {browsing.title}
              </h3>
              <Tooltip>
                <button
                  className="glass-control"
                  aria-label={t('Fermer cette sélection')}
                  onClick={() => {
                    collectionRequest.current?.abort()
                    setBrowsing(undefined)
                    browserOpener.current?.focus()
                  }}
                >
                  <X size={18} />
                </button>
              </Tooltip>
            </div>
            {actionError && (
              <p role="alert" className="detail-error">
                {localizeText(t, actionError)}
              </p>
            )}
            {members.isPending ? (
              <p role="status">{t('Chargement des titres…')}</p>
            ) : members.isError ? (
              <p role="alert">
                {t('Impossible de charger les titres.')}{' '}
                <button onClick={() => void members.refetch()}>
                  {t('Réessayer')}
                </button>
              </p>
            ) : (
              <>
                {browsing.type === 'collection' &&
                  onPlay &&
                  memberItems.length > 0 && (
                    <button
                      className="home-primary"
                      disabled={!!pending}
                      onClick={() => void playCollection()}
                    >
                      <Play size={16} />
                      {pending === 'collection'
                        ? t('Préparation…')
                        : t('Lire la collection')}
                    </button>
                  )}
                <MediaRail
                  title={t('Dans votre bibliothèque')}
                  count={members.data?.pages[0]?.total}
                >
                  {memberItems.map((entry) => (
                    <MediaTile
                      key={entry.id}
                      item={entry}
                      session={session}
                      onSelect={navigate}
                      onPlay={onPlay}
                      onFavorite={onFavorite}
                      onWatched={onWatched}
                    />
                  ))}
                </MediaRail>
                {!memberItems.length && (
                  <p className="detail-status">
                    {t('Aucun titre accessible.')}
                  </p>
                )}
                {members.hasNextPage && (
                  <button
                    className="glass-control"
                    disabled={members.isFetchingNextPage}
                    onClick={() => void members.fetchNextPage()}
                  >
                    {members.isFetchingNextPage
                      ? t('Chargement…')
                      : t('Afficher plus de titres')}
                  </button>
                )}
              </>
            )}
          </div>
        )}
        <div id="detail-scenes">
          <MediaRail
            title={t('Scènes')}
            kind="scene"
            count={data?.chapters.length ?? 0}
          >
            {data?.chapters.map((chapter, index) => (
              <motion.button
                key={index}
                className="detail-chapter"
                disabled={!onPlay}
                whileHover={reduced ? undefined : { y: -3 }}
                onClick={() =>
                  onPlay?.(
                    { ...item, playbackPosition: chapter.position },
                    true,
                  )
                }
                aria-label={t('Lire {chapter} à {time}', {
                  chapter: chapter.name,
                  time: formatTime(chapter.position),
                })}
              >
                <MediaArtwork
                  source={chapter.image}
                  session={session}
                  width={480}
                />
                <span className="detail-chapter-play">
                  <Play size={20} fill="currentColor" />
                </span>
                <span className="detail-chapter-caption">
                  <strong>{chapter.name}</strong>
                  <span>
                    <Clock3 size={12} />
                    {formatTime(chapter.position)}
                  </span>
                </span>
              </motion.button>
            ))}
          </MediaRail>
          {!data?.chapters.length && (
            <p className="detail-status">
              {t('Aucune scène renseignée pour ce titre.')}
            </p>
          )}
        </div>
        <div id="detail-related">
          <MediaRail
            title={t('Collections')}
            count={related?.collections.length ?? 0}
          >
            {related?.collections.map((collection) => (
              <div key={collection.id}>
                <button
                  className="detail-collection"
                  disabled={!enabled && !loadRelatedPage}
                  onClick={() =>
                    openBrowser({
                      id: collection.id,
                      title: collection.title,
                      type: 'collection',
                    })
                  }
                >
                  <div className="detail-collection-art">
                    <MediaArtwork
                      source={collection.poster}
                      session={session}
                      width={400}
                    />
                    <span>
                      <Layers size={14} />
                      {collection.count ?? t('Collection')}
                    </span>
                  </div>
                  <strong>{collection.title}</strong>
                </button>
                {collection.item && (
                  <>
                    <div className="detail-collection-meta">
                      {collection.item.year && (
                        <span>{collection.item.year}</span>
                      )}
                      {!!collection.item.audioLanguages?.length && (
                        <AudioLanguages
                          languages={collection.item.audioLanguages}
                        />
                      )}
                    </div>
                    <div className="detail-collection-actions">
                      {(['favorite', 'watched'] as const).map((kind) => {
                        const callback =
                          kind === 'favorite' ? onFavorite : onWatched
                        if (!callback) return null
                        const value =
                          collectionPatches[collection.id]?.[kind] ??
                          collection.item?.[kind] ??
                          false
                        return (
                          <Tooltip key={kind}>
                            <button
                              key={kind}
                              className="glass-control"
                              aria-pressed={value}
                              disabled={!!pending}
                              aria-label={`${kind === 'favorite' ? (value ? t('Retirer des favoris') : t('Ajouter aux favoris')) : value ? t('Marquer comme non vu') : t('Marquer comme vu')} : ${collection.title}`}
                              onClick={async () => {
                                setPending('collection-action')
                                setActionError('')
                                try {
                                  await update(collection.item!, kind, !value)
                                } catch {
                                  setActionError(
                                    'La modification n’a pas été enregistrée. Réessaie.',
                                  )
                                } finally {
                                  setPending('')
                                }
                              }}
                            >
                              {kind === 'favorite' ? (
                                <Heart
                                  size={16}
                                  fill={value ? 'currentColor' : 'none'}
                                />
                              ) : (
                                <Check size={16} />
                              )}
                            </button>
                          </Tooltip>
                        )
                      })}
                      {onPlay && (
                        <Tooltip>
                          <button
                            className="glass-control"
                            disabled={!!pending}
                            aria-label={t('Lire la collection : {title}', {
                              title: collection.title,
                            })}
                            onClick={() => void playCollection(collection.id)}
                          >
                            <Play size={16} />
                          </button>
                        </Tooltip>
                      )}
                      <details className="detail-card-menu">
                        <Tooltip>
                          <summary
                            aria-label={t('Plus d’actions : {title}', {
                              title: collection.title,
                            })}
                          >
                            <MoreHorizontal size={16} />
                          </summary>
                        </Tooltip>
                        <div>
                          <button
                            onClick={() =>
                              openBrowser({
                                id: collection.id,
                                title: collection.title,
                                type: 'collection',
                              })
                            }
                          >
                            {t('Parcourir la collection')}
                          </button>
                        </div>
                      </details>
                    </div>
                  </>
                )}
              </div>
            ))}
          </MediaRail>
          {!related?.collections.length && (
            <p className="detail-status">
              {t('Ce titre n’appartient à aucune collection renseignée.')}
            </p>
          )}
        </div>
        <MediaRail
          title={t('Plus de ce genre')}
          count={related?.similar.length ?? 0}
        >
          {related?.similar.map((entry) => (
            <div key={entry.id} className="detail-related-card">
              <MediaTile
                item={entry}
                session={session}
                onSelect={navigate}
                onPlay={onPlay}
                onFavorite={
                  onFavorite ? (i, v) => update(i, 'favorite', v) : undefined
                }
                onWatched={
                  onWatched ? (i, v) => update(i, 'watched', v) : undefined
                }
                footerAction={
                  <details className="detail-card-menu">
                    <Tooltip>
                      <summary
                        aria-label={t('Plus d’actions pour {title}', {
                          title: entry.title,
                        })}
                      >
                        <MoreHorizontal size={18} />
                      </summary>
                    </Tooltip>
                    <div>
                      <button onClick={() => navigate(entry)}>
                        {t('Voir la fiche')}
                      </button>
                      {onPlay && (
                        <button onClick={() => onPlay(entry, false)}>
                          {t('Lire depuis le début')}
                        </button>
                      )}
                    </div>
                  </details>
                }
              />
            </div>
          ))}
        </MediaRail>
        {enabled && relations.isPending && (
          <p role="status" className="detail-status">
            {t('Chargement des titres associés…')}
          </p>
        )}
        {!!related?.errors.length && (
          <p role="alert" className="detail-status">
            {related.errors
              .map((message) =>
                localizeText(t, message, 'Impossible de charger les titres.'),
              )
              .join(' ')}{' '}
            <button onClick={() => void relations.refetch()}>
              {t('Réessayer')}
            </button>
          </p>
        )}
        {!related?.similar.length && !relations.isPending && (
          <p className="detail-status">
            {t('Aucune recommandation disponible.')}
          </p>
        )}
        <footer className="detail-attribution">
          <details>
            <summary>{t('Sources et crédits')}</summary>
            <p>
              {t(
                'Les fiches et images de votre bibliothèque proviennent de votre serveur. Les critiques externes et disponibilités sont fournies par TMDB ; les disponibilités proviennent de JustWatch.',
              )}
            </p>
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                className="detail-tmdb-logo"
                src="/tmdb.svg"
                alt="TMDB"
                width="185"
                height="133"
              />
            </a>
            <p>
              {t(
                'This product uses the TMDB API but is not endorsed or certified by TMDB.',
              )}
            </p>
          </details>
        </footer>
      </div>
    </motion.dialog>
  )
}
