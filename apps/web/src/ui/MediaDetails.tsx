import { useEffect, useRef } from 'react'
import { motion, useAnimate, useReducedMotion } from 'motion/react'
import { X, Star, Play } from 'lucide-react'
import type { MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { MediaArtwork } from './MediaArtwork.tsx'
import '../home.css'
import '../player.css'

export function MediaDetails({
  item,
  session,
  onClose,
  onPlay,
}: {
  item: MediaItem
  session?: JellyfinSession
  onPlay?: (item: MediaItem, resume: boolean) => void
  onClose: () => void
}) {
  const [scope, animate] = useAnimate<HTMLDialogElement>()
  const reduced = useReducedMotion()
  const closing = useRef(false)
  const outside = useRef(false)
  useEffect(() => {
    const dialog = scope.current
    dialog.showModal()
    const animation = animate(
      dialog,
      {
        opacity: [0, 1],
      },
      { duration: reduced ? 0 : 0.3 },
    )
    return () => {
      animation.stop()
      dialog.close()
    }
  }, [scope, animate, reduced])
  async function close() {
    if (closing.current) return
    closing.current = true
    await animate(
      scope.current,
      { opacity: 0 },
      { duration: reduced ? 0 : 0.18 },
    )
    scope.current?.close()
    onClose()
  }
  function isOutside(x: number, y: number) {
    const rect = scope.current.getBoundingClientRect()
    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom
  }
  return (
    <dialog
      ref={scope}
      className="media-dialog glass-panel"
      aria-labelledby="media-detail-title"
      onCancel={(event) => {
        event.preventDefault()
        void close()
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
        const dismiss =
          outside.current &&
          event.target === event.currentTarget &&
          isOutside(event.clientX, event.clientY)
        outside.current = false
        if (dismiss) void close()
      }}
    >
      <div className="media-detail-art">
        <MediaArtwork
          source={item.backdrop ?? item.poster}
          session={session}
          width={1280}
          eager
        />
      </div>
      <motion.button
        className="media-detail-close glass-control"
        aria-label="Fermer la fiche"
        onClick={() => void close()}
        whileTap={reduced ? undefined : { scale: 0.9 }}
      >
        <X size={20} />
      </motion.button>
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
        <p className="home-eyebrow">
          {item.kind} {item.year && '· ' + item.year}
        </p>
        <h2 id="media-detail-title">{item.title}</h2>
        <div className="home-meta">
          {item.minutes && <span>{item.minutes} min</span>}
          {item.classification && (
            <span className="home-rating">{item.classification}</span>
          )}
          {item.rating != null && (
            <span>
              <Star size={13} />
              {item.rating.toFixed(1)}
            </span>
          )}
        </div>
        {item.episode && <p className="media-detail-episode">{item.episode}</p>}
        <p className="media-detail-overview">
          {item.overview ||
            'Le synopsis de ce titre n’est pas encore disponible.'}
        </p>
        {item.genres.length > 0 && (
          <div className="media-genres">
            {item.genres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
        )}
        {onPlay && (
          <div className="media-play-actions">
            <motion.button
              className="home-primary"
              onClick={() => onPlay(item, true)}
              whileTap={reduced ? undefined : { scale: 0.97 }}
            >
              <Play size={18} fill="currentColor" />{' '}
              {item.progress > 0
                ? 'Reprendre'
                : item.kind === 'Série'
                  ? 'Lire la série'
                  : 'Lire'}
            </motion.button>
            {item.progress > 0 && (
              <button
                className="glass-control"
                onClick={() => onPlay(item, false)}
              >
                Depuis le début
              </button>
            )}
          </div>
        )}
        {item.progress > 0 && (
          <p className="media-detail-progress">
            {Math.round(item.progress * 100)} % visionné
            {item.remainingMinutes
              ? ' · ' + item.remainingMinutes + ' min restantes'
              : ''}
          </p>
        )}
      </div>
    </dialog>
  )
}
