import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { motion, useReducedMotion } from 'motion/react'
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
  onCast: () => void
  onSync: () => void
}) {
  const { t } = useI18n()
  const reduced = useReducedMotion()
  return (
    <motion.div
      className="player-session-actions"
      role="group"
      aria-label={t('Regarder ensemble')}
      initial={{ opacity: 0, y: reduced ? 0 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : 0.12 }}
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
            style={disabled || syncing ? { pointerEvents: 'none' } : undefined}
            disabled={disabled || syncing}
            aria-pressed={Boolean(casting)}
            onClick={onCast}
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
            style={disabled || casting ? { pointerEvents: 'none' } : undefined}
            disabled={disabled || casting}
            aria-pressed={Boolean(syncing)}
            onClick={onSync}
          >
            <Users />
          </button>
        </span>
      </Tooltip>
    </motion.div>
  )
}
