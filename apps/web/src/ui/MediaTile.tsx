import { localizeText } from '../i18n/messages.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { useRef, useState, type ReactNode } from 'react'
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
  footerAction,
  onSelect,
  onPlay,
  onFavorite,
  onWatched,
}: {
  item: MediaItem
  session?: JellyfinSession
  wide?: boolean
  footerAction?: ReactNode
  onSelect: (item: MediaItem) => void
  onPlay?: (item: MediaItem, resume: boolean) => void
  onFavorite?: (item: MediaItem, favorite: boolean) => Promise<boolean>
  onWatched?: (item: MediaItem, watched: boolean) => Promise<boolean>
}) {
  const { t } = useI18n()
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
      data-media-id={item.id}
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
        hoverLift={2}
        tiltStrength={0.75}
      >
        <button
          type="button"
          className="media-tile-select"
          data-artwork-open="details"
          onClick={() => onSelect(item)}
          aria-label={
            t('Voir la fiche de {title}', { title: item.title }) +
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
          <div className="media-card-badges">
            {item.quality && (
              <Tooltip>
                <span
                  className="media-quality"
                  title={t('Meilleure résolution disponible')}
                >
                  {item.quality}
                </span>
              </Tooltip>
            )}
            <AnimatePresence initial={false}>
              {item.watched && (
                <motion.span
                  key="watched"
                  initial={{
                    opacity: subtle ? 1 : 0.72,
                    scale: subtle ? 1 : 0.94,
                    y: subtle ? 0 : -3,
                  }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: subtle ? 1 : 0.8,
                    y: subtle ? 0 : -8,
                  }}
                  transition={{ duration: subtle ? 0.12 : 0.24 }}
                  className="media-watched"
                  aria-label={t('Déjà vu')}
                  title={t('Déjà vu')}
                >
                  <Check size={14} />
                  <span>{t('Vu')}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="media-card-information">
          <motion.div
            className="media-card-overlay"
            initial={false}
            animate={active ? 'visible' : 'hidden'}
            variants={{
              hidden: { opacity: 0, y: subtle ? 0 : 12 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{
              duration: subtle ? 0.12 : 0.24,
              ease: cinemaMotion.ease,
            }}
          >
            {(onPlay || onFavorite || onWatched) && (
              <div
                className="media-card-dock"
                role="group"
                aria-label={t('Actions de {title}', { title: item.title })}
              >
                {onPlay && (
                  <motion.button
                    type="button"
                    className="media-card-play"
                    data-artwork-open="player"
                    variants={actionVariants}
                    transition={{
                      duration: subtle ? 0.12 : 0.22,
                      ease: cinemaMotion.ease,
                    }}
                    whileHover={subtle ? undefined : { scale: 1.025 }}
                    whileTap={subtle ? undefined : { scale: 0.97 }}
                    aria-label={`${item.progress > 0 ? t('Reprendre') : t('Lire')} ${item.title}${item.episode ? ', ' + item.episode : ''}`}
                    onClick={() => onPlay(item, true)}
                  >
                    <Play
                      size={17}
                      fill="currentColor"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span className="media-play-label" aria-hidden="true">
                      {item.progress > 0 ? t('Reprendre') : t('Lire')}
                    </span>
                  </motion.button>
                )}
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
                      <Tooltip>
                        <motion.button
                          variants={actionVariants}
                          transition={{
                            type: 'spring',
                            stiffness: 360,
                            damping: 25,
                          }}
                          type="button"
                          aria-label={
                            item.favorite
                              ? t('Retirer des favoris')
                              : t('Ajouter aux favoris')
                          }
                          title={
                            item.favorite
                              ? t('Retirer des favoris')
                              : t('Ajouter aux favoris')
                          }
                          aria-pressed={Boolean(item.favorite)}
                          disabled={Boolean(pending)}
                          onClick={() => void update('favorite')}
                          whileHover={
                            subtle ? undefined : { scale: 1.08, y: -2 }
                          }
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
                      </Tooltip>
                    )}
                    {onWatched && (
                      <Tooltip>
                        <motion.button
                          variants={actionVariants}
                          transition={{
                            type: 'spring',
                            stiffness: 360,
                            damping: 25,
                          }}
                          type="button"
                          aria-label={
                            item.watched
                              ? t('Marquer comme non vu')
                              : t('Marquer comme vu')
                          }
                          title={
                            item.watched
                              ? t('Marquer comme non vu')
                              : t('Marquer comme vu')
                          }
                          aria-pressed={Boolean(item.watched)}
                          disabled={Boolean(pending)}
                          onClick={() => void update('watched')}
                          whileHover={
                            subtle ? undefined : { scale: 1.08, y: -2 }
                          }
                          whileTap={subtle ? undefined : { scale: 0.92 }}
                        >
                          <AnimatePresence initial={false} mode="wait">
                            <motion.span
                              className="media-action-icon"
                              key={
                                pending === 'watched'
                                  ? 'pending'
                                  : String(item.watched)
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
                      </Tooltip>
                    )}
                  </motion.div>
                )}
              </div>
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
                          {formatDuration(item.minutes, t)}
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
                            <Tooltip>
                              <span
                                className="media-community-rating"
                                aria-label={t(
                                  'Note du public : {rating} sur 10',
                                  { rating: item.rating.toFixed(1) },
                                )}
                              >
                                <Star
                                  size={12}
                                  fill="currentColor"
                                  aria-hidden="true"
                                />
                                {item.rating.toFixed(1)}
                              </span>
                            </Tooltip>
                          )}
                          {item.criticRating != null && (
                            <Tooltip>
                              <span
                                className="media-critic"
                                title={t('Rotten Tomatoes')}
                                aria-label={
                                  t('Rotten Tomatoes :') +
                                  ' ' +
                                  item.criticRating +
                                  ' %'
                                }
                              >
                                <span aria-hidden="true">🍅</span>
                                {item.criticRating}%
                              </span>
                            </Tooltip>
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
                          <Tooltip>
                            <span
                              className="media-edition"
                              title={item
                                .editions!.map((edition) =>
                                  localizeText(t, edition),
                                )
                                .join(' · ')}
                            >
                              <Layers3 size={12} aria-hidden="true" />
                              <span>
                                {localizeText(t, item.editions![0])}
                                {item.editions!.length > 1
                                  ? ' +' + (item.editions!.length - 1)
                                  : ''}
                              </span>
                            </span>
                          </Tooltip>
                        )}
                        {!item.editions?.length && item.genres.length > 0 && (
                          <Tooltip>
                            <span
                              className="media-card-footnote"
                              title={item.genres.join(' · ')}
                            >
                              {item.genres.slice(0, 2).join(' · ')}
                            </span>
                          </Tooltip>
                        )}
                      </motion.div>
                    )}
                </motion.div>
              </motion.div>
            )}
          </motion.div>

          <div className="media-card-kicker">
            <Tooltip>
              <span title={wide && item.episode ? item.episode : undefined}>
                {wide && item.episode
                  ? item.episode
                  : t(item.kind) + (item.year ? ' · ' + item.year : '')}
              </span>
            </Tooltip>
            {wide && (
              <span className="media-tile-meta">
                <Clock3 size={11} aria-hidden="true" />
                {item.remainingMinutes != null
                  ? t('Encore {duration}', {
                      duration: formatDuration(item.remainingMinutes, t),
                    })
                  : t('Lecture commencée')}
              </span>
            )}
          </div>
          <div className="media-card-heading">
            <Tooltip>
              <span className="media-tile-title" title={item.title}>
                {item.title}
              </span>
            </Tooltip>
            {footerAction ?? (
              <ArrowUpRight
                size={17}
                className="media-card-detail-arrow"
                aria-hidden="true"
              />
            )}
          </div>
          {wide && !item.watched && item.progress > 0 && (
            <span
              className="media-progress"
              role="progressbar"
              aria-label={t('Progression de {title}', { title: item.title })}
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
                {localizeText(t, error)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </TiltedCard>
    </motion.article>
  )
}
