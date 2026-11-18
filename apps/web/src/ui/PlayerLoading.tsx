import { useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react'
import type { PlayMethod } from '@jellyfin/sdk/lib/generated-client/index.js'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { useMotionPolicy } from '../components/reactbits/policy.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { formatTime } from '../playback/format-time.ts'
import type { PlaybackWait } from '../playback/loading-progress.ts'
import { useLoadingStage } from '../playback/use-loading-stage.ts'
import './player-loading.css'

const operationLabels = {
  opening: 'Ouverture du titre…',
  preparing: 'Préparation de la lecture…',
  buffering: 'Mise en mémoire tampon…',
  seeking: 'Recherche à {time}…',
} as const

const methodLabels = {
  DirectPlay: 'Lecture directe',
  DirectStream: 'Remux',
  Transcode: 'Transcodage',
} as const

type PlayerLoadingProps = {
  wait: PlaybackWait | null
  bufferedAhead?: number
  method?: PlayMethod
  onRetry?: () => void
  lowerBitrate?: number
  onLowerQuality?: () => void
  onRestoreFocus?: () => void
}

export function PlayerLoadingSpinner() {
  const { reduced, pageVisible } = useMotionPolicy()
  return (
    <span className="player-loading-spinner" aria-hidden="true">
      <span
        className="player-loading-rotor"
        data-running={pageVisible && !reduced}
      />
    </span>
  )
}

export function PlayerLoading({ wait, ...props }: PlayerLoadingProps) {
  const { t } = useI18n()
  const stage = useLoadingStage(wait?.since)
  const label =
    wait && stage > 0
      ? t(
          operationLabels[wait.operation],
          wait.operation === 'seeking'
            ? { time: formatTime(wait.position) }
            : undefined,
        )
      : ''
  return (
    <>
      <span className="sr-only" role="status" aria-atomic="true">
        {label}
      </span>
      {wait && stage >= (wait.operation === 'seeking' ? 2 : 1) && (
        <LoadingNotice
          key={wait.since}
          wait={wait}
          label={label}
          stage={stage}
          {...props}
        />
      )}
    </>
  )
}

function LoadingNotice({
  wait,
  stage,
  label,
  bufferedAhead,
  method,
  onRetry,
  lowerBitrate,
  onLowerQuality,
  onRestoreFocus,
}: Omit<PlayerLoadingProps, 'wait'> & {
  wait: PlaybackWait
  stage: number
  label: string
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const notice = useRef<HTMLDivElement>(null)
  const restoreFocus = useEffectEvent(() => onRestoreFocus?.())
  useLayoutEffect(() => {
    const element = notice.current
    return () => {
      if (element?.contains(document.activeElement)) restoreFocus()
    }
  }, [])
  const measured = bufferedAhead !== undefined && Number.isFinite(bufferedAhead)
  return (
    <div
      ref={notice}
      className="player-loading"
      data-operation={wait.operation}
    >
      <div className="player-loading-line">
        {wait.operation !== 'seeking' && <PlayerLoadingSpinner />}
        <div className="player-loading-copy">
          {wait.operation !== 'seeking' && (
            <span className="player-loading-label" aria-hidden="true">
              {label}
            </span>
          )}
          {stage >= 2 && (
            <button
              type="button"
              className="player-loading-details-toggle"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded((value) => !value)}
            >
              {t('Détails')} <ChevronDown size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {stage >= 2 && (
        <div
          id={detailsId}
          hidden={!expanded}
          className="player-loading-details"
        >
          {method && <p>{t(methodLabels[method])}</p>}
          {measured && (
            <p>
              {t('{seconds} s en mémoire à {time}', {
                seconds: Math.floor(Math.max(0, bufferedAhead)),
                time: formatTime(wait.position),
              })}
            </p>
          )}
          {!method && !measured && (
            <p>{t('En attente des informations de lecture.')}</p>
          )}
        </div>
      )}
      {stage >= 3 && (onRetry || (onLowerQuality && Boolean(lowerBitrate))) && (
        <div className="player-loading-actions">
          {onRetry && (
            <button type="button" onClick={onRetry}>
              <RotateCcw size={14} aria-hidden="true" /> {t('Réessayer')}
            </button>
          )}
          {onLowerQuality && lowerBitrate !== undefined && lowerBitrate > 0 && (
            <button type="button" onClick={onLowerQuality}>
              {t('Réduire la qualité · {rate} Mbit/s', {
                rate: lowerBitrate / 1_000_000,
              })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
