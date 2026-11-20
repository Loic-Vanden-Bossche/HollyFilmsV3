import { memo, useCallback, useState, type ReactNode } from 'react'
import {
  Check,
  Eye,
  EyeOff,
  Heart,
  Layers3,
  LoaderCircle,
  Play,
  Star,
} from 'lucide-react'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type { MediaItem } from '@hollyfilms/shared/library'
import { formatDuration } from '../format-duration.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { localizeText } from '../i18n/messages.ts'
import { ArtworkPreview } from './ArtworkPreview.tsx'
import { ArtworkWatermark } from './ArtworkWatermark.tsx'
import {
  artworkIdentity,
  useArtworkNavigation,
} from './artwork-hero-context.ts'
import { CardVideoPreview } from './CardVideoPreview.tsx'
import { AudioLanguages } from './AudioLanguages.tsx'
import { MediaArtwork } from './MediaArtwork.tsx'
import { Tooltip } from './Tooltip.tsx'
import '../home.css'
import './media-card.css'

export const MediaTile = memo(function MediaTile({
  item,
  session,
  userId,
  wide: landscapeTile = false,
  ranked = false,
  footerAction,
  onSelect,
  onPlay,
  onFavorite,
  onWatched,
}: {
  item: MediaItem
  session?: JellyfinSession
  userId?: string
  wide?: boolean
  ranked?: boolean
  footerAction?: ReactNode
  onSelect: (item: MediaItem) => void
  onPlay?: (item: MediaItem, resume: boolean) => void
  onFavorite?: (item: MediaItem, favorite: boolean) => Promise<boolean>
  onWatched?: (item: MediaItem, watched: boolean) => Promise<boolean>
}) {
  const { t } = useI18n()
  const navigateArtwork = useArtworkNavigation()
  const [pending, setPending] = useState<'favorite' | 'watched'>()
  const [error, setError] = useState(false)
  const [failedCover, setFailedCover] = useState<string>()
  const wide = ranked || landscapeTile
  async function update(action: 'favorite' | 'watched') {
    if (pending) return
    setPending(action)
    setError(false)
    try {
      if (action === 'favorite') await onFavorite?.(item, !item.favorite)
      else await onWatched?.(item, !item.watched)
    } catch {
      setError(true)
    } finally {
      setPending(undefined)
    }
  }
  const landscape = item.backdrop ?? item.poster
  const titledCover = wide ? item.thumb : item.poster
  const coverKey = artworkIdentity(titledCover)
  const hasTitledCover = Boolean(coverKey && coverKey !== failedCover)
  const onCoverUnavailable = useCallback(
    () => setFailedCover(coverKey),
    [coverKey],
  )
  const showTitle = !hasTitledCover
  const cover = hasTitledCover ? titledCover : wide ? landscape : item.backdrop
  const previewCover = ranked ? cover : landscape
  const coverWidth = wide ? 640 : 400
  const playLabel = item.progress > 0 ? t('Reprendre') : t('Lire')
  const accessibleTitle = [item.title, item.episode].filter(Boolean).join(', ')
  const favoriteLabel = item.favorite
    ? t('Retirer des favoris')
    : t('Ajouter aux favoris')
  const watchedLabel = item.watched
    ? t('Marquer comme non vu')
    : t('Marquer comme vu')
  const progressBar = item.progress > 0 && !item.watched && (
    <span
      className="media-progress"
      role="progressbar"
      aria-label={t('Progression de {title}', { title: accessibleTitle })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(item.progress * 100)}
    >
      <span style={{ width: item.progress * 100 + '%' }} />
    </span>
  )
  return (
    <ArtworkPreview
      mediaId={item.id}
      hoverVideo={
        session &&
        userId && (
          <CardVideoPreview
            key={item.id}
            item={item}
            session={session}
            userId={userId}
          />
        )
      }
      title={item.title}
      wide={wide}
      presentation={ranked ? 'ranked' : wide ? 'landscape' : 'cinema'}
      watermark={ranked || !wide ? <ArtworkWatermark /> : undefined}
      titleLogo={item.logo}
      session={session}
      className={wide ? 'media-tile media-tile-wide' : 'media-tile'}
      triggerClassName="media-tile-select"
      triggerOverlay={
        (showTitle || progressBar || ranked) && (
          <div className="media-card-cover" data-title={showTitle}>
            {showTitle && (
              <span className="media-card-cover-title" aria-hidden="true">
                {item.title}
              </span>
            )}
            {progressBar}
            {ranked && <ArtworkWatermark />}
          </div>
        )
      }
      selectLabel={t('Voir la fiche de {title}', { title: accessibleTitle })}
      onSelect={() => onSelect(item)}
      artwork={
        <MediaArtwork
          source={cover}
          onUnavailable={hasTitledCover ? onCoverUnavailable : undefined}
          session={session}
          width="display"
        />
      }
      previewImage={{
        source: previewCover,
        matchesCover: previewCover === cover,
        compactWidth: previewCover === cover ? coverWidth : 640,
        includesTitle: ranked && hasTitledCover,
        onUnavailable:
          ranked && hasTitledCover ? onCoverUnavailable : undefined,
      }}
    >
      {(onPlay || onFavorite || onWatched || footerAction) && (
        <div
          className="media-card-dock"
          role="group"
          aria-label={t('Actions de {title}', { title: item.title })}
        >
          {onPlay && (
            <button
              type="button"
              className="media-card-play"
              data-artwork-open="player"
              aria-label={playLabel + ' ' + accessibleTitle}
              onClick={(event) =>
                navigateArtwork(event.currentTarget, 'player', () =>
                  onPlay(item, true),
                )
              }
            >
              <Play size={16} fill="currentColor" aria-hidden="true" />
              {playLabel}
            </button>
          )}
          {onFavorite && (
            <Tooltip>
              <button
                type="button"
                className="media-card-toggle"
                aria-label={favoriteLabel}
                aria-pressed={Boolean(item.favorite)}
                aria-disabled={Boolean(pending)}
                onClick={() => void update('favorite')}
              >
                {pending === 'favorite' ? (
                  <LoaderCircle className="media-action-loading" size={18} />
                ) : (
                  <Heart
                    size={18}
                    fill={item.favorite ? 'currentColor' : 'none'}
                  />
                )}
              </button>
            </Tooltip>
          )}
          {onWatched && (
            <Tooltip>
              <button
                type="button"
                className="media-card-toggle"
                aria-label={watchedLabel}
                aria-pressed={Boolean(item.watched)}
                aria-disabled={Boolean(pending)}
                onClick={() => void update('watched')}
              >
                {pending === 'watched' ? (
                  <LoaderCircle className="media-action-loading" size={18} />
                ) : item.watched ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </Tooltip>
          )}
          {footerAction}
        </div>
      )}
      {item.episode && <p className="media-card-episode">{item.episode}</p>}
      {error && (
        <p role="alert" className="media-card-error">
          {t('Modification impossible. Réessayez.')}
        </p>
      )}
      <div className="media-card-meta">
        <span>{t(item.kind)}</span>
        {item.year != null && <span>{item.year}</span>}
        {Boolean(item.minutes) && (
          <span>{formatDuration(item.minutes, t)}</span>
        )}
        {item.classification && (
          <span className="media-card-tag">{item.classification}</span>
        )}
        {item.quality && (
          <span
            className="media-card-tag"
            title={t('Meilleure résolution disponible')}
          >
            {item.quality}
          </span>
        )}
        {item.watched && (
          <span className="media-card-watched" aria-label={t('Déjà vu')}>
            <Check size={14} aria-hidden="true" />
            {t('Vu')}
          </span>
        )}
      </div>
      {progressBar && (
        <div className="media-card-resume">
          {progressBar}
          <span>
            {item.remainingMinutes != null
              ? t('Encore {duration}', {
                  duration: formatDuration(item.remainingMinutes, t),
                })
              : t('Lecture commencée')}
          </span>
        </div>
      )}
      {item.overview && <p className="media-card-overview">{item.overview}</p>}
      {item.genres.length > 0 && (
        <p className="media-card-genres">{item.genres.join(' · ')}</p>
      )}
      {(item.rating != null ||
        item.criticRating != null ||
        Boolean(item.audioLanguages?.length) ||
        Boolean(item.editions?.length)) && (
        <div className="media-card-facts">
          {item.rating != null && (
            <Tooltip>
              <span
                aria-label={t('Note du public : {rating} sur 10', {
                  rating: item.rating.toFixed(1),
                })}
              >
                <Star size={13} fill="currentColor" aria-hidden="true" />
                {item.rating.toFixed(1)}
              </span>
            </Tooltip>
          )}
          {item.criticRating != null && (
            <Tooltip>
              <span
                aria-label={
                  t('Rotten Tomatoes :') + ' ' + item.criticRating + ' %'
                }
              >
                <span aria-hidden="true">🍅</span>
                {item.criticRating}%
              </span>
            </Tooltip>
          )}
          <AudioLanguages languages={item.audioLanguages ?? []} />
          {item.editions?.length ? (
            <span>
              <Layers3 size={13} aria-hidden="true" />
              {item.editions
                .map((edition) => localizeText(t, edition))
                .join(' · ')}
            </span>
          ) : null}
        </div>
      )}
    </ArtworkPreview>
  )
})
