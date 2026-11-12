import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  Clock3,
  Heart,
  LoaderCircle,
  Eye,
  EyeOff,
  Play,
  Star,
  Layers3,
  ArrowUpRight,
} from 'lucide-react'
import type { MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { MediaArtwork } from './MediaArtwork.tsx'
import { formatDuration } from '../format-duration.ts'
import { AudioLanguages } from './AudioLanguages.tsx'
import { ClickSpark } from '../components/reactbits/Effects.tsx'
import TiltedCard from '../components/TiltedCard.tsx'
import {
  cinemaMotion,
  useMotionPolicy,
} from '../components/reactbits/policy.ts'
import '../home.css'
import './media-card.css'

export function MediaTile({
  item,
  session,
  wide = false,
  onSelect,
  onPlay,
  onFavorite,
  onWatched,
}: {
  item: MediaItem
  session?: JellyfinSession
  wide?: boolean
  onSelect: (item: MediaItem) => void
  onPlay?: (item: MediaItem, resume: boolean) => void
  onFavorite?: (item: MediaItem, favorite: boolean) => Promise<boolean>
  onWatched?: (item: MediaItem, watched: boolean) => Promise<boolean>
}) {
  const { reduced, fine } = useMotionPolicy()
  const touch = !fine
  const root = useRef<HTMLElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const active = hovered || focused || touch
  const subtle = Boolean(reduced || touch)
  const expanded = active && !touch
  const actionVariants = {
    hidden: { opacity: 0, y: subtle ? 0 : 14, scale: subtle ? 1 : 0.85 },
    visible: { opacity: 1, y: 0, scale: 1 },
  }
  const [pending, setPending] = useState<'favorite' | 'watched'>()
  const [burst, setBurst] = useState(0)
  const [error, setError] = useState<string>()
  async function update(action: 'favorite' | 'watched') {
    if (pending) return
    setPending(action)
    setError(undefined)
    try {
      if (action === 'favorite') await onFavorite?.(item, !item.favorite)
      else await onWatched?.(item, !item.watched)
      setBurst((value) => value + 1)
    } catch {
      setError('Modification impossible. Réessayez.')
    } finally {
      setPending(undefined)
    }
  }
  return (
    <motion.article
      ref={root}
      className={'media-tile ' + (wide ? 'media-tile-wide' : '')}
      data-active={active}
      data-touch={touch}
      aria-label={item.title}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocusCapture={(event) =>
        setFocused(event.target.matches(':focus-visible'))
      }
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false)
      }}
    >
      <TiltedCard
        trackingRef={root}
        active={active && !touch}
        disabled={subtle}
        hoverScale={1}
        hoverLift={0}
        tiltStrength={0.75}
      >
        <button
          type="button"
          className="media-tile-select"
          onClick={() => onSelect(item)}
          aria-label={
            'Voir la fiche de ' +
            item.title +
            (item.episode ? ', ' + item.episode : '')
          }
        />
        <div className="media-tile-image">
          <ClickSpark burst={burst} />
          <div className="media-card-artwork">
            <MediaArtwork
              source={wide ? (item.backdrop ?? item.poster) : item.poster}
              session={session}
              width={wide ? 640 : 400}
            />
          </div>
          {onPlay && (
            <motion.div
              className="media-card-play-reveal"
              initial={false}
              animate={active ? 'visible' : 'hidden'}
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              transition={{ duration: subtle ? 0.12 : 0.2 }}
            >
              <button
                type="button"
                className="media-card-play"
                aria-label={`${item.progress > 0 ? 'Reprendre' : 'Lire'} ${item.title}${item.episode ? ', ' + item.episode : ''}`}
                onClick={() => onPlay(item, true)}
              >
                <motion.span
                  className="media-play-disc"
                  variants={{
                    hidden: { scale: subtle ? 1 : 0.65, y: subtle ? 0 : 16 },
                    visible: { scale: 1, y: 0 },
                  }}
                  transition={
                    subtle
                      ? { duration: 0.12 }
                      : { type: 'spring', stiffness: 320, damping: 24 }
                  }
                  whileHover={subtle ? undefined : { scale: 1.08 }}
                  whileTap={subtle ? undefined : { scale: 0.94 }}
                  aria-hidden="true"
                >
                  <motion.span
                    className="media-play-orbit"
                    variants={{
                      hidden: {
                        rotate: subtle ? 0 : -100,
                        scale: subtle ? 1 : 0.8,
                      },
                      visible: { rotate: 0, scale: 1 },
                    }}
                    transition={{
                      duration: subtle ? 0.12 : 0.5,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                  <motion.span
                    className="media-play-icon"
                    variants={{
                      hidden: {
                        opacity: 0,
                        x: subtle ? 0 : -8,
                        rotate: subtle ? 0 : -25,
                      },
                      visible: { opacity: 1, x: 0, rotate: 0 },
                    }}
                    transition={{
                      duration: subtle ? 0.12 : 0.25,
                      delay: active && !subtle ? 0.05 : 0,
                    }}
                  >
                    <Play size={24} fill="currentColor" strokeWidth={1.5} />
                  </motion.span>
                </motion.span>
                <motion.span
                  className="media-play-label"
                  variants={{
                    hidden: { opacity: 0, y: subtle ? 0 : 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{
                    duration: subtle ? 0.12 : 0.2,
                    delay: active && !subtle ? 0.1 : 0,
                  }}
                  aria-hidden="true"
                >
                  {item.progress > 0 ? 'Reprendre' : 'Lire'}
                </motion.span>
              </button>
            </motion.div>
          )}
          <div className="media-card-badges">
            {item.quality && (
              <span
                className="media-quality"
                title="Meilleure résolution disponible"
              >
                {item.quality}
              </span>
            )}
            <AnimatePresence initial={false}>
              {item.watched && (
                <motion.span
                  key="watched"
                  initial={{
                    opacity: 0,
                    scale: subtle ? 1 : 0.8,
                    y: subtle ? 0 : -8,
                  }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: subtle ? 1 : 0.8,
                    y: subtle ? 0 : -8,
                  }}
                  transition={{ duration: subtle ? 0.12 : 0.24 }}
                  className="media-watched"
                  aria-label="Déjà vu"
                  title="Déjà vu"
                >
                  <Check size={14} />
                  <span>Vu</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {(onFavorite || onWatched) && (
            <motion.div
              className="media-card-actions"
              initial={false}
              animate={active ? 'visible' : 'hidden'}
              variants={{
                hidden: {
                  opacity: 0,
                  transition: {
                    staggerChildren: subtle ? 0 : 0.035,
                    staggerDirection: -1,
                  },
                },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: subtle ? 0 : 0.055,
                    delayChildren: subtle ? 0 : 0.06,
                  },
                },
              }}
              transition={{ duration: subtle ? 0.12 : 0.25 }}
            >
              {onFavorite && (
                <motion.button
                  variants={actionVariants}
                  transition={{ type: 'spring', stiffness: 360, damping: 25 }}
                  type="button"
                  aria-label={
                    item.favorite
                      ? 'Retirer des favoris'
                      : 'Ajouter aux favoris'
                  }
                  title={
                    item.favorite
                      ? 'Retirer des favoris'
                      : 'Ajouter aux favoris'
                  }
                  aria-pressed={Boolean(item.favorite)}
                  disabled={Boolean(pending)}
                  onClick={() => void update('favorite')}
                  whileHover={subtle ? undefined : { scale: 1.08, y: -2 }}
                  whileTap={subtle ? undefined : { scale: 0.92 }}
                >
                  <AnimatePresence initial={false} mode="wait">
                    <motion.span
                      className="media-action-icon"
                      key={
                        pending === 'favorite'
                          ? 'pending'
                          : String(item.favorite)
                      }
                      initial={{
                        opacity: 0,
                        scale: subtle ? 1 : 0.65,
                        rotate: subtle ? 0 : -18,
                      }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: subtle ? 1 : 0.65 }}
                      transition={{ duration: 0.15 }}
                    >
                      {pending === 'favorite' ? (
                        <LoaderCircle
                          size={18}
                          className="media-action-loading"
                        />
                      ) : (
                        <Heart
                          size={18}
                          fill={item.favorite ? 'currentColor' : 'none'}
                        />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              )}
              {onWatched && (
                <motion.button
                  variants={actionVariants}
                  transition={{ type: 'spring', stiffness: 360, damping: 25 }}
                  type="button"
                  aria-label={
                    item.watched ? 'Marquer comme non vu' : 'Marquer comme vu'
                  }
                  title={
                    item.watched ? 'Marquer comme non vu' : 'Marquer comme vu'
                  }
                  aria-pressed={Boolean(item.watched)}
                  disabled={Boolean(pending)}
                  onClick={() => void update('watched')}
                  whileHover={subtle ? undefined : { scale: 1.08, y: -2 }}
                  whileTap={subtle ? undefined : { scale: 0.92 }}
                >
                  <AnimatePresence initial={false} mode="wait">
                    <motion.span
                      className="media-action-icon"
                      key={
                        pending === 'watched' ? 'pending' : String(item.watched)
                      }
                      initial={{
                        opacity: 0,
                        scale: subtle ? 1 : 0.65,
                        y: subtle ? 0 : 6,
                      }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: subtle ? 1 : 0.65 }}
                      transition={{ duration: 0.15 }}
                    >
                      {pending === 'watched' ? (
                        <LoaderCircle
                          size={18}
                          className="media-action-loading"
                        />
                      ) : item.watched ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              )}
            </motion.div>
          )}
        </div>
        <div className="media-card-information">
          <div className="media-card-kicker">
            <span>
              {item.kind}
              {item.year ? ' · ' + item.year : ''}
            </span>
          </div>
          <div className="media-card-heading">
            <span className="media-tile-title" title={item.title}>
              {item.title}
            </span>
            <ArrowUpRight
              size={17}
              className="media-card-detail-arrow"
              aria-hidden="true"
            />
          </div>
          {wide && (
            <span className="media-tile-meta">
              <Clock3 size={12} aria-hidden="true" />
              {item.remainingMinutes != null
                ? 'Encore ' + formatDuration(item.remainingMinutes)
                : 'Lecture commencée'}
            </span>
          )}
          {(item.rating != null ||
            item.criticRating != null ||
            Boolean(item.audioLanguages?.length) ||
            (!wide &&
              Boolean(
                item.minutes ||
                item.classification ||
                item.editions?.length ||
                item.genres.length,
              ))) && (
            <motion.div
              className="media-card-expanded"
              initial={false}
              animate={{
                y: expanded || subtle ? 0 : 10,
                opacity: expanded ? 1 : 0,
              }}
              transition={{
                duration: subtle ? 0 : cinemaMotion.reveal,
                ease: cinemaMotion.ease,
              }}
              aria-hidden={!expanded}
            >
              <motion.div
                className="media-card-expanded-content"
                initial={false}
                animate={expanded ? 'visible' : 'hidden'}
                variants={{
                  visible: {
                    transition: { staggerChildren: subtle ? 0 : 0.045 },
                  },
                  hidden: {},
                }}
              >
                {!wide && Boolean(item.minutes || item.classification) && (
                  <motion.div
                    className="media-card-detail-meta"
                    variants={actionVariants}
                    transition={{ duration: subtle ? 0 : 0.18 }}
                  >
                    {Boolean(item.minutes) && (
                      <span>
                        <Clock3 size={11} aria-hidden="true" />
                        {formatDuration(item.minutes)}
                      </span>
                    )}
                    {item.classification && (
                      <span className="media-card-classification">
                        {item.classification}
                      </span>
                    )}
                  </motion.div>
                )}
                <motion.div
                  variants={actionVariants}
                  transition={{ duration: subtle ? 0 : 0.18 }}
                >
                  {(item.rating != null ||
                    item.criticRating != null ||
                    Boolean(item.audioLanguages?.length)) && (
                    <div className="media-card-facts">
                      <div className="media-card-ratings">
                        {item.rating != null && (
                          <span
                            className="media-community-rating"
                            aria-label={
                              'Note du public : ' +
                              item.rating.toFixed(1) +
                              ' sur 10'
                            }
                          >
                            <Star
                              size={12}
                              fill="currentColor"
                              aria-hidden="true"
                            />
                            {item.rating.toFixed(1)}
                          </span>
                        )}
                        {item.criticRating != null && (
                          <span
                            className="media-critic"
                            title="Rotten Tomatoes"
                            aria-label={
                              'Rotten Tomatoes : ' + item.criticRating + ' %'
                            }
                          >
                            <span aria-hidden="true">🍅</span>
                            {item.criticRating}%
                          </span>
                        )}
                      </div>
                      <AudioLanguages languages={item.audioLanguages ?? []} />
                    </div>
                  )}
                </motion.div>
                {!wide &&
                  Boolean(item.editions?.length || item.genres.length) && (
                    <motion.div
                      variants={actionVariants}
                      transition={{ duration: subtle ? 0 : 0.18 }}
                    >
                      {Boolean(item.editions?.length) && (
                        <span
                          className="media-edition"
                          title={item.editions!.join(' · ')}
                        >
                          <Layers3 size={12} aria-hidden="true" />
                          <span>
                            {item.editions![0]}
                            {item.editions!.length > 1
                              ? ' +' + (item.editions!.length - 1)
                              : ''}
                          </span>
                        </span>
                      )}
                      {!item.editions?.length && item.genres.length > 0 && (
                        <span
                          className="media-card-footnote"
                          title={item.genres.join(' · ')}
                        >
                          {item.genres.slice(0, 2).join(' · ')}
                        </span>
                      )}
                    </motion.div>
                  )}
              </motion.div>
            </motion.div>
          )}
          {wide && !item.watched && item.progress > 0 && (
            <span
              className="media-progress"
              role="progressbar"
              aria-label={'Progression de ' + item.title}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress * 100)}
            >
              <span style={{ width: item.progress * 100 + '%' }} />
            </span>
          )}
          <AnimatePresence initial={false}>
            {error && (
              <motion.span
                className="media-card-error"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: subtle ? 0.12 : 0.2 }}
              >
                {error}
              </motion.span>
            )}
          </AnimatePresence>
          {wide && item.episode && (
            <span className="media-episode">{item.episode}</span>
          )}
        </div>
      </TiltedCard>
    </motion.article>
  )
}
