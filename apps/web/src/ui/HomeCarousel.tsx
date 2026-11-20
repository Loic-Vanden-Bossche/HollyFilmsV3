import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { useMediaLocalization } from '../MediaLocalizations.tsx'
import { usePerformanceProfile } from '../performance/PerformanceProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useAnimate,
  useMotionValue,
  useIsPresent,
} from 'motion/react'
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  Info,
  Pause,
  Play,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { getHeroPreview, getItemPreviewClip } from '@hollyfilms/shared/library'
import type { MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { MediaArtwork } from './MediaArtwork.tsx'
import { useArtworkNavigation } from './artwork-hero-context.ts'
import { formatDuration } from '../format-duration.ts'
import { HeroVideo } from './HeroVideo.tsx'
import { useCardVideoActive } from './card-video-activity.ts'
import { useBackdropWidth } from './use-backdrop-width.ts'
import {
  BlurText,
  Magnet,
  StarBorder,
  ClickSpark,
} from '../components/reactbits/Effects.tsx'
import '../home-carousel.css'

import {
  duration as timing,
  ease as curves,
  staggerDelay,
} from '../motion/tokens.ts'
const ease = curves.out
type PreviewKind = 'trailer' | 'clip'

// Keyed to the featured item. A failed source is tried only once per visit.
function FeaturedVideo({
  item,
  session,
  userId,
  running,
  muted,
  onPlaying,
}: {
  item: MediaItem
  session: JellyfinSession
  userId: string
  running: boolean
  muted: boolean
  onPlaying: (kind: PreviewKind | null) => void
}) {
  const base = new URL('/jellyfin', window.location.origin).href
  const [trailerFailed, setTrailerFailed] = useState(false)
  const [finished, setFinished] = useState(false)
  const trailer = useQuery({
    queryKey: ['native-preview', session.deviceId, userId, item.id],
    queryFn: ({ signal }) =>
      getHeroPreview(base, session, userId, item, signal),
    retry: false,
    staleTime: 300_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
  })
  useLayoutEffect(() => () => onPlaying(null), [onPlaying])
  if (finished || trailer.isPending) return null
  const native = !trailerFailed && trailer.data
  const source = native || getItemPreviewClip(base, session, item)
  if (!source) return null

  function finish() {
    onPlaying(null)
    setFinished(true)
  }
  return (
    <HeroVideo
      key={native ? 'trailer' : 'clip'}
      source={source}
      running={running}
      muted={muted}
      onExcerptEnd={native ? undefined : finish}
      onStatus={(status) => {
        if (status === 'playing') onPlaying(native ? 'trailer' : 'clip')
        else if (native) {
          onPlaying(null)
          setTrailerFailed(true)
        } else finish()
      }}
    />
  )
}

export function HomeCarousel({
  items,
  session,
  userId,
  active = true,
  reveal = true,
  onReady,
  entranceKey = 0,
  skipEntrance = false,
  onSelect,
  onPlay,
  onFavorite,
}: {
  items: MediaItem[]
  session?: JellyfinSession
  userId?: string
  reveal?: boolean
  onReady?: (id: string) => void
  active?: boolean
  entranceKey?: number
  skipEntrance?: boolean
  onSelect: (item: MediaItem) => void
  onPlay?: (item: MediaItem, resume: boolean) => void
  onFavorite?: (item: MediaItem, favorite: boolean) => Promise<boolean>
}) {
  const { t, locale } = useI18n()
  const navigateArtwork = useArtworkNavigation()
  const reduced = useReducedMotion()
  const profile = usePerformanceProfile()
  const backdropWidth = useBackdropWidth()
  const root = useRef<HTMLElement>(null)
  const restoreControl = useRef<string | null>(null)
  const inView = useInView(root, { amount: 0.3 })
  const [selectedId, setSelectedId] = useState<string>()
  const [paused, setPaused] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(!document.hidden)
  const [muted, setMuted] = useState(true)
  const [playingPreview, setPlayingPreview] = useState<PreviewKind | null>(null)
  const [saving, setSaving] = useState<string>()
  const [burst, setBurst] = useState(0)
  const [favoriteError, setFavoriteError] = useState<string>()
  const [now, setNow] = useState(() => Date.now())
  const progress = useMotionValue(0)
  const slides = useMemo(() => items.slice(0, 20), [items])
  const found = slides.findIndex((item) => item.id === selectedId)
  const index = found < 0 ? 0 : found
  const original = slides[index]
  const localize = useMediaLocalization()
  const item = useMemo(
    () => (original ? localize(original) : undefined),
    [localize, original],
  )
  useLayoutEffect(() => {
    const selector = restoreControl.current
    if (!selector) return
    restoreControl.current = null
    root.current
      ?.querySelector<HTMLElement>(
        '.hero-slide-copy[data-present="true"] ' + selector,
      )
      ?.focus({ preventScroll: true })
  }, [item?.id])
  const assetKey = JSON.stringify([
    item?.id,
    item?.backdrop ?? item?.poster,
    item?.logo,
    backdropWidth,
  ])
  const [backdropReady, setBackdropReady] = useState<string>()
  const [logoReady, setLogoReady] = useState<string>()
  const settleBackdrop = useCallback(
    () => setBackdropReady(assetKey),
    [assetKey],
  )
  const settleLogo = useCallback(() => setLogoReady(assetKey), [assetKey])
  useEffect(() => {
    if (item && backdropReady === assetKey && logoReady === assetKey)
      onReady?.(item.id)
  }, [item, assetKey, backdropReady, logoReady, onReady])
  const cardVideoActive = useCardVideoActive()
  const enabled =
    active && reveal && visible && inView && !reduced && !cardVideoActive
  const running = enabled && !paused
  const { connection } = navigator as Navigator & {
    connection?: { saveData?: boolean }
  }
  const allowPreview = enabled && profile.trailers && !connection?.saveData
  const duration = playingPreview === 'trailer' ? 30 : playingPreview ? 15 : 10

  useEffect(() => {
    const changed = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', changed)
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => {
      document.removeEventListener('visibilitychange', changed)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    progress.set(0)
  }, [item?.id, progress])
  useEffect(() => {
    if (!running || focused || hovered || slides.length < 2) return
    const controls = animate(progress, 1, {
      duration: duration * (1 - progress.get()),
      ease: 'linear',
      onComplete: () => setSelectedId(slides[(index + 1) % slides.length].id),
    })
    return () => controls.stop()
  }, [running, focused, hovered, index, slides, duration, progress])

  if (!item) return null
  const favorite = item.favorite ?? false
  const finish = item.minutes
    ? new Date(
        now + (item.remainingMinutes ?? item.minutes) * 60000,
      ).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : undefined
  const navigate = (direction: number) =>
    setSelectedId(
      slides[(index + direction + slides.length) % slides.length].id,
    )
  const toggleFavorite = async () => {
    if (!onFavorite || saving) return
    const id = item.id
    setSaving(id)
    setFavoriteError(undefined)
    try {
      await onFavorite(item, !favorite)
      setBurst((value) => value + 1)
    } catch {
      setFavoriteError(id)
    } finally {
      setSaving(undefined)
    }
  }

  return (
    <section
      ref={root}
      className="home-hero home-carousel"
      data-revealed={reveal}
      inert={!reveal}
      aria-roledescription="carrousel"
      aria-label={t('À l’affiche')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          const button =
            event.target instanceof Element
              ? event.target.closest('button')
              : null
          if (button?.closest('.hero-slide-copy')) {
            restoreControl.current = button.dataset.artworkOpen
              ? '[data-artwork-open="' + button.dataset.artworkOpen + '"]'
              : '.hero-favorite'
          }
          navigate(event.key === 'ArrowRight' ? 1 : -1)
        }
      }}
    >
      <div className="home-hero-media" aria-hidden="true">
        <AnimatePresence>
          <motion.div
            key={`${item.id}:${entranceKey}`}
            className="hero-backdrop"
            initial={
              reduced && reveal
                ? false
                : { opacity: 0, transform: reduced ? 'none' : 'scale(1.035)' }
            }
            animate={
              reveal
                ? { opacity: 1, transform: 'scale(1)' }
                : { opacity: 0, transform: reduced ? 'none' : 'scale(1.035)' }
            }
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : timing.feature, ease }}
          >
            <MediaArtwork
              source={item.backdrop ?? item.poster}
              session={session}
              width={backdropWidth}
              onReady={settleBackdrop}
              eager
            />
          </motion.div>
        </AnimatePresence>
        {allowPreview && session && userId && (
          <FeaturedVideo
            key={session.deviceId + '/' + item.id}
            item={item}
            session={session}
            userId={userId}
            running={running}
            muted={muted}
            onPlaying={setPlayingPreview}
          />
        )}
      </div>
      <div className="home-hero-shade" />
      <div className="home-hero-copy">
        <AnimatePresence mode="sync">
          <HeroSlide
            key={`${item.id}:${entranceKey}`}
            reduced={Boolean(reduced)}
            skipEntrance={skipEntrance}
            reveal={reveal}
          >
            <p data-hero-stage className="home-eyebrow">
              <span />
              {t('À L’AFFICHE')}{' '}
              <span className="hero-kind">{t(item.kind)}</span>
            </p>
            <h1 data-hero-stage className="hero-title" id="home-title">
              <span className="sr-only">{item.title}</span>
              <MediaArtwork
                source={item.logo}
                onReady={settleLogo}
                reveal="logo"
                session={session}
                width={1600}
                eager
                className="hero-logo"
                fallback={<BlurText text={item.title} />}
              />
            </h1>
            <div data-hero-stage className="hero-metadata">
              {item.rating != null && (
                <span
                  className="hero-score"
                  aria-label={
                    t('Note spectateurs :') + ' ' + item.rating.toFixed(1)
                  }
                >
                  <Star size={15} fill="currentColor" />
                  {item.rating.toFixed(1)}
                </span>
              )}
              {item.criticRating != null && (
                <span
                  aria-label={
                    t('Note critiques :') + ' ' + item.criticRating + '%'
                  }
                >
                  {item.criticRating}% <small>{t('critiques')}</small>
                </span>
              )}
              {item.year && <span>{item.year}</span>}
              {item.classification && <span>{item.classification}</span>}
              {item.minutes && <span>{formatDuration(item.minutes, t)}</span>}
              {finish && (
                <span className="hero-finish">
                  <Clock3 size={13} />
                  {t('Fin à {time}', { time: finish })}
                </span>
              )}
            </div>
            {item.genres.length > 0 && (
              <p data-hero-stage className="hero-genres">
                {item.genres.slice(0, 3).join(' · ')}
              </p>
            )}
            <p data-hero-stage className="home-synopsis">
              {item.overview ||
                t('Découvrez ce titre dans votre bibliothèque HollyFilms.')}
            </p>
            <div
              data-hero-stage
              className="home-hero-actions"
              data-media-id={item.id}
            >
              {onPlay && (
                <StarBorder className="hero-play-border">
                  <motion.button
                    type="button"
                    className="home-primary"
                    whileHover={reduced ? undefined : { y: -3 }}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                    data-artwork-open="player"
                    onClick={(event) =>
                      navigateArtwork(event.currentTarget, 'player', () =>
                        onPlay(item, true),
                      )
                    }
                  >
                    <Play size={20} fill="currentColor" />
                    <Magnet>
                      {item.progress > 0 ? t('Reprendre') : t('Lire')}
                    </Magnet>
                  </motion.button>
                </StarBorder>
              )}
              <motion.button
                type="button"
                className="hero-glass hero-details"
                whileHover={reduced ? undefined : { y: -3 }}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                data-artwork-open="details"
                onClick={(event) =>
                  navigateArtwork(event.currentTarget, 'details', () =>
                    onSelect(original ?? item),
                  )
                }
              >
                <Info size={20} />
                {t('Voir la fiche')}
              </motion.button>
              {onFavorite && (
                <Tooltip>
                  <motion.button
                    type="button"
                    className="hero-glass hero-favorite"
                    disabled={Boolean(saving)}
                    aria-label={
                      favorite
                        ? t('Retirer des favoris')
                        : t('Ajouter aux favoris')
                    }
                    aria-pressed={favorite}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => void toggleFavorite()}
                  >
                    <ClickSpark burst={burst} />
                    <Heart
                      size={21}
                      fill={favorite ? 'currentColor' : 'none'}
                    />
                  </motion.button>
                </Tooltip>
              )}
            </div>
            {favoriteError === item.id && (
              <p role="alert" className="hero-favorite-error">
                {t('Impossible de modifier les favoris. Réessayez.')}
              </p>
            )}
          </HeroSlide>
        </AnimatePresence>
      </div>
      <motion.div
        className="hero-preview-controls"
        initial={reduced || skipEntrance ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: reveal ? 1 : 0, y: reveal ? 0 : -12 }}
        transition={{ duration: 0.45, delay: 0.2, ease }}
      >
        <span className="hero-preview-label">
          {playingPreview === 'clip'
            ? t('EXTRAIT')
            : playingPreview === 'trailer'
              ? t('BANDE-ANNONCE')
              : t('LA SÉLECTION HOLLYFILMS')}
        </span>
        {playingPreview && (
          <Tooltip>
            <button
              type="button"
              className="hero-glass"
              aria-label={
                muted
                  ? t('Activer le son de l’aperçu')
                  : t('Couper le son de l’aperçu')
              }
              onClick={() => setMuted((value) => !value)}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </Tooltip>
        )}
        {!reduced && (
          <Tooltip>
            <button
              type="button"
              className="hero-glass"
              aria-label={
                paused
                  ? t('Reprendre les animations')
                  : t('Mettre les animations en pause')
              }
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play size={17} /> : <Pause size={17} />}
            </button>
          </Tooltip>
        )}
      </motion.div>
      {slides.length > 1 && (
        <motion.nav
          initial={reduced || skipEntrance ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: reveal ? 1 : 0, y: reveal ? 0 : 18 }}
          transition={{ duration: 0.5, delay: 0.35, ease }}
          className="hero-pagination"
          aria-label={t('Choisir un titre à l’affiche')}
        >
          <div className="hero-pagination-heading">
            <span>{t('LA SÉLECTION')}</span>
            <span className="hero-counter">
              <strong>{String(index + 1).padStart(2, '0')}</strong> /{' '}
              {String(slides.length).padStart(2, '0')}
            </span>
          </div>
          <div className="hero-navigation">
            <Tooltip>
              <button
                type="button"
                className="hero-glass"
                aria-label={t('Titre précédent')}
                onClick={() => navigate(-1)}
              >
                <ChevronLeft size={20} />
              </button>
            </Tooltip>
            <div className="hero-dots">
              {slides.map((slide, position) => (
                <Tooltip key={slide.id}>
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={t('Afficher') + ' ' + slide.title}
                    aria-current={index === position ? 'true' : undefined}
                    onClick={() => setSelectedId(slide.id)}
                  >
                    <span />
                  </button>
                </Tooltip>
              ))}
            </div>
            <Tooltip>
              <button
                type="button"
                className="hero-glass"
                aria-label={t('Titre suivant')}
                onClick={() => navigate(1)}
              >
                <ChevronRight size={20} />
              </button>
            </Tooltip>
          </div>
          <div className="hero-progress" aria-hidden="true">
            <motion.div style={{ scaleX: progress }} />
          </div>
        </motion.nav>
      )}
      <span
        className="sr-only"
        aria-live={focused || paused || reduced ? 'polite' : 'off'}
        aria-atomic="true"
      >
        {index + 1} {t('sur')} {slides.length} : {item.title}
      </span>
    </section>
  )
}

