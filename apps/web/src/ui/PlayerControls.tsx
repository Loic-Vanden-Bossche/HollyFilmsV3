import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'
import {
  Captions,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  SkipBack,
  SkipForward,
} from 'lucide-react'

import { formatTime } from '../playback/format-time.ts'
import { PlayerVolume } from './PlayerVolume.tsx'
import '../player.css'

import type { TimelinePreview } from '../playback/timeline-preview.ts'
import {
  useTimelineImage,
  type PreviewImageLoader,
} from '../playback/use-timeline-image.ts'

export function PlayerControls({
  media,
  fullscreen,
  pip,
  hasPrevious,
  hasNext,
  subtitles,
  markers = [],
  onToggle,
  onSeek,
  onVolume,
  onMute,
  onPrevious,
  onNext,
  onFullscreen,
  onPip,
  onSubtitles,
  onSettings,
  onPreview,
  loadPreview,
}: {
  media: {
    position: number
    seeking?: boolean
    duration: number
    buffered: number
    paused: boolean
    muted: boolean
    volume: number
  }
  fullscreen: boolean
  pip: boolean
  hasPrevious: boolean
  hasNext: boolean
  subtitles: boolean
  markers?: { position: number; label: string }[]
  onToggle: () => void
  onSeek: (position: number) => void
  onVolume: (volume: number) => void
  onMute: () => void
  onPrevious: () => void
  onNext: () => void
  onFullscreen: () => void
  onPip?: () => void
  onSubtitles?: () => void
  onSettings: () => void
  onPreview?: (position: number) => TimelinePreview | undefined
  loadPreview?: PreviewImageLoader
}) {
  const { t } = useI18n()
  const reduced = useReducedMotion()
  const enter = {
    hidden: { opacity: 0, y: reduced ? 0 : 10 },
    visible: { opacity: 1, y: 0 },
  }
  return (
    <motion.div
      className="player-controls"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            duration: reduced ? 0 : 0.3,
            staggerChildren: reduced ? 0 : 0.025,
          },
        },
      }}
    >
      <PlayerTimeline
        media={media}
        markers={markers}
        onSeek={onSeek}
        onPreview={onPreview}
        loadPreview={loadPreview}
      />
      <div className="player-controls-row">
        {hasPrevious && (
          <Tooltip>
            <motion.button
              variants={enter}
              whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
              whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              type="button"
              className="player-icon"
              aria-label={t('Précédent')}
              onClick={onPrevious}
            >
              <SkipBack />
            </motion.button>
          </Tooltip>
        )}
        <Tooltip>
          <motion.button
            variants={enter}
            whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            type="button"
            className="player-icon player-seek-step"
            aria-label={t('Reculer de 10 secondes')}
            onClick={() => onSeek(Math.max(0, media.position - 10))}
          >
            <RotateCcw />
          </motion.button>
        </Tooltip>
        <Tooltip>
          <motion.button
            variants={enter}
            whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            type="button"
            className="player-icon player-toggle"
            aria-label={media.paused ? t('Lire') : t('Pause')}
            onClick={onToggle}
          >
            {media.paused ? (
              <Play fill="currentColor" />
            ) : (
              <Pause fill="currentColor" />
            )}
          </motion.button>
        </Tooltip>
        <Tooltip>
          <motion.button
            variants={enter}
            whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            type="button"
            className="player-icon player-seek-step"
            aria-label={t('Avancer de 30 secondes')}
            onClick={() =>
              onSeek(Math.min(media.duration, media.position + 30))
            }
          >
            <RotateCw />
          </motion.button>
        </Tooltip>
        {hasNext && (
          <Tooltip>
            <motion.button
              variants={enter}
              whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
              whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              type="button"
              className="player-icon"
              aria-label={t('Suivant')}
              onClick={onNext}
            >
              <SkipForward />
            </motion.button>
          </Tooltip>
        )}
        <span className="player-clock">
          {formatTime(media.position)}{' '}
          <span>/ {formatTime(media.duration)}</span>
        </span>
        <div className="player-controls-spacer" />
        <motion.div variants={enter}>
          <PlayerVolume
            value={media.volume}
            muted={media.muted}
            onChange={onVolume}
            onMute={onMute}
          />
        </motion.div>
        {onSubtitles && (
          <Tooltip>
            <motion.button
              variants={enter}
              whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
              whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              type="button"
              className="player-icon"
              data-subtitles-trigger
              aria-label={t('Sous-titres')}
              aria-pressed={subtitles}
              onClick={onSubtitles}
            >
              <Captions />
            </motion.button>
          </Tooltip>
        )}
        <Tooltip>
          <motion.button
            variants={enter}
            whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            type="button"
            className="player-icon"
            aria-label={t('Paramètres de lecture')}
            onClick={onSettings}
          >
            <Settings2 />
          </motion.button>
        </Tooltip>
        {onPip && (
          <Tooltip>
            <motion.button
              variants={enter}
              whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
              whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              type="button"
              className="player-icon player-pip"
              aria-label={
                pip ? t('Quitter l’incrustation') : t('Incrustation vidéo')
              }
              onClick={onPip}
            >
              <PictureInPicture2 />
            </motion.button>
          </Tooltip>
        )}
        <Tooltip>
          <motion.button
            variants={enter}
            whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            type="button"
            className="player-icon"
            aria-label={
              fullscreen ? t('Quitter le plein écran') : t('Plein écran')
            }
            onClick={onFullscreen}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </motion.button>
        </Tooltip>
      </div>
    </motion.div>
  )
}

