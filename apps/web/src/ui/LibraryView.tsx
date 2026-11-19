import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Select } from './Select.tsx'
import { motion, useIsPresent } from 'motion/react'
import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Film,
  Heart,
  Layers3,
  Play,
  Tv,
  RotateCcw,
  ListFilter,
} from 'lucide-react'
import type {
  CollectionItem,
  LibraryFilter,
  LibrarySort,
  MediaItem,
} from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { MediaArtwork } from './MediaArtwork.tsx'
import { ArtworkPreview } from './ArtworkPreview.tsx'
import { ArtworkWatermark } from './ArtworkWatermark.tsx'
import { CardVideoPreview } from './CardVideoPreview.tsx'
import { MediaTile } from './MediaTile.tsx'
import { HorizontalRail } from './HorizontalRail.tsx'
import { VirtualMediaGrid, CatalogueLoadTrigger } from './VirtualMediaGrid.tsx'
import { distance, duration, ease, staggerDelay } from '../motion/tokens.ts'
import './library-pages.css'

export type LibraryViewProps = {
  page: Exclude<LibraryFilter, 'all'>
  items: MediaItem[]
  collections?: CollectionItem[]
  collectionId?: string
  collection?: CollectionItem
  resumeItems: MediaItem[]
  state: 'loading' | 'error' | 'ready'
  total: number
  sort?: LibrarySort
  updatingOrder?: boolean
  search?: string
  session?: JellyfinSession
  userId?: string
  hasMore?: boolean
  loadingMore?: boolean
  loadMoreError?: boolean
  paused?: boolean
  onSort?: (sort: LibrarySort) => void
  onCollection?: (id?: string) => void
  onNavigate: (page: LibraryFilter) => void
  onSelect: (item: MediaItem) => void
  onPlay?: (item: MediaItem, resume: boolean) => void
  onFavorite?: (item: MediaItem, favorite: boolean) => Promise<boolean>
  onWatched?: (item: MediaItem, watched: boolean) => Promise<boolean>
  onLoadMore: () => void
  onRetry: () => void
}

