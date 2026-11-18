import { useId } from 'react'
import { ChevronRight, Hourglass, Timer } from 'lucide-react'
import { motion } from 'motion/react'
import { cinemaMotion } from '../components/reactbits/policy.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import './subtitle-sync-actions.css'

type Track = { canAdjust: boolean; loading: boolean }
type Slot = 'primary' | 'secondary'

export function SubtitleSyncActions({
  primary,
  secondary,
  onOpen,
}: {
  primary?: Track
  secondary?: Track
  onOpen: (slot: Slot, trigger: HTMLButtonElement) => void
}) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const id = useId()
  if (!primary) return null

  const tracks = { primary, secondary }
  const unavailable = !primary.canAdjust || (secondary && !secondary.canAdjust)
  return (
    <fieldset className="player-sync-actions" data-reduced={reduced}>
      <legend id={id}>
        <Timer size={16} aria-hidden="true" />
        {t('Corriger la synchronisation')}
      </legend>
      <div className="player-sync-tracks">
        {(['primary', 'secondary'] as const).map((slot) => {
          const track = tracks[slot]
          if (!track) return null
          const labelId = `${id}-${slot}`
          const disabled = !track.canAdjust || track.loading
          return (
            <motion.button
              key={slot}
              className="player-sync-action"
              type="button"
              aria-labelledby={`${id} ${labelId}`}
              aria-describedby={!track.canAdjust ? `${id}-hint` : undefined}
              aria-busy={track.loading || undefined}
              disabled={disabled}
              whileTap={reduced || disabled ? undefined : { scale: 0.98 }}
              transition={{
                duration: cinemaMotion.interaction,
                ease: cinemaMotion.ease,
              }}
              onClick={(event) => onOpen(slot, event.currentTarget)}
            >
              <span id={labelId}>
                {t(slot === 'primary' ? 'Piste principale' : 'Deuxième piste')}
              </span>
              {track.loading ? (
                <Hourglass size={15} aria-hidden="true" />
              ) : (
                <ChevronRight size={15} aria-hidden="true" />
              )}
            </motion.button>
          )
        })}
      </div>
      {unavailable && (
        <p id={`${id}-hint`}>
          {t('Choisissez une piste séparée en lecture locale.')}
        </p>
      )}
    </fieldset>
  )
}
