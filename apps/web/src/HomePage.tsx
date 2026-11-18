import { usePerformanceReducedMotion as useReducedMotion } from './performance/PerformanceProvider.tsx'
import { useI18n } from './i18n/I18nProvider.tsx'
import { Tooltip } from './ui/Tooltip.tsx'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, useAnimate } from 'motion/react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Film,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  Search,
} from 'lucide-react'
import type {
  CollectionItem,
  LibraryFilter,
  LibrarySort,
  MediaItem,
} from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { Wordmark } from './ui/Wordmark.tsx'
import { AccountMenu } from './ui/AccountMenu.tsx'
import { MediaTile } from './ui/MediaTile.tsx'
import {
  VirtualMediaGrid,
  CatalogueLoadTrigger,
} from './ui/VirtualMediaGrid.tsx'
import { MediaDetails } from './ui/MediaDetails.tsx'
import { HomeCarousel } from './ui/HomeCarousel.tsx'
import { CatalogueBackdrop } from './ui/CatalogueBackdrop.tsx'
import { SearchBar } from './ui/SearchBar.tsx'
import { SearchResults, type SearchPageData } from './ui/SearchResults.tsx'
import { useCatalogueReturn } from './ui/use-catalogue-return.ts'
import { LibraryTransition } from './ui/LibraryTransition.tsx'
import { LibraryView } from './ui/LibraryView.tsx'
import {
  AnimatedContent,
  GooeyNav,
  ShinyText,
  CountUp,
} from './components/reactbits/Effects.tsx'
import { MotionEnvironment } from './components/reactbits/MotionEnvironment.tsx'
import { ease as curves } from './motion/tokens.ts'
import './home.css'

const ease = curves.out

export type HomePageProps = {
  username: string
  unreadNotifications?: number
  avatarUrl?: string
  isAdmin?: boolean
  session?: JellyfinSession
  userId?: string
  playbackOpen?: boolean
  selectedItem?: MediaItem | null
  onSelectItem?: (item: MediaItem | null) => void
  onFavorite?: (item: MediaItem, favorite: boolean) => Promise<boolean>
  onWatched?: (item: MediaItem, watched: boolean) => Promise<boolean>
  items: MediaItem[]
  resumeItems: MediaItem[]
  state: 'loading' | 'ready' | 'error'
  resumeError?: boolean
  total: number
  filter: LibraryFilter
  search: string
  searchResults?: SearchPageData
  discovery?: React.ReactNode
  collections?: CollectionItem[]
  collectionId?: string
  collection?: CollectionItem
  sort?: LibrarySort
  updatingOrder?: boolean
  onSort?: (sort: LibrarySort) => void
  onCollection?: (id?: string) => void
  hasMore?: boolean
  loadingMore?: boolean
  loadMoreError?: boolean
  signingOut?: boolean
  onFilter: (filter: LibraryFilter) => void
  onSearch: (query: string) => void
  onLoadMore: () => void
  onRetry: () => void
  onPlay?: (item: MediaItem, resume: boolean, queue?: MediaItem[]) => void
  onSignOut: () => void
}

