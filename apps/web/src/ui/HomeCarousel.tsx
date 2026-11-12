import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
  useReducedMotion,
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
import { getHeroPreview } from '@hollyfilms/shared/library'
import type { MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { MediaArtwork } from './MediaArtwork.tsx'
import { formatDuration } from '../format-duration.ts'
import { HeroVideo } from './HeroVideo.tsx'
import {
  BlurText,
  Magnet,
  StarBorder,
  ClickSpark,
} from '../components/reactbits/Effects.tsx'
import '../home-carousel.css'

const ease = [0.22, 1, 0.36, 1] as const

function subscribeViewport(notify: () => void) {
  window.addEventListener('resize', notify)
  return () => window.removeEventListener('resize', notify)
}
function backdropResolution() {
  // Cover the zoomed hero at native display density, without decoding a 4K
  // image on every small screen. Buckets keep resized images in the same cache.
  return Math.min(
    3840,
    Math.max(
      1280,
      Math.ceil((window.innerWidth * window.devicePixelRatio * 1.08) / 640) *
        640,
    ),
  )
}

export function HomeCarousel({
  items,
  session,
  userId,
  active = true,
  entranceKey = 0,
  skipEntrance = false,
  onSelect,
  onPlay,
  onFavorite,
}: {
  items: MediaItem[]
  session?: JellyfinSession
  userId?: string
  active?: boolean
  entranceKey?: number
  skipEntrance?: boolean
  onSelect: (item: MediaItem) => void
  onPlay?: (item: MediaItem, resume: boolean) => void
  onFavorite?: (item: MediaItem, favorite: boolean) => Promise<boolean>
}) {
  const reduced = useReducedMotion()
  const backdropWidth = useSyncExternalStore(
    subscribeViewport,
    backdropResolution,
    () => 1920,
  )
  const root = useRef<HTMLElement>(null)
  const inView = useInView(root, { amount: 0.3 })
  const [selectedId, setSelectedId] = useState<string>()
  const [paused, setPaused] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(!document.hidden)
  const [muted, setMuted] = useState(true)
  const [previewStatus, setPreviewStatus] = useState<{
    id: string
    playing: boolean
  }>()
  const [saving, setSaving] = useState<string>()
  const [burst, setBurst] = useState(0)
  const [favoriteError, setFavoriteError] = useState<string>()
  const [now, setNow] = useState(() => Date.now())
  const progress = useMotionValue(0)
  const slides = useMemo(() => items.slice(0, 20), [items])
  const found = slides.findIndex((item) => item.id === selectedId)
  const index = found < 0 ? 0 : found
  const item = slides[index]
  const enabled = active && visible && inView && !reduced
  const running = enabled && !paused
  const preview = useQuery({
    queryKey: ['hero-preview', session?.deviceId, userId, item?.id],
    queryFn: ({ signal }) =>
      getHeroPreview(
        new URL('/jellyfin', window.location.origin).href,
        session!,
        userId!,
        item,
        signal,
      ),
    enabled: Boolean(item && session && userId && enabled),
    retry: false,
    staleTime: 300000,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const playingPreview = previewStatus?.id === item?.id && previewStatus.playing
  const duration = preview.data ? 30 : 10

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
      ).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
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
      aria-roledescription="carrousel"
      aria-label="À l’affiche"
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
              reduced ? false : { opacity: 0.35, transform: 'scale(1.08)' }
            }
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 1.1, ease }}
          >
            <MediaArtwork
              source={item.backdrop ?? item.poster}
              session={session}
              width={backdropWidth}
              eager
            />
          </motion.div>
        </AnimatePresence>
        {enabled && preview.data && (
          <HeroVideo
            key={item.id}
            source={preview.data}
            running={running}
            muted={muted}
            onStatus={(status) =>
              setPreviewStatus({ id: item.id, playing: status === 'playing' })
            }
          />
        )}
      </div>
      <div className="home-hero-shade" />
      <div className="home-hero-copy">
        <AnimatePresence mode="wait">
          <HeroSlide
            key={`${item.id}:${entranceKey}`}
            reduced={Boolean(reduced)}
            skipEntrance={skipEntrance}
          >
            <p data-hero-stage className="home-eyebrow">
              <span />À L’AFFICHE <span className="hero-kind">{item.kind}</span>
            </p>
            <h1 data-hero-stage className="hero-title" id="home-title">
              <span className="sr-only">{item.title}</span>
              <MediaArtwork
                source={item.logo}
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
                  aria-label={'Note spectateurs : ' + item.rating.toFixed(1)}
                >
                  <Star size={15} fill="currentColor" />
                  {item.rating.toFixed(1)}
                </span>
              )}
              {item.criticRating != null && (
                <span
                  aria-label={'Note critiques : ' + item.criticRating + '%'}
                >
                  {item.criticRating}% <small>critiques</small>
                </span>
              )}
              {item.year && <span>{item.year}</span>}
              {item.classification && <span>{item.classification}</span>}
              {item.minutes && <span>{formatDuration(item.minutes)}</span>}
              {finish && (
                <span className="hero-finish">
                  <Clock3 size={13} />
                  Fin à {finish}
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
                'Découvrez ce titre dans votre bibliothèque HollyFilms.'}
            </p>
            <div data-hero-stage className="home-hero-actions">
              {onPlay && (
                <StarBorder className="hero-play-border">
                  <motion.button
                    type="button"
                    className="home-primary"
                    whileHover={reduced ? undefined : { y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onPlay(item, true)}
                  >
                    <Play size={20} fill="currentColor" />
                    <Magnet>{item.progress > 0 ? 'Reprendre' : 'Lire'}</Magnet>
                  </motion.button>
                </StarBorder>
              )}
              <motion.button
                type="button"
                className="hero-glass hero-details"
                whileHover={reduced ? undefined : { y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelect(item)}
              >
                <Info size={20} />
                Voir la fiche
              </motion.button>
              {onFavorite && (
                <motion.button
                  type="button"
                  className="hero-glass hero-favorite"
                  disabled={Boolean(saving)}
                  aria-label={
                    favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'
                  }
                  aria-pressed={favorite}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => void toggleFavorite()}
                >
                  <ClickSpark burst={burst} />
                  <Heart size={21} fill={favorite ? 'currentColor' : 'none'} />
                </motion.button>
              )}
            </div>
            {favoriteError === item.id && (
              <p role="alert" className="hero-favorite-error">
                Impossible de modifier les favoris. Réessayez.
              </p>
            )}
          </HeroSlide>
        </AnimatePresence>
      </div>
      <motion.div
        className="hero-preview-controls"
        initial={reduced || skipEntrance ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2, ease }}
      >
        <span className="hero-preview-label">
          {playingPreview && enabled
            ? 'BANDE-ANNONCE'
            : 'LA SÉLECTION HOLLYFILMS'}
        </span>
        {preview.data && (
          <button
            type="button"
            className="hero-glass"
            aria-label={
              muted ? 'Activer le son de l’aperçu' : 'Couper le son de l’aperçu'
            }
            disabled={!playingPreview || !enabled}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
        {!reduced && (
          <button
            type="button"
            className="hero-glass"
            aria-label={
              paused
                ? 'Reprendre les animations'
                : 'Mettre les animations en pause'
            }
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
        )}
      </motion.div>
      {slides.length > 1 && (
        <motion.nav
          initial={reduced || skipEntrance ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease }}
          className="hero-pagination"
          aria-label="Choisir un titre à l’affiche"
        >
          <div className="hero-pagination-heading">
            <span>LA SÉLECTION</span>
            <span className="hero-counter">
              <strong>{String(index + 1).padStart(2, '0')}</strong> /{' '}
              {String(slides.length).padStart(2, '0')}
            </span>
          </div>
          <div className="hero-navigation">
            <button
              type="button"
              className="hero-glass"
              aria-label="Titre précédent"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="hero-dots">
              {slides.map((slide, position) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={'Afficher ' + slide.title}
                  aria-current={index === position ? 'true' : undefined}
                  onClick={() => setSelectedId(slide.id)}
                >
                  <span />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="hero-glass"
              aria-label="Titre suivant"
              onClick={() => navigate(1)}
            >
              <ChevronRight size={20} />
            </button>
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
        {index + 1} sur {slides.length} : {item.title}
      </span>
    </section>
  )
}

// Mounted per selection: staging runs when data arrives, independently of the page intro.
function HeroSlide({
  children,
  reduced,
  skipEntrance,
}: {
  children: ReactNode
  reduced: boolean
  skipEntrance: boolean
}) {
  const [skipAtMount] = useState(skipEntrance)
  const instant = reduced || (skipEntrance && !skipAtMount)
  const [scope, animateSlide] = useAnimate<HTMLDivElement>()
  useLayoutEffect(() => {
    const stages = Array.from(
      scope.current.querySelectorAll<HTMLElement>('[data-hero-stage]'),
    )
    const controls = stages.map((node, index) =>
      animateSlide(
        node,
        {
          opacity: [0, 1],
          transform: [
            node.tagName === 'H1' ? 'translateY(30px)' : 'translateY(16px)',
            'translateY(0px)',
          ],
          filter: ['blur(7px)', 'blur(0px)'],
        },
        {
          duration: instant ? 0 : node.tagName === 'H1' ? 0.72 : 0.48,
          delay: instant ? 0 : index * 0.075,
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
            delay: (i) => (instant ? 0 : 0.2 + i * 0.035),
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
  }, [animateSlide, instant, scope])
  return (
    <motion.div
      ref={scope}
      initial={false}
      exit={{ opacity: 0, y: instant ? 0 : -8 }}
      transition={{ duration: instant ? 0 : 0.14 }}
    >
      {children}
    </motion.div>
  )
}