// Pointer previews only re-render the timeline, not every playback control.
function PlayerTimeline({
  media,
  markers = [],
  onSeek,
  onPreview,
  loadPreview,
}: Pick<
  Parameters<typeof PlayerControls>[0],
  'media' | 'markers' | 'onSeek' | 'onPreview' | 'loadPreview'
>) {
  const { t } = useI18n()
  const reduced = useReducedMotion()
  const enter = {
    hidden: { opacity: 0, y: reduced ? 0 : 10 },
    visible: { opacity: 1, y: 0 },
  }
  const [hover, setHover] = useState(false)
  const [previewKey, setPreviewKey] = useState('')
  const previewPosition = useMotionValue(0)
  const previewTime = useTransform(previewPosition, formatTime)
  const [loadedImage, setLoadedImage] = useState('')
  const [failedImage, setFailedImage] = useState('')
  const previewX = useSpring(0, { stiffness: 650, damping: 48, mass: 0.45 })
  const progress = media.duration
    ? Math.max(0, Math.min(1, media.position / media.duration))
    : 0
  const displayedProgress = useSpring(progress, {
    stiffness: 700,
    damping: 55,
    mass: 0.7,
  })
  const playhead = useTransform(
    displayedProgress,
    (value) => `${Math.max(0, Math.min(1, value)) * 100}%`,
  )
  const pointerStart = useRef<number | undefined>(undefined)
  const dragging = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const bounds = useRef<DOMRect | undefined>(undefined)
  useEffect(() => {
    const invalidate = () => {
      bounds.current = undefined
    }
    const resize = new ResizeObserver(invalidate)
    if (input.current) resize.observe(input.current)
    window.addEventListener('scroll', invalidate, {
      passive: true,
      capture: true,
    })
    window.addEventListener('resize', invalidate)
    return () => {
      resize.disconnect()
      window.removeEventListener('scroll', invalidate, true)
      window.removeEventListener('resize', invalidate)
    }
  }, [])
  const measure = (node: HTMLInputElement) =>
    (bounds.current ??= node.getBoundingClientRect())
  useLayoutEffect(() => {
    if (reduced || dragging.current) displayedProgress.jump(progress)
    else displayedProgress.set(progress)
  }, [progress, reduced, displayedProgress])
  const preview = previewKey ? onPreview?.(previewPosition.get()) : undefined
  const image = useTimelineImage(preview?.url, loadPreview)
  const showPreview = (position: number) => {
    previewPosition.set(position)
    const next = onPreview?.(position)
    // React only updates when the sprite changes. Position and time follow
    // the pointer through Motion values without rendering all the controls.
    const key = JSON.stringify(next ?? null)
    setPreviewKey(key)
    setHover(true)
  }

  return (
    <motion.div className="player-timeline" variants={enter}>
      <AnimatePresence>
        {hover && media.duration > 0 && (
          <motion.div
            className="player-preview-anchor"
            style={{ x: previewX }}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 5 }}
            transition={{ duration: reduced ? 0 : 0.12 }}
          >
            <div className="player-preview">
              {preview && !image?.error && failedImage !== image?.url ? (
                <div
                  className="player-preview-image"
                  style={{ width: preview.width, height: preview.height }}
                >
                  <motion.img
                    src={image?.url}
                    alt={t('Aperçu de la position de lecture')}
                    onLoad={() => setLoadedImage(image?.url ?? '')}
                    onError={() => setFailedImage(image?.url ?? '')}
                    initial={false}
                    animate={{
                      opacity: image?.url && loadedImage === image.url ? 1 : 0,
                    }}
                    transition={{ duration: reduced ? 0 : 0.12 }}
                    style={{
                      width: preview.sheetWidth,
                      height: preview.sheetHeight,
                      left: -preview.x,
                      top: -preview.y,
                    }}
                  />
                  {(!image?.url || loadedImage !== image.url) && (
                    <span className="player-preview-placeholder">
                      {t('Chargement de l’aperçu…')}
                    </span>
                  )}
                </div>
              ) : (
                <span className="player-preview-placeholder">
                  {t('Aperçu indisponible')}
                </span>
              )}
              {preview?.label && (
                <span className="player-preview-label">{preview.label}</span>
              )}
              <motion.span className="player-preview-time">
                {previewTime}
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        className="player-timeline-track"
        aria-hidden="true"
        animate={{ scaleY: hover && !reduced ? 1.5 : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        <div
          className="player-buffered"
          style={{
            width:
              Math.min(
                100,
                media.duration ? (media.buffered / media.duration) * 100 : 0,
              ) + '%',
          }}
        />
        <motion.div
          className="player-elapsed"
          style={{ scaleX: displayedProgress }}
        />
        {media.duration > 0 &&
          markers
            .filter(
              (marker) =>
                marker.position > 0 && marker.position < media.duration,
            )
            .map((marker) => (
              <span
                key={marker.label + marker.position}
                className="player-marker"
                title={marker.label}
                style={{
                  left: (marker.position / media.duration) * 100 + '%',
                }}
              />
            ))}
      </motion.div>
      <motion.span
        className="player-playhead"
        aria-hidden="true"
        style={{ left: playhead }}
        initial={false}
        animate={{
          opacity: hover || media.seeking ? 1 : 0,
          scale: reduced || hover || media.seeking ? 1 : 0.6,
        }}
        transition={{ duration: reduced ? 0 : 0.15 }}
      />
      <input
        ref={input}
        type="range"
        aria-label={t('Position de lecture')}
        aria-valuetext={formatTime(media.position)}
        min={0}
        max={media.duration || 1}
        step={0.1}
        disabled={!media.duration}
        value={Math.min(media.duration, media.position)}
        onPointerDown={(event) => {
          pointerStart.current = event.clientX
          dragging.current = false
        }}
        onPointerUp={() => {
          pointerStart.current = undefined
          dragging.current = false
        }}
        onPointerCancel={() => {
          pointerStart.current = undefined
          dragging.current = false
          setHover(false)
        }}
        onChange={(event) => {
          const position = Number(event.currentTarget.value)
          onSeek(position)
          const fraction = media.duration ? position / media.duration : 0
          const width = measure(event.currentTarget).width
          const half = (onPreview?.(position)?.width ?? 150) / 2 + 6
          previewX.set(Math.max(half, Math.min(width - half, fraction * width)))
          showPreview(position)
        }}
        onPointerMove={(event) => {
          if (
            pointerStart.current != null &&
            Math.abs(event.clientX - pointerStart.current) > 3
          )
            dragging.current = true
          const bounds = measure(event.currentTarget)
          const fraction = Math.max(
            0,
            Math.min(1, (event.clientX - bounds.left) / bounds.width),
          )
          const nextPreview = onPreview?.(fraction * media.duration)
          const half = (nextPreview?.width ?? 150) / 2 + 6
          const x = Math.max(
            half,
            Math.min(bounds.width - half, fraction * bounds.width),
          )
          if (reduced || !hover) previewX.jump(x)
          else previewX.set(x)
          showPreview(fraction * media.duration)
        }}
        onPointerLeave={() => setHover(false)}
        onFocus={(event) => {
          const fraction = media.duration ? media.position / media.duration : 0
          const width = measure(event.currentTarget).width
          const half = (onPreview?.(media.position)?.width ?? 150) / 2 + 6
          previewX.jump(
            Math.max(half, Math.min(width - half, fraction * width)),
          )
          showPreview(media.position)
        }}
        onBlur={() => setHover(false)}
      />
    </motion.div>
  )
}
