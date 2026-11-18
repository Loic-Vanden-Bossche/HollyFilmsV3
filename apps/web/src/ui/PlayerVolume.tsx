import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { Volume1, Volume2, VolumeX } from 'lucide-react'
import '../player.css'

export function PlayerVolume({
  value,
  muted,
  onChange,
  onMute,
}: {
  value: number
  muted: boolean
  onChange: (value: number) => void
  onMute: () => void
}) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const level = muted ? 0 : Math.max(0, Math.min(1, value))
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2
  return (
    <div
      className="player-volume-control"
      role="group"
      data-motion={reduced ? 'reduced' : 'full'}
      aria-label={t('Volume audio')}
    >
      <Tooltip>
        <button
          type="button"
          className="player-icon"
          aria-label={muted ? t('Rétablir le son') : t('Couper le son')}
          aria-pressed={muted}
          onClick={onMute}
        >
          <Icon />
        </button>
      </Tooltip>
      <div className="player-volume-adjust">
        <div className="player-volume-meter" aria-hidden="true">
          {Array.from({ length: 20 }, (_, index) => (
            <i
              key={index}
              style={{ height: 4 + index * 0.7 }}
              data-lit={level * 20 > index}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={level}
          aria-label={t('Volume')}
          aria-valuetext={`${Math.round(level * 100)} %`}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
      </div>
      <output className="player-volume-value" aria-hidden="true">
        {Math.round(level * 100)}
        <small>%</small>
      </output>
    </div>
  )
}