export function HomePage({
  username,
  unreadNotifications,
  avatarUrl,
  isAdmin,
  session,
  userId,
  playbackOpen,
  selectedItem,
  onSelectItem,
  onFavorite,
  onWatched,
  items,
  resumeItems,
  state,
  resumeError,
  total,
  filter,
  search,
  searchResults,
  discovery,
  collections,
  collectionId,
  collection,
  sort,
  updatingOrder,
  onSort,
  onCollection,
  hasMore,
  loadingMore,
  loadMoreError,
  signingOut,
  onFilter,
  onSearch,
  onLoadMore,
  onRetry,
  onSignOut,
  onPlay,
}: HomePageProps) {
  const { t } = useI18n()
  const reduced = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [opening, setOpening] = useState(filter === 'all' && !reduced)
  const [introElapsed, setIntroElapsed] = useState(false)
  const [entranceKey, setEntranceKey] = useState(0)
  const [skipEntrance, setSkipEntrance] = useState(false)
  const animation = useRef<ReturnType<typeof animate> | null>(null)
  const [localSelected, setLocalSelected] = useState<MediaItem | null>(null)
  const selected = selectedItem === undefined ? localSelected : selectedItem
  const catalogueInvoker = useRef<HTMLElement | null>(null)
  const setSelected = useCallback(
    (item: MediaItem | null) => {
      const control = document.activeElement
      if (
        item &&
        control instanceof HTMLElement &&
        control !== document.body &&
        !control.closest('dialog')
      )
        catalogueInvoker.current = control
      const select = onSelectItem ?? setLocalSelected
      select(item)
    },
    [onSelectItem],
  )
  // Starting playback may unmount and later reopen the detail dialog. Keep
  // the original grid/rail control until that entire round trip has ended.
  useLayoutEffect(() => {
    if (selected || playbackOpen || !catalogueInvoker.current) return
    const control = catalogueInvoker.current
    catalogueInvoker.current = null
    if (control.isConnected && !document.querySelector('dialog[open]'))
      control.focus({ preventScroll: true })
  }, [selected, playbackOpen])
  const [backgroundPaused, setBackgroundPaused] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const searchActive = searchFocused || Boolean(search.trim())
  const closeSearch = () => {
    setSearchFocused(false)
    onSearch('')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const resumeRail = useRef<HTMLDivElement>(null)
  const scrollResumeRail = (direction: -1 | 1) => {
    const rail = resumeRail.current
    if (!rail) return
    const first = rail.firstElementChild
    const second = first?.nextElementSibling
    if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement))
      return
    rail.scrollBy({
      left: direction * (second.offsetLeft - first.offsetLeft),
      behavior: reduced ? 'instant' : 'smooth',
    })
  }
  const content = useRef<HTMLElement>(null)
  const rememberPlace = useCatalogueReturn(
    content,
    filter + '/' + (collectionId ?? ''),
  )
  const featured = items[0]
  const browsing = filter !== 'all'
  const finishOpening = useCallback(() => {
    animation.current?.complete()
    setSkipEntrance(true)
    setOpening(false)
  }, [])
  const playItem = useCallback(
    (item: MediaItem, resume: boolean) => {
      finishOpening()
      onPlay?.(item, resume)
    },
    [finishOpening, onPlay],
  )

  useLayoutEffect(() => {
    if (!opening) return
    if (reduced) {
      // The OS preference can change during the running entrance.
      // oxlint-disable-next-line react/set-state-in-effect
      setOpening(false)
      return
    }
    let active = true
    const controls = animate([
      [
        '.home-intro-frame',
        {
          opacity: [0, 0.7],
          transform: ['scale(.94)', 'scale(1.015)'],
        },
        { duration: 0.4, at: 0, ease },
      ],
      [
        '.home-aperture',
        {
          transform: ['rotate(-12deg) scaleX(.08)', 'rotate(5deg) scaleX(1)'],
          opacity: [0, 0.85],
        },
        { duration: 0.42, at: 0, ease },
      ],
      [
        '.home-intro-bloom',
        { opacity: [0, 0.65], transform: ['scale(.65)', 'scale(1.2)'] },
        { duration: 0.42, at: 0, ease },
      ],
      [
        '.home-topbar',
        {
          transform: ['translateY(-12px)', 'translateY(0px)'],
          opacity: [0.35, 1],
        },
        { duration: 0.42, at: 0, ease },
      ],
    ])
    animation.current = controls
    void controls.then(() => {
      if (active) setIntroElapsed(true)
    })
    const onHidden = () => {
      if (document.hidden) controls.complete()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      active = false
      controls.stop()
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [opening, reduced, animate])

  useLayoutEffect(() => {
    if (!opening || !introElapsed) return
    let active = true
    // The hero starts on this same render, while the light finishes its sweep.
    const exit = animate([
      [
        '.home-aperture',
        { opacity: 0, transform: 'rotate(5deg) scaleX(1.2)' },
        { duration: 0.3, at: 0, ease },
      ],
      [
        '.home-intro-frame',
        { opacity: 0, transform: 'scale(1.04)' },
        { duration: 0.3, at: 0, ease },
      ],
      [
        '.home-intro-bloom',
        { opacity: 0, transform: 'scale(1.4)' },
        { duration: 0.3, at: 0, ease },
      ],
    ])
    void exit.then(() => {
      if (active) setOpening(false)
    })
    return () => {
      active = false
      exit.stop()
    }
  }, [opening, introElapsed, animate])

  function changeFilter(next: LibraryFilter) {
    if (next === filter && !searchActive && !collectionId) return
    finishOpening()
    setSearchFocused(false)
    rememberPlace()
    onFilter(next)
    onSearch('')
  }

  const previousPage = useRef({ filter, collectionId })
  useLayoutEffect(() => {
    const previous = previousPage.current
    previousPage.current = { filter, collectionId }
    // Mount already has the browser's scroll position. An unconditional
    // scrollTo(0) here forced layout of the whole page during the intro.
    if (previous.filter === filter && previous.collectionId === collectionId)
      return
    // Browser Back/Forward must also leave the previous page's expanded search.
    // oxlint-disable-next-line react/set-state-in-effect
    setSearchFocused(false)
  }, [filter, collectionId])

  const pageOrder = [
    'all',
    'favorites',
    'movies',
    'series',
    'collections',
  ].indexOf(filter)
  const browseView =
    filter !== 'all' ? (
      <LibraryView
        page={filter}
        items={items}
        collections={collections}
        collectionId={collectionId}
        collection={collection}
        resumeItems={resumeItems}
        state={state}
        total={total}
        sort={sort}
        updatingOrder={updatingOrder}
        search={search}
        session={session}
        hasMore={hasMore}
        loadingMore={loadingMore}
        loadMoreError={loadMoreError}
        paused={!!selected || !!playbackOpen}
        onSort={onSort}
        onCollection={(id) => {
          setSearchFocused(false)
          rememberPlace(!id)
          onCollection?.(id)
        }}
        onNavigate={changeFilter}
        onSelect={setSelected}
        onPlay={onPlay ? playItem : undefined}
        onFavorite={onFavorite}
        onWatched={onWatched}
        onLoadMore={onLoadMore}
        onRetry={onRetry}
      />
    ) : null

  return (
    <MotionEnvironment
      paused={backgroundPaused || !!playbackOpen || !!selected || searchActive}
    >
      <div
        ref={scope}
        className="home-page"
        data-opening={opening}
        inert={playbackOpen}
        onKeyDown={(event) => {
          if (
            event.key === 'Escape' &&
            searchActive &&
            !selected &&
            !playbackOpen
          ) {
            event.preventDefault()
            closeSearch()
            scope.current
              .querySelector<HTMLButtonElement>(
                '.rb-gooey-nav button[aria-current]',
              )
              ?.focus()
          }
        }}
      >
        <CatalogueBackdrop
          paused={
            backgroundPaused || !!selected || !!playbackOpen || searchActive
          }
        />
        <div className="home-page-content">
          <a className="home-skip" href="#home-main">
            {t('Aller au catalogue')}
          </a>
          <header className="home-topbar" data-search={searchActive}>
            <a
              className="home-brand"
              href="/app"
              onClick={(event) => {
                if (
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault()
                  changeFilter('all')
                }
              }}
              aria-label={t('HollyFilms, accueil')}
            >
              <Wordmark compact />
              <span>
                <ShinyText>3.0</ShinyText>
              </span>
            </a>
            <GooeyNav
              items={[
                { value: 'all', label: t('Accueil') },
                { value: 'favorites', label: t('Favoris') },
                { value: 'movies', label: t('Films') },
                { value: 'series', label: t('Séries') },
                { value: 'collections', label: t('Collections') },
              ]}
              value={filter}
              onChange={changeFilter}
            />
            <div className="home-tools">
              <SearchBar
                scopeLabel={
                  filter === 'favorites'
                    ? t('Rechercher dans vos favoris')
                    : filter === 'collections'
                      ? collectionId
                        ? t('Rechercher dans cette collection')
                        : t('Rechercher une collection')
                      : filter === 'movies'
                        ? t('Rechercher parmi vos films')
                        : filter === 'series'
                          ? t('Rechercher parmi vos séries')
                          : t('Films & séries de votre bibliothèque')
                }
                value={search}
                expanded={searchActive}
                loading={
                  searchResults?.state === 'loading' &&
                  !selected &&
                  !playbackOpen
                }
                onChange={onSearch}
                onExpand={() => {
                  finishOpening()
                  setSearchFocused(true)
                }}
                onClose={closeSearch}
              />
              <AccountMenu
                username={username}
                unreadNotifications={unreadNotifications}
                avatarUrl={avatarUrl}
                isAdmin={isAdmin}
              />
              <Tooltip>
                <button
                  type="button"
                  className="home-icon-button"
                  aria-label={
                    signingOut ? t('Déconnexion en cours') : t('Se déconnecter')
                  }
                  disabled={signingOut}
                  onClick={onSignOut}
                >
                  <LogOut size={17} />
                </button>
              </Tooltip>
            </div>
          </header>

          <main id="home-main" ref={content} tabIndex={-1}>
            <LibraryTransition
              pageKey={`${filter}:${collectionId ?? ''}:${searchActive ? 'search' : 'page'}`}
              order={
                pageOrder + (collectionId ? 0.4 : 0) + (searchActive ? 0.1 : 0)
              }
            >
              {filter === 'collections' && !collectionId ? (
                browseView
              ) : searchActive ? (
                <SearchResults
                  query={search}
                  discovery={discovery}
                  results={
                    search.trim()
                      ? (searchResults ?? {
                          items,
                          total,
                          state,
                          hasMore,
                          loadingMore,
                          loadMoreError,
                          onLoadMore,
                          onRetry,
                        })
                      : {
                          items: items.slice(0, 12),
                          total: Math.min(12, items.length),
                          state,
                          onLoadMore,
                          onRetry,
                        }
                  }
                  paused={!!selected || !!playbackOpen}
                  session={session}
                  onSelect={setSelected}
                  onPlay={onPlay ? playItem : undefined}
                  onFavorite={onFavorite}
                  onWatched={onWatched}
                />
              ) : browsing ? (
                browseView
              ) : (
                <>
                  {!featured && state === 'loading' ? (
                    <section
                      className="home-hero home-carousel home-hero-pending"
                      aria-label={t('Chargement de la sélection à l’affiche')}
                      aria-busy="true"
                    >
                      <div className="home-hero-shade" />
                      <div className="home-hero-copy">
                        <p className="home-eyebrow">
                          <span />
                          {t('À L’AFFICHE')}
                        </p>
                        <div
                          className="hero-pending-title"
                          aria-hidden="true"
                        />
                        <div className="hero-pending-meta" aria-hidden="true" />
                        <div className="hero-pending-copy" aria-hidden="true" />
                        <p className="sr-only" role="status">
                          {t('Chargement de votre sélection…')}
                        </p>
                      </div>
                    </section>
                  ) : featured ? (
                    <HomeCarousel
                      items={items}
                      session={session}
                      userId={userId}
                      active={!selected && !playbackOpen && !backgroundPaused}
                      reveal
                      entranceKey={entranceKey}
                      skipEntrance={skipEntrance}
                      onSelect={(item) => {
                        finishOpening()
                        setSelected(item)
                      }}
                      onPlay={onPlay ? playItem : undefined}
                      onFavorite={onFavorite}
                    />
                  ) : (
                    <section className="home-hero" aria-labelledby="home-title">
                      <div className="home-hero-media" aria-hidden="true" />
                      <div className="home-hero-shade" />
                      <div className="home-hero-copy">
                        <p className="home-eyebrow">
                          <span />
                          {t('VOTRE BIBLIOTHÈQUE')}
                        </p>
                        <h1 id="home-title">{t('Votre bibliothèque.')}</h1>
                        <p className="home-synopsis">
                          {state === 'loading'
                            ? t('Chargement de vos films et séries…')
                            : state === 'error'
                              ? t(
                                  'La bibliothèque est momentanément indisponible.',
                                )
                              : t(
                                  'Les titres de vos bibliothèques apparaîtront ici.',
                                )}
                        </p>
                      </div>
                    </section>
                  )}

                  <div className="home-content">
                    {resumeItems.length > 0 && (
                      <AnimatedContent>
                        <section
                          className="home-resume"
                          aria-labelledby="resume-title"
                        >
                          <div className="home-section-header">
                            <div>
                              <p className="home-section-kicker">
                                {t('LA SUITE VOUS ATTEND')}
                              </p>
                              <h2 id="resume-title">
                                {t('En cours de lecture')}
                                <span>{resumeItems.length}</span>
                              </h2>
                            </div>
                            <div className="home-rail-controls">
                              <Tooltip>
                                <button
                                  type="button"
                                  aria-label={t('Titres en cours précédents')}
                                  onClick={() => scrollResumeRail(-1)}
                                >
                                  <ChevronLeft size={19} />
                                </button>
                              </Tooltip>
                              <Tooltip>
                                <button
                                  type="button"
                                  aria-label={t('Titres en cours suivants')}
                                  onClick={() => scrollResumeRail(1)}
                                >
                                  <ChevronRight size={19} />
                                </button>
                              </Tooltip>
                            </div>
                          </div>
                          <div className="home-resume-rail" ref={resumeRail}>
                            {resumeItems.map((item) => (
                              <MediaTile
                                key={item.id}
                                item={item}
                                session={session}
                                wide
                                onSelect={setSelected}
                                onPlay={onPlay ? playItem : undefined}
                                onFavorite={onFavorite}
                                onWatched={onWatched}
                              />
                            ))}
                          </div>
                        </section>
                      </AnimatedContent>
                    )}
                    {resumeError && (
                      <div className="home-inline-error" role="status">
                        {t('La reprise de lecture est indisponible.')}
                        <button type="button" onClick={onRetry}>
                          {t('Réessayer')}
                        </button>
                      </div>
                    )}
                    <section
                      className="home-catalogue"
                      id="home-catalogue"
                      aria-labelledby="catalogue-title"
                      aria-busy={state === 'loading'}
                    >
                      <div className="home-section-header">
                        <div>
                          <p className="home-section-kicker">
                            {t('À DÉCOUVRIR')}
                          </p>
                          <h2 id="catalogue-title">
                            {t('Ajouts récents')}
                            {state === 'ready' && (
                              <span>
                                <CountUp value={total} />
                              </span>
                            )}
                          </h2>
                        </div>
                        <span className="home-sort">
                          {t('Les plus récents d’abord')}
                        </span>
                      </div>
                      {state === 'loading' ? (
                        <div className="home-loading" role="status">
                          <span>{t('Chargement du catalogue…')}</span>
                          <div className="home-grid" aria-hidden="true">
                            {Array.from({ length: 6 }, (_, i) => (
                              <div key={i} className="home-skeleton" />
                            ))}
                          </div>
                        </div>
                      ) : state === 'error' ? (
                        <div className="home-empty" role="alert">
                          <Film size={30} />
                          <h3>{t('Impossible de charger le catalogue.')}</h3>
                          <p>{t('Réessayez dans un instant.')}</p>
                          <button
                            type="button"
                            className="home-primary"
                            onClick={onRetry}
                          >
                            {t('Réessayer')}
                            <RotateCcw size={16} />
                          </button>
                        </div>
                      ) : items.length === 0 ? (
                        <div className="home-empty" role="status">
                          <Search size={30} />
                          <h3>{t('La bibliothèque est encore vide.')}</h3>
                          <p>
                            {t(
                              'Les films et séries accessibles à votre compte apparaîtront ici.',
                            )}
                          </p>
                        </div>
                      ) : (
                        <>
                          <VirtualMediaGrid
                            key={filter}
                            items={items}
                            total={total}
                            session={session}
                            onSelect={setSelected}
                            onPlay={onPlay ? playItem : undefined}
                            onFavorite={onFavorite}
                            onWatched={onWatched}
                          />
                          <CatalogueLoadTrigger
                            key={'load-' + filter}
                            count={items.length}
                            hasMore={hasMore}
                            loading={loadingMore}
                            error={loadMoreError}
                            paused={!!selected || !!playbackOpen}
                            onLoadMore={onLoadMore}
                          />
                          {loadMoreError && (
                            <p className="home-inline-error" role="alert">
                              {t(
                                'La suite du catalogue n’a pas pu être chargée.',
                              )}
                            </p>
                          )}
                          {hasMore && (
                            <button
                              type="button"
                              className="home-more glass-control"
                              disabled={loadingMore}
                              onClick={onLoadMore}
                            >
                              {loadingMore
                                ? t('Chargement…')
                                : loadMoreError
                                  ? t('Réessayer')
                                  : t('Afficher plus de titres')}
                              <ArrowRight size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </section>
                    <footer className="home-footer">
                      <span>
                        HOLLYFILMS <strong>3.0</strong>
                      </span>
                      <span>{t('Votre bibliothèque. Votre rythme.')}</span>
                      {!reduced && (
                        <button
                          type="button"
                          aria-pressed={backgroundPaused}
                          onClick={() => setBackgroundPaused((value) => !value)}
                        >
                          {backgroundPaused ? (
                            <Play size={13} />
                          ) : (
                            <Pause size={13} />
                          )}
                          {backgroundPaused
                            ? t('Animer le fond')
                            : t('Mettre le fond en pause')}
                        </button>
                      )}
                      {!reduced && (
                        <button
                          type="button"
                          onClick={() => {
                            window.scrollTo({ top: 0, behavior: 'instant' })
                            setSkipEntrance(false)
                            setIntroElapsed(false)
                            setEntranceKey((value) => value + 1)
                            setOpening(true)
                          }}
                        >
                          <RotateCcw size={13} />
                          {t('Revoir l’ouverture')}
                        </button>
                      )}
                    </footer>
                  </div>
                </>
              )}
            </LibraryTransition>
          </main>
          {!playbackOpen && (
            <AnimatePresence>
              {selected && (
                <MediaDetails
                  key={selected.id}
                  item={selected}
                  session={session}
                  userId={userId}
                  onSelect={setSelected}
                  onFavorite={onFavorite}
                  onWatched={onWatched}
                  onPlay={
                    onPlay
                      ? (item, resume, queue) => {
                          if (!onSelectItem) setSelected(null)
                          onPlay(item, resume, queue)
                        }
                      : undefined
                  }
                  onClose={() => setSelected(null)}
                />
              )}
            </AnimatePresence>
          )}
        </div>
        {opening && (
          <div className="home-intro">
            <div className="home-intro-frame" aria-hidden="true" />
            <div className="home-intro-bloom" aria-hidden="true" />
            <div className="home-aperture" aria-hidden="true" />
          </div>
        )}
      </div>
    </MotionEnvironment>
  )
}
