import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { motion } from 'motion/react'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { duration, ease } from '../motion/tokens.ts'
import { Cast, Users } from 'lucide-react'
import '../player.css'

export function PlayerSessionActions({
  casting,
  syncing,
  disabled,
  onCast,
  onSync,
}: {
  casting?: boolean
  syncing?: boolean
  disabled?: boolean
  onCast: (trigger: HTMLButtonElement) => void
  onSync: (trigger: HTMLButtonElement) => void
}) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  return (
    <motion.div
      className="player-session-actions"
      role="group"
      aria-label={t('Regarder ensemble')}
      initial={reduced ? false : { opacity: 0.7, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : duration.micro, ease: ease.out }}
    >
      <Tooltip
        content={
          syncing
            ? t('Quittez SyncPlay pour diffuser')
            : t('Chromecast et appareils')
        }
      >
        <span
          className="inline-flex"
          tabIndex={disabled || syncing ? 0 : undefined}
        >
          <button
            type="button"
            className="player-icon"
            aria-label={t('Chromecast et appareils')}
            data-player-menu-trigger="devices"
            style={disabled || syncing ? { pointerEvents: 'none' } : undefined}
            disabled={disabled || syncing}
            aria-pressed={Boolean(casting)}
            onClick={(event) => onCast(event.currentTarget)}
          >
            <Cast />
          </button>
        </span>
      </Tooltip>
      <Tooltip
        content={
          casting
            ? t('Reprenez la lecture ici pour utiliser SyncPlay')
            : t('SyncPlay · Regarder ensemble')
        }
      >
        <span
          className="inline-flex"
          tabIndex={disabled || casting ? 0 : undefined}
        >
          <button
            type="button"
            className="player-icon"
            aria-label="SyncPlay"
            data-player-menu-trigger="sync"
            style={disabled || casting ? { pointerEvents: 'none' } : undefined}
            disabled={disabled || casting}
            aria-pressed={Boolean(syncing)}
            onClick={(event) => onSync(event.currentTarget)}
          >
            <Users />
          </button>
        </span>
      </Tooltip>
    </motion.div>
  )
}
