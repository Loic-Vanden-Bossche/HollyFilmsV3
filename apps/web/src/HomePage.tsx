import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
} from 'motion/react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Film,
  LogOut,
  Menu,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { LibraryFilter, MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { Wordmark } from './ui/Wordmark.tsx'
import { MediaArtwork } from './ui/MediaArtwork.tsx'
import { MediaTile } from './ui/MediaTile.tsx'
import { DeferredMediaTile } from './ui/DeferredMediaTile.tsx'
import { MediaDetails } from './ui/MediaDetails.tsx'
import { HomeCarousel } from './ui/HomeCarousel.tsx'
import { CatalogueBackdrop } from './ui/CatalogueBackdrop.tsx'
import {
  AnimatedContent,
  GooeyNav,
  ShinyText,
  CountUp,
} from './components/reactbits/Effects.tsx'
import {
  FlowingMenu,
  StaggeredMenu,
} from './components/reactbits/ImmersiveMenu.tsx'
import { MotionEnvironment } from './components/reactbits/MotionEnvironment.tsx'
import './home.css'

const ease = [0.22, 1, 0.36, 1] as const

export type HomePageProps = {
  username: string
  isAdmin?: boolean
  session?: JellyfinSession
  userId?: string
  playbackOpen?: boolean
  onFavorite?: (item: MediaItem, favorite: boolean) => Promise<boolean>
  onWatched?: (item: MediaItem, watched: boolean) => Promise<boolean>
  items: MediaItem[]
  resumeItems: MediaItem[]
  state: 'loading' | 'ready' | 'error'
  resumeError?: boolean
  total: number
  filter: LibraryFilter
  search: string
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
  isAdmin,
  session,
  userId,
  playbackOpen,
  onFavorite,
  onWatched,
  items,
  resumeItems,
  state,
  resumeError,
  total,
  filter,
  search,
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
  const reduced = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [opening, setOpening] = useState(!reduced)
  const [entranceKey, setEntranceKey] = useState(0)
  const [skipEntrance, setSkipEntrance] = useState(false)
  const animation = useRef<ReturnType<typeof animate> | null>(null)
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [backgroundPaused, setBackgroundPaused] = useState(false)
  const resumeRail = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLElement>(null)
  const featured = items.find((item) => item.backdrop) ?? items[0]
  const browsing = filter !== 'all' || search.trim().length > 0
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
          opacity: [0, 0.7, 0],
          transform: ['scale(.94)', 'scale(1.015)', 'scale(1.04)'],
        },
        { duration: 1.2, at: 0, ease },
      ],
      [
        '.home-aperture',
        {
          transform: ['rotate(-12deg) scaleX(.08)', 'rotate(5deg) scaleX(1.2)'],
          opacity: [0, 0.85, 0],
        },
        { duration: 1.1, at: 0, ease },
      ],
      [
        '.home-intro-bloom',
        { opacity: [0, 0.65, 0], transform: ['scale(.65)', 'scale(1.4)'] },
        { duration: 1.15, at: 0, ease },
      ],
      [
        '.home-ident',
        {
          opacity: [0, 1, 0],
          transform: [
            'translateY(14px)',
            'translateY(0px)',
            'translateY(-12px)',
          ],
          filter: ['blur(5px)', 'blur(0px)', 'blur(3px)'],
        },
        { duration: 1, at: 0.05, times: [0, 0.25, 1], ease },
      ],
      [
        '.home-topbar',
        {
          transform: ['translateY(-12px)', 'translateY(0px)'],
          opacity: [0.35, 1],
        },
        { duration: 0.6, at: 0, ease },
      ],
    ])
    animation.current = controls
    void controls.then(() => {
      if (active) {
        setOpening(false)
      }
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

  function changeFilter(next: LibraryFilter) {
    onFilter(next)
    onSearch('')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return (
    <MotionEnvironment
      paused={backgroundPaused || !!playbackOpen || !!selected || menuOpen}
    >
      <div ref={scope} className="home-page" data-opening={opening}>
        <CatalogueBackdrop
          paused={backgroundPaused || !!selected || !!playbackOpen || menuOpen}
        />
        <div className="home-page-content">
          <a className="home-skip" href="#home-main">
            Aller au catalogue
          </a>
          <header className="home-topbar">
            <a
              className="home-brand"
              href="/app"
              aria-label="HollyFilms, accueil"
            >
              <Wordmark compact />
              <span>
                <ShinyText>3.0</ShinyText>
              </span>
            </a>
            <GooeyNav
              items={[
                { value: 'all', label: 'Accueil' },
                { value: 'movies', label: 'Films' },
                { value: 'series', label: 'Séries' },
              ]}
              value={filter}
              onChange={changeFilter}
            />
            <div className="home-tools">
              <button
                type="button"
                className="home-icon-button home-menu-trigger"
                aria-label="Explorer HollyFilms"
                aria-haspopup="dialog"
                onClick={() => setMenuOpen(true)}
              >
                <Menu size={20} />
              </button>
              <label className="home-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Rechercher dans le catalogue"
                  placeholder="Un film, une série…"
                  value={search}
                  onChange={(event) => onSearch(event.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => onSearch('')}
                    aria-label="Effacer la recherche"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              {isAdmin && (
                <a
                  href="/admin"
                  className="home-icon-button"
                  aria-label="Administration"
                >
                  <ShieldCheck size={19} />
                </a>
              )}
              <span
                className="home-avatar"
                title={username}
                aria-label={'Connecté en tant que ' + username}
              >
                {username.slice(0, 1).toUpperCase()}
              </span>
              <button
                type="button"
                className="home-icon-button"
                aria-label={
                  signingOut ? 'Déconnexion en cours' : 'Se déconnecter'
                }
                disabled={signingOut}
                onClick={onSignOut}
              >
                <LogOut size={17} />
              </button>
            </div>
          </header>

          <main id="home-main" ref={content} tabIndex={-1}>
            {!browsing && featured ? (
              <HomeCarousel
                items={items}
                session={session}
                userId={userId}
                active={
                  !selected && !playbackOpen && !menuOpen && !backgroundPaused
                }
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
              <section
                className={'home-hero ' + (browsing ? 'home-hero-compact' : '')}
                aria-labelledby="home-title"
              >
                <div className="home-hero-media" aria-hidden="true">
                  <MediaArtwork
                    source={featured?.backdrop ?? featured?.poster}
                    session={session}
                    width={1920}
                    eager
                  />
                </div>
                <div className="home-hero-shade" />
                <div className="home-hero-copy">
                  <p className="home-eyebrow">
                    <span />
                    VOTRE BIBLIOTHÈQUE
                  </p>
                  <h1 id="home-title">
                    {browsing
                      ? search.trim()
                        ? 'Votre recherche.'
                        : filter === 'movies'
                          ? 'Les films.'
                          : 'Les séries.'
                      : 'Votre bibliothèque.'}
                  </h1>
                  <p className="home-synopsis">
                    {browsing
                      ? search.trim()
                        ? 'Les résultats de votre recherche dans vos films et séries.'
                        : 'Tous les titres accessibles avec votre compte.'
                      : state === 'loading'
                        ? 'Chargement de vos films et séries…'
                        : state === 'error'
                          ? 'La bibliothèque est momentanément indisponible.'
                          : 'Les titres de vos bibliothèques apparaîtront ici.'}
                  </p>
                </div>
              </section>
            )}

            <div className="home-content">
              {!browsing && resumeItems.length > 0 && (
                <AnimatedContent>
                  <section
                    className="home-resume"
                    aria-labelledby="resume-title"
                  >
                    <div className="home-section-header">
                      <div>
                        <p className="home-section-kicker">
                          LA SUITE VOUS ATTEND
                        </p>
                        <h2 id="resume-title">
                          En cours de lecture<span>{resumeItems.length}</span>
                        </h2>
                      </div>
                      <div className="home-rail-controls">
                        <button
                          type="button"
                          aria-label="Titres en cours précédents"
                          onClick={() =>
                            resumeRail.current?.scrollBy({
                              left: -520,
                              behavior: reduced ? 'instant' : 'smooth',
                            })
                          }
                        >
                          <ChevronLeft size={19} />
                        </button>
                        <button
                          type="button"
                          aria-label="Titres en cours suivants"
                          onClick={() =>
                            resumeRail.current?.scrollBy({
                              left: 520,
                              behavior: reduced ? 'instant' : 'smooth',
                            })
                          }
                        >
                          <ChevronRight size={19} />
                        </button>
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
              {!browsing && resumeError && (
                <div className="home-inline-error" role="status">
                  La reprise de lecture est indisponible.
                  <button type="button" onClick={onRetry}>
                    Réessayer
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
                      {search.trim() ? 'RECHERCHE' : 'À DÉCOUVRIR'}
                    </p>
                    <h2 id="catalogue-title">
                      {search.trim()
                        ? 'Résultats'
                        : filter === 'movies'
                          ? 'Tous les films'
                          : filter === 'series'
                            ? 'Toutes les séries'
                            : 'Ajouts récents'}
                      {state === 'ready' && (
                        <span>
                          <CountUp value={total} />
                        </span>
                      )}
                    </h2>
                  </div>
                  <span className="home-sort">Les plus récents d’abord</span>
                </div>
                {state === 'loading' ? (
                  <div className="home-loading" role="status">
                    <span>Chargement du catalogue…</span>
                    <div className="home-grid" aria-hidden="true">
                      {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="home-skeleton" />
                      ))}
                    </div>
                  </div>
                ) : state === 'error' ? (
                  <div className="home-empty" role="alert">
                    <Film size={30} />
                    <h3>Impossible de charger le catalogue.</h3>
                    <p>Réessayez dans un instant.</p>
                    <button
                      type="button"
                      className="home-primary"
                      onClick={onRetry}
                    >
                      Réessayer
                      <RotateCcw size={16} />
                    </button>
                  </div>
                ) : items.length === 0 ? (
                  <div className="home-empty" role="status">
                    <Search size={30} />
                    <h3>
                      {search.trim()
                        ? 'Aucun titre trouvé.'
                        : 'La bibliothèque est encore vide.'}
                    </h3>
                    <p>
                      {search.trim()
                        ? 'Essayez un autre titre ou effacez votre recherche.'
                        : 'Les films et séries accessibles à votre compte apparaîtront ici.'}
                    </p>
                    {search.trim() && (
                      <button
                        type="button"
                        className="home-primary"
                        onClick={() => onSearch('')}
                      >
                        Effacer la recherche
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <motion.div
                      className="home-grid"
                      initial={false}
                      animate={{ opacity: 1 }}
                      key={filter + search.trim()}
                    >
                      {items.map((item, index) => (
                        <DeferredMediaTile
                          key={item.id}
                          order={index}
                          item={item}
                          session={session}
                          onSelect={setSelected}
                          onPlay={onPlay ? playItem : undefined}
                          onFavorite={onFavorite}
                          onWatched={onWatched}
                        />
                      ))}
                    </motion.div>
                    {loadMoreError && (
                      <p className="home-inline-error" role="alert">
                        La suite du catalogue n’a pas pu être chargée.
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
                          ? 'Chargement…'
                          : loadMoreError
                            ? 'Réessayer'
                            : 'Afficher plus de titres'}
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
                <span>Votre bibliothèque. Votre rythme.</span>
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
                      ? 'Animer le fond'
                      : 'Mettre le fond en pause'}
                  </button>
                )}
                {!reduced && (
                  <button
                    type="button"
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'instant' })
                      setSkipEntrance(false)
                      setEntranceKey((value) => value + 1)
                      setOpening(true)
                    }}
                  >
                    <RotateCcw size={13} />
                    Revoir l’ouverture
                  </button>
                )}
              </footer>
            </div>
          </main>
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
                        setSelected(null)
                        onPlay(item, resume, queue)
                      }
                    : undefined
                }
                onClose={() => setSelected(null)}
              />
            )}
          </AnimatePresence>
        </div>
        {opening && (
          <div className="home-intro">
            <div className="home-intro-frame" aria-hidden="true" />
            <div className="home-intro-bloom" aria-hidden="true" />
            <div className="home-aperture" aria-hidden="true" />
            <div className="home-ident" aria-hidden="true">
              <Wordmark compact />
              <span>3.0</span>
            </div>
          </div>
        )}
        {menuOpen && (
          <StaggeredMenu onClose={() => setMenuOpen(false)}>
            <FlowingMenu
              items={items}
              session={session}
              selected={filter}
              onSelect={changeFilter}
            />
          </StaggeredMenu>
        )}
      </div>
    </MotionEnvironment>
  )
}