// Mount immediately to load artwork; stage the content only when the intro releases it.
function HeroSlide({
  children,
  reduced,
  skipEntrance,
  reveal,
}: {
  children: ReactNode
  reduced: boolean
  skipEntrance: boolean
  reveal: boolean
}) {
  const present = useIsPresent()
  const [skipAtMount] = useState(skipEntrance)
  const instant = reduced || (skipEntrance && !skipAtMount)
  const [scope, animateSlide] = useAnimate<HTMLDivElement>()
  useLayoutEffect(() => {
    if (!reveal) return
    const stages = Array.from(
      scope.current.querySelectorAll<HTMLElement>('[data-hero-stage]'),
    )
    const controls = stages.map((node, index) =>
      animateSlide(
        node,
        {
          opacity: [node.classList.contains('home-hero-actions') ? 0.65 : 0, 1],
          transform: [
            node.tagName === 'H1' ? 'translateY(18px)' : 'translateY(8px)',
            'translateY(0px)',
          ],
        },
        {
          duration: instant
            ? 0
            : node.tagName === 'H1'
              ? timing.scene
              : timing.panel,
          delay:
            instant || node.classList.contains('home-hero-actions')
              ? 0
              : staggerDelay(index),
          ease,
        },
      ),
    )
    const badgeElements = scope.current.querySelectorAll<HTMLElement>(
      '.hero-metadata > span',
    )
    const badges = badgeElements.length
      ? animateSlide(
          badgeElements,
          {
            opacity: [0, 1],
            transform: ['translateY(8px)', 'translateY(0px)'],
          },
          {
            duration: instant ? 0 : 0.3,
            delay: (i) => (instant ? 0 : staggerDelay(i + 1)),
            ease,
          },
        )
      : undefined
    return () => {
      controls.forEach((control) => {
        control.complete()
        control.stop()
      })
      badges?.complete()
      badges?.stop()
    }
  }, [animateSlide, instant, scope, reveal])
  return (
    <motion.div
      ref={scope}
      className="hero-slide-copy"
      data-present={present}
      inert={!present}
      aria-hidden={!present}
      initial={false}
      exit={{ opacity: 0, y: instant ? 0 : -8 }}
      transition={{ duration: instant ? 0 : 0.14 }}
    >
      {children}
    </motion.div>
  )
}
