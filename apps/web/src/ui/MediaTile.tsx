import { useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Clock3, Heart, LoaderCircle, Eye, EyeOff } from 'lucide-react'
import type { MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { MediaArtwork } from './MediaArtwork.tsx'
import { AudioLanguages } from './AudioLanguages.tsx'
import TiltedCard from '../components/TiltedCard.tsx'
import '../home.css'
import './media-card.css'

const touchQuery = '(hover: none), (pointer: coarse)'
function subscribeTouch(update: () => void) {
  const query = window.matchMedia(touchQuery)
  query.addEventListener('change', update)
  return () => query.removeEventListener('change', update)
}
const getTouch = () => window.matchMedia(touchQuery).matches
const getServerTouch = () => false

export function MediaTile({
  item,
  session,
  wide = false,
  onSelect,
  onFavorite,
  onWatched,
}: {
  item: MediaItem
  session?: JellyfinSession
  wide?: boolean
  onSelect: (item: MediaItem) => void
  onFavorite?: (item: MediaItem, favorite: boolean) => Promise<boolean>
  onWatched?: (item: MediaItem, watched: boolean) => Promise<boolean>
}) {
  const reduced = useReducedMotion()
  const touch = useSyncExternalStore(subscribeTouch, getTouch, getServerTouch)
  const root = useRef<HTMLElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const active = hovered || focused || touch
  const subtle = Boolean(reduced || touch)
  const actionVariants = {
    hidden: { opacity: 0, y: subtle ? 0 : 14, scale: subtle ? 1 : 0.85 },
    visible: { opacity: 1, y: 0, scale: 1 },
  }
  const [pending, setPending] = useState<'favorite' | 'watched'>()
  const [error, setError] = useState<string>()
  async function update(action: 'favorite' | 'watched') {
    if (pending) return
    setPending(action)
    setError(undefined)
    try {
      if (action === 'favorite') await onFavorite?.(item, !item.favorite)
      else await onWatched?.(item, !item.watched)
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
      <TiltedCard
        trackingRef={root}
        active={active && !touch}
        disabled={subtle}
      >
        <div className="media-tile-image">
          <div className="media-card-artwork">
            <MediaArtwork
              source={wide ? (item.backdrop ?? item.poster) : item.poster}
              session={session}
              width={wide ? 640 : 400}
            />
          </div>
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
          {!wide && item.kind !== 'Film' && (
            <span className="media-kind">{item.kind}</span>
          )}
        </div>
      </TiltedCard>
      <div className="media-card-facts">
        {item.criticRating != null && (
          <span
            className="media-critic"
            title="Rotten Tomatoes"
            aria-label={'Rotten Tomatoes : ' + item.criticRating + ' %'}
          >
            <span aria-hidden="true">🍅</span>
            {item.criticRating}%
          </span>
        )}
        <AudioLanguages languages={item.audioLanguages ?? []} />
      </div>
      <span className="media-tile-title">{item.title}</span>
      <span className="media-tile-meta">
        {wide ? (
          <>
            <Clock3 size={11} />
            {item.remainingMinutes
              ? item.remainingMinutes + ' min restantes'
              : 'Lecture commencée'}
          </>
        ) : (
          <>
            {item.year ?? 'Année non renseignée'}
            <span>·</span>
            {item.kind}
          </>
        )}
      </span>
      {Boolean(item.editions?.length) && (
        <span className="media-edition" title={item.editions!.join(' · ')}>
          {item.editions![0]}
          {item.editions!.length > 1 ? ' +' + (item.editions!.length - 1) : ''}
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
    </motion.article>
  )
}