export function LibraryView({
  page,
  items,
  collections = [],
  collectionId,
  collection,
  resumeItems,
  state,
  total,
  sort = 'recent',
  updatingOrder = false,
  search = '',
  session,
  userId,
  hasMore,
  loadingMore,
  loadMoreError,
  paused,
  onSort,
  onCollection,
  onNavigate,
  onSelect,
  onPlay,
  onFavorite,
  onWatched,
  onLoadMore,
  onRetry,
}: LibraryViewProps) {
  const { t, locale } = useI18n()
  const reduced = useReducedMotion()
  const present = useIsPresent()
  const featured = items.find((item) => item.backdrop) ?? items[0]
  const collectionIndex = page === 'collections' && !collectionId
  const ready = state === 'ready'
  const episodes = resumeItems
    .filter((item) => item.kind === 'Épisode')
    .slice(0, 6)
  const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: reduced ? 0 : distance.panel },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduced ? 0.08 : duration.scene,
      delay: reduced ? 0 : Math.min(delay, staggerDelay(4)),
      ease: ease.out,
    },
  })
  const featuredCard = featured && (page === 'movies' || page === 'series') && (
    <motion.div
      className={
        page === 'movies' ? 'library-film-feature' : 'library-series-feature'
      }
      {...reveal(0.12)}
    >
      <ArtworkPreview
        title={featured.title}
        presentation="cinema"
        watermark={<ArtworkWatermark />}
        titleLogo={featured.logo}
        session={session}
        headingLevel={2}
        selectLabel={featured.title}
        mediaId={featured.id}
        hoverVideo={
          session &&
          userId && (
            <CardVideoPreview
              key={featured.id}
              item={featured}
              session={session}
              userId={userId}
            />
          )
        }
        triggerClassName="media-tile-select"
        wide
        onSelect={() => onSelect(featured)}
        artwork={
          <MediaArtwork
            source={featured.backdrop ?? featured.poster}
            session={session}
            width={960}
            eager
          />
        }
        previewImage={{
          source: featured.backdrop ?? featured.poster,
          compactWidth: 960,
        }}
      >
        <div className="library-featured-copy">
          <div className="library-feature-actions">
            {page === 'movies' && onPlay && (
              <button
                type="button"
                className="home-primary"
                data-artwork-open="player"
                onClick={() => onPlay(featured, featured.progress > 0)}
              >
                <Play size={16} fill="currentColor" />{' '}
                {featured.progress > 0 ? t('Reprendre') : t('Lire')}
              </button>
            )}
            <button
              type="button"
              className="library-outline-button"
              data-artwork-open="details"
              onClick={() => onSelect(featured)}
            >
              {t('Voir la fiche')} <ArrowUpRight size={16} />
            </button>
          </div>
          <small>
            {t(featured.kind)}
            {featured.year && ` · ${featured.year}`}
          </small>
          {featured.overview && <p>{featured.overview}</p>}
        </div>
      </ArtworkPreview>
    </motion.div>
  )
  const gridTitle = collectionId
    ? t('Dans cette collection')
    : page === 'favorites'
      ? t('Votre sélection')
      : page === 'movies'
        ? t('Tous les films')
        : page === 'series'
          ? t('Toutes les séries')
          : t('Toutes les collections')
  return (
    <div className={`library-view library-view-${page}`}>
      {page === 'favorites' && (
        <header className="library-favorites-intro">
          <div className="library-page-heading">
            <motion.p className="library-kicker" {...reveal()}>
              <Heart size={15} /> {t('VOTRE SÉLECTION PERSONNELLE')}
            </motion.p>
            <motion.h1 {...reveal(0.05)}>
              {t('Vos favoris')}
              <span>.</span>
            </motion.h1>
            <motion.p className="library-lead" {...reveal(0.1)}>
              {t('Les films et séries que vous avez gardés à portée de main.')}
            </motion.p>
            {ready && (
              <motion.span className="library-total" {...reveal(0.15)}>
                <strong>{total.toLocaleString(locale)}</strong>{' '}
                {total === 1 ? t('titre enregistré') : t('titres enregistrés')}
              </motion.span>
            )}
          </div>
          <motion.div
            className="library-favorite-art"
            aria-hidden="true"
            {...reveal(0.1)}
          >
            {items.slice(0, 3).map((item, i) => (
              <div
                key={item.id}
                style={{ '--poster-order': i } as CSSProperties}
              >
                <MediaArtwork
                  source={item.poster}
                  session={session}
                  width={400}
                />
              </div>
            ))}
            {!items.length && <Heart size={100} strokeWidth={0.6} />}
          </motion.div>
        </header>
      )}

      {page === 'movies' && (
        <header className="library-movies-intro">
          <div className="library-page-heading">
            <motion.p className="library-kicker" {...reveal()}>
              <Film size={15} /> {t('GRAND ÉCRAN')}
            </motion.p>
            <motion.h1 {...reveal(0.05)}>
              {t('Les films')}
              <span>.</span>
            </motion.h1>
            <motion.p className="library-lead" {...reveal(0.1)}>
              {t('Tout votre cinéma, dans une seule bibliothèque.')}
            </motion.p>
            {ready && (
              <motion.span className="library-total" {...reveal(0.15)}>
                <strong>{total.toLocaleString(locale)}</strong>{' '}
                {total === 1 ? t('film disponible') : t('films disponibles')}
              </motion.span>
            )}
          </div>
          {featuredCard}
        </header>
      )}

      {page === 'series' && (
        <>
          <header className="library-series-intro">
            <div className="library-page-heading">
              <motion.p className="library-kicker" {...reveal()}>
                <Tv size={15} /> {t('ÉPISODE APRÈS ÉPISODE')}
              </motion.p>
              <motion.h1 {...reveal(0.05)}>
                {t('Les séries')}
                <span>.</span>
              </motion.h1>
              <motion.p className="library-lead" {...reveal(0.1)}>
                {t('Retrouvez vos séries et reprenez là où vous en étiez.')}
              </motion.p>
              {ready && (
                <motion.span className="library-total" {...reveal(0.15)}>
                  <strong>{total.toLocaleString(locale)}</strong>{' '}
                  {total === 1
                    ? t('série disponible')
                    : t('séries disponibles')}
                </motion.span>
              )}
            </div>
            {featuredCard}
          </header>
          {episodes.length > 0 && (
            <motion.section
              className="library-episodes"
              aria-labelledby="series-resume-title"
              {...reveal(0.18)}
            >
              <div className="library-section-heading">
                <div>
                  <p className="library-kicker">{t('EN COURS')}</p>
                  <h2 id="series-resume-title">{t('Reprendre un épisode')}</h2>
                </div>
                <span>
                  {episodes.length} {t('en cours')}
                </span>
              </div>
              <HorizontalRail
                trackClassName="library-episode-rail"
                previousLabel={t('Titres en cours précédents')}
                nextLabel={t('Titres en cours suivants')}
              >
                {episodes.map((item) => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    session={session}
                    userId={userId}
                    wide
                    onSelect={onSelect}
                    onPlay={onPlay}
                    onFavorite={onFavorite}
                    onWatched={onWatched}
                  />
                ))}
              </HorizontalRail>
            </motion.section>
          )}
        </>
      )}

      {page === 'collections' && (
        <header
          className={`library-collections-intro ${collectionId ? 'is-collection' : ''}`}
        >
          {collectionId && collection?.backdrop && (
            <div className="library-collection-backdrop" aria-hidden="true">
              <MediaArtwork
                source={collection.backdrop}
                session={session}
                width={1600}
                eager
              />
            </div>
          )}
          <div className="library-page-heading">
            {collectionId && (
              <button
                className="library-back-button"
                onClick={() => onCollection?.()}
              >
                <ArrowLeft size={16} /> {t('Toutes les collections')}
              </button>
            )}
            <motion.p className="library-kicker" {...reveal()}>
              <Layers3 size={16} />{' '}
              {collectionId ? t('LA COLLECTION') : t('VOTRE CINÉMATHÈQUE')}
            </motion.p>
            <motion.h1 {...reveal(0.05)}>
              {collectionId
                ? (collection?.title ?? t('Collection'))
                : search.trim()
                  ? t('Collections trouvées')
                  : t('Les collections')}
              <span>.</span>
            </motion.h1>
            <motion.p className="library-lead" {...reveal(0.1)}>
              {collectionId
                ? collection?.overview
                : search.trim()
                  ? t('Résultats pour « {query} »', { query: search.trim() })
                  : t('Sagas, trilogies et univers réunis au même endroit.')}
            </motion.p>
            {ready && (
              <motion.span className="library-total" {...reveal(0.15)}>
                <strong>{total.toLocaleString(locale)}</strong>{' '}
                {collectionId
                  ? total === 1
                    ? t('titre')
                    : t('titres')
                  : total === 1
                    ? t('collection')
                    : t('collections')}
              </motion.span>
            )}
          </div>
          {!collectionId && (
            <div className="library-collection-emblem" aria-hidden="true">
              <Layers3 size={90} strokeWidth={0.7} />
              <span>{t('HOLLYFILMS / COLLECTIONS')}</span>
            </div>
          )}
        </header>
      )}

      <section
        className="library-browse"
        aria-labelledby="library-grid-title"
        aria-busy={state === 'loading' || updatingOrder}
      >
        <motion.div className="library-section-heading" {...reveal(0.14)}>
          <div>
            <p className="library-kicker">
              {page === 'favorites'
                ? t('CHOISIS PAR VOUS')
                : collectionIndex
                  ? t('LES UNIVERS DU CATALOGUE')
                  : t('EXPLORER')}
            </p>
            <h2 id="library-grid-title">{gridTitle}</h2>
          </div>
          {!collectionIndex && onSort ? (
            <label className="library-sort" data-updating={updatingOrder}>
              {updatingOrder && (
                <span className="sr-only" role="status">
                  {t('Chargement des titres…')}
                </span>
              )}
              <ListFilter size={16} />
              <span className="sr-only">{t('Trier les titres')}</span>
              <Select
                aria-label={t('Trier les titres')}
                value={sort}
                onValueChange={(value) => onSort(value as LibrarySort)}
              >
                <option value="recent">{t('Ajouts récents')}</option>
                <option value="title">{t('Titre A–Z')}</option>
                <option value="rating">{t('Mieux notés')}</option>
                <option value="year">{t('Année de sortie')}</option>
              </Select>
            </label>
          ) : (
            <span className="library-sort-caption">
              {collectionIndex ? t('Classées de A à Z') : t('Ajouts récents')}
            </span>
          )}
        </motion.div>
        {state === 'loading' ? (
          <div className="library-loading" role="status">
            <span>
              {t(
                collectionIndex
                  ? 'Chargement des collections…'
                  : 'Chargement des titres…',
              )}
            </span>
            <div
              className={collectionIndex ? 'collection-gallery' : 'home-grid'}
              aria-hidden="true"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  className={
                    collectionIndex ? 'collection-skeleton' : 'home-skeleton'
                  }
                  key={i}
                />
              ))}
            </div>
          </div>
        ) : state === 'error' ? (
          <div className="library-empty" role="alert">
            <RotateCcw size={30} />
            <h3>{t('Chargement indisponible')}</h3>
            <p>{t('Votre bibliothèque n’a pas pu être chargée.')}</p>
            <button className="home-primary" onClick={onRetry}>
              {t('Réessayer')}
            </button>
          </div>
        ) : !(collectionIndex ? collections.length : items.length) ? (
          <motion.div className="library-empty" role="status" {...reveal()}>
            {page === 'favorites' ? (
              <Heart size={32} />
            ) : collectionIndex ? (
              <Layers3 size={32} />
            ) : (
              <Film size={32} />
            )}
            <h3>
              {page === 'favorites'
                ? t('Vos prochains coups de cœur vous attendent.')
                : search.trim()
                  ? t('Aucune collection ne correspond.')
                  : collectionIndex
                    ? t('Aucune collection pour le moment.')
                    : collectionId
                      ? t('Cette collection est vide.')
                      : t('Aucun titre pour le moment.')}
            </h3>
            <p>
              {page === 'favorites'
                ? t(
                    'Utilisez le cœur sur un film ou une série pour le retrouver ici.',
                  )
                : collectionIndex
                  ? t(
                      'Les collections accessibles avec votre compte apparaîtront ici.',
                    )
                  : t(
                      'Les titres accessibles avec votre compte apparaîtront ici.',
                    )}
            </p>
            {page === 'favorites' && (
              <button
                className="home-primary"
                onClick={() => onNavigate('movies')}
              >
                {t('Explorer les films')} <ArrowUpRight size={17} />
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={collectionIndex ? 'collection-results' : 'media-results'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0.1 : 0.35 }}
          >
            {collectionIndex ? (
              <div className="collection-gallery">
                {collections.map((item, index) => (
                  <motion.div
                    key={item.id}
                    data-collection-id={item.id}
                    initial={
                      reduced ? false : { opacity: 0, y: distance.panel }
                    }
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '80px' }}
                    transition={{
                      duration: reduced ? 0 : duration.scene,
                      delay: reduced ? 0 : staggerDelay(index % 4),
                      ease: ease.out,
                    }}
                  >
                    <ArtworkPreview
                      className="collection-card"
                      triggerClassName="collection-trigger"
                      title={item.title}
                      cinematic
                      titleLogo={item.logo}
                      session={session}
                      selectLabel={item.title}
                      wide
                      artwork={
                        <MediaArtwork
                          source={item.backdrop ?? item.poster}
                          session={session}
                          width={720}
                        />
                      }
                      previewImage={{
                        source: item.backdrop ?? item.poster,
                        compactWidth: 720,
                      }}
                      onSelect={() => onCollection?.(item.id)}
                    >
                      <div className="collection-card-copy">
                        <button
                          type="button"
                          data-preview-select
                          onClick={() => onCollection?.(item.id)}
                          className="glass-control"
                        >
                          {t('Explorer')} <ArrowUpRight size={16} />
                        </button>
                        <small>
                          {t('COLLECTION')}
                          {item.count != null
                            ? ` · ${item.count} ${item.count === 1 ? t('TITRE') : t('TITRES')}`
                            : ''}
                        </small>
                        {item.overview && <p>{item.overview}</p>}
                      </div>
                    </ArtworkPreview>
                  </motion.div>
                ))}
              </div>
            ) : (
              <VirtualMediaGrid
                items={items}
                total={total}
                session={session}
                userId={userId}
                onSelect={onSelect}
                onPlay={onPlay}
                onFavorite={onFavorite}
                onWatched={onWatched}
              />
            )}
            <CatalogueLoadTrigger
              count={collectionIndex ? collections.length : items.length}
              hasMore={hasMore}
              loading={loadingMore}
              error={loadMoreError}
              paused={paused || !present}
              onLoadMore={onLoadMore}
            />
            {loadMoreError && (
              <p className="home-inline-error" role="alert">
                {t('La suite n’a pas pu être chargée.')}
              </p>
            )}
            {hasMore && (
              <button
                className="home-more glass-control"
                disabled={loadingMore}
                onClick={onLoadMore}
              >
                {loadingMore
                  ? t('Chargement…')
                  : loadMoreError
                    ? t('Réessayer')
                    : collectionIndex
                      ? t('Afficher plus de collections')
                      : t('Afficher plus de titres')}
                <ArrowUpRight size={17} />
              </button>
            )}
          </motion.div>
        )}
      </section>
      <footer className="library-footer">
        <span>
          HOLLYFILMS <strong>3.0</strong>
        </span>
        <span>
          {page === 'favorites'
            ? t('VOTRE SÉLECTION')
            : page === 'movies'
              ? t('FILMS')
              : page === 'series'
                ? t('SÉRIES')
                : t('COLLECTIONS')}
        </span>
      </footer>
    </div>
  )
}
