import { useState } from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useSpring,
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
  Volume2,
  VolumeX,
} from 'lucide-react'

import { formatTime } from '../playback/format-time.ts'
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
  const reduced = useReducedMotion()
  const enter = {
    hidden: { opacity: 0, y: reduced ? 0 : 10 },
    visible: { opacity: 1, y: 0 },
  }
  const [hover, setHover] = useState<{ position: number; fraction: number }>()
  const [loadedImage, setLoadedImage] = useState('')
  const [failedImage, setFailedImage] = useState('')
  const previewX = useSpring(0, { stiffness: 650, damping: 48, mass: 0.45 })
  const progress = media.duration ? (media.position / media.duration) * 100 : 0
  const preview = hover && onPreview?.(hover.position)
  const image = useTimelineImage(preview?.url, loadPreview)
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
                      alt="Aperçu de la position de lecture"
                      onLoad={() => setLoadedImage(image?.url ?? '')}
                      onError={() => setFailedImage(image?.url ?? '')}
                      initial={false}
                      animate={{
                        opacity:
                          image?.url && loadedImage === image.url ? 1 : 0,
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
                        Chargement de l’aperçu…
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="player-preview-placeholder">
                    Aperçu indisponible
                  </span>
                )}
                {preview?.label && (
                  <span className="player-preview-label">{preview.label}</span>
                )}
                <span className="player-preview-time">
                  {formatTime(hover.position)}
                </span>
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
          <div
            className="player-elapsed"
            style={{ width: Math.min(100, progress) + '%' }}
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
          style={{ left: Math.min(100, progress) + '%' }}
          initial={false}
          animate={{
            opacity: hover ? 1 : 0,
            scale: reduced || hover ? 1 : 0.6,
          }}
          transition={{ duration: reduced ? 0 : 0.15 }}
        />
        <input
          type="range"
          aria-label="Position de lecture"
          aria-valuetext={formatTime(media.position)}
          min={0}
          max={media.duration || 1}
          step={0.1}
          disabled={!media.duration}
          value={Math.min(media.duration, media.position)}
          onChange={(event) => {
            const position = Number(event.currentTarget.value)
            onSeek(position)
            const fraction = media.duration ? position / media.duration : 0
            const width = event.currentTarget.getBoundingClientRect().width
            const half = (onPreview?.(position)?.width ?? 150) / 2 + 6
            previewX.set(
              Math.max(half, Math.min(width - half, fraction * width)),
            )
            setHover({ fraction, position })
          }}
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
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
            setHover({ fraction, position: fraction * media.duration })
          }}
          onPointerLeave={() => setHover(undefined)}
          onFocus={(event) => {
            const fraction = media.duration
              ? media.position / media.duration
              : 0
            const width = event.currentTarget.getBoundingClientRect().width
            const half = (onPreview?.(media.position)?.width ?? 150) / 2 + 6
            previewX.jump(
              Math.max(half, Math.min(width - half, fraction * width)),
            )
            setHover({ fraction, position: media.position })
          }}
          onBlur={() => setHover(undefined)}
        />
      </motion.div>
      <div className="player-controls-row">
        <motion.button
          variants={enter}
          whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          type="button"
          className="player-icon"
          aria-label="Précédent"
          disabled={!hasPrevious}
          onClick={onPrevious}
        >
          <SkipBack />
        </motion.button>
        <motion.button
          variants={enter}
          whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          type="button"
          className="player-icon player-seek-step"
          aria-label="Reculer de 10 secondes"
          onClick={() => onSeek(Math.max(0, media.position - 10))}
        >
          <RotateCcw />
        </motion.button>
        <motion.button
          variants={enter}
          whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          type="button"
          className="player-icon player-toggle"
          aria-label={media.paused ? 'Lire' : 'Pause'}
          onClick={onToggle}
        >
          {media.paused ? (
            <Play fill="currentColor" />
          ) : (
            <Pause fill="currentColor" />
          )}
        </motion.button>
        <motion.button
          variants={enter}
          whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          type="button"
          className="player-icon player-seek-step"
          aria-label="Avancer de 30 secondes"
          onClick={() => onSeek(Math.min(media.duration, media.position + 30))}
        >
          <RotateCw />
        </motion.button>
        <motion.button
          variants={enter}
          whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          type="button"
          className="player-icon"
          aria-label="Suivant"
          disabled={!hasNext}
          onClick={onNext}
        >
          <SkipForward />
        </motion.button>
        <span className="player-clock">
          {formatTime(media.position)}{' '}
          <span>/ {formatTime(media.duration)}</span>
        </span>
        <div className="player-controls-spacer" />
        <motion.button
          variants={enter}
          whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          type="button"
          className="player-icon"
          aria-label={media.muted ? 'Rétablir le son' : 'Couper le son'}
          onClick={onMute}
        >
          {media.muted || media.volume === 0 ? <VolumeX /> : <Volume2 />}
        </motion.button>
        <input
          type="range"
          className="player-volume"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={media.muted ? 0 : media.volume}
          onChange={(event) => onVolume(Number(event.currentTarget.value))}
        />
        {onSubtitles && (
          <motion.button
            variants={enter}
            whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            type="button"
            className="player-icon"
            aria-label="Sous-titres"
            aria-pressed={subtitles}
            onClick={onSubtitles}
          >
            <Captions />
          </motion.button>
        )}
        <motion.button
          variants={enter}
          whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          type="button"
          className="player-icon"
          aria-label="Paramètres de lecture"
          onClick={onSettings}
        >
          <Settings2 />
        </motion.button>
        {onPip && (
          <motion.button
            variants={enter}
            whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            type="button"
            className="player-icon player-pip"
            aria-label={pip ? 'Quitter l’incrustation' : 'Incrustation vidéo'}
            onClick={onPip}
          >
            <PictureInPicture2 />
          </motion.button>
        )}
        <motion.button
          variants={enter}
          whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.9, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          type="button"
          className="player-icon"
          aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          onClick={onFullscreen}
        >
          {fullscreen ? <Minimize /> : <Maximize />}
        </motion.button>
      </div>
    </motion.div>
  )
}
