import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Captions, Minus, Plus, RotateCcw, X } from 'lucide-react'
import '../player.css'

export function SubtitleOffset({
  value,
  onChange,
  onClose,
}: {
  value: number
  onChange: (value: number) => void
  onClose: () => void
}) {
  const { t, locale } = useI18n()
  const seconds = value.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  })
  const reduced = useReducedMotion()
  const panel = useRef<HTMLElement>(null)
  const slider = useRef<HTMLInputElement>(null)
  const change = (next: number) =>
    onChange(Math.max(-120, Math.min(120, Math.round(next * 10) / 10)))
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    slider.current?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target)
      )
        onClose()
    }
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [onClose])
  return (
    <motion.section
      ref={panel}
      className="player-subtitle-offset"
      aria-label={t('Décalage des sous-titres')}
      initial={{ opacity: 0, y: reduced ? 0 : -16, scale: reduced ? 1 : 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduced ? 0 : -10 }}
      transition={{ duration: reduced ? 0.1 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <header>
        <Captions size={18} />
        <h2>{t('Synchronisation des sous-titres')}</h2>
        <Tooltip>
          <button
            type="button"
            className="player-icon"
            aria-label={t('Fermer le décalage')}
            onClick={onClose}
          >
            <X />
          </button>
        </Tooltip>
      </header>
      <div className="player-offset-controls">
        <Tooltip>
          <motion.button
            type="button"
            className="player-icon"
            aria-label={t('Avancer de 0,1 seconde')}
            disabled={value <= -120}
            onClick={() => change(value - 0.1)}
            whileTap={reduced ? undefined : { scale: 0.9 }}
          >
            <Minus />
          </motion.button>
        </Tooltip>
        <div className="player-offset-range">
          <div className="player-offset-track" aria-hidden="true">
            <motion.i
              initial={false}
              animate={{
                left: `${Math.min(50, (value + 120) / 2.4)}%`,
                width: `${Math.abs(value) / 2.4}%`,
              }}
              transition={{ duration: reduced ? 0 : 0.1 }}
            />
            <span />
          </div>
          <input
            ref={slider}
            type="range"
            min={-120}
            max={120}
            step={0.1}
            value={value}
            aria-label={t('Décalage des sous-titres')}
            aria-valuetext={t('{value} secondes', { value: seconds })}
            onChange={(event) => change(Number(event.currentTarget.value))}
          />
        </div>
        <Tooltip>
          <motion.button
            type="button"
            className="player-icon"
            aria-label={t('Retarder de 0,1 seconde')}
            disabled={value >= 120}
            onClick={() => change(value + 0.1)}
            whileTap={reduced ? undefined : { scale: 0.9 }}
          >
            <Plus />
          </motion.button>
        </Tooltip>
        <output>{t('{value} s', { value: seconds })}</output>
        <Tooltip>
          <button
            type="button"
            className="player-icon"
            aria-label={t('Réinitialiser le décalage')}
            disabled={value === 0}
            onClick={() => {
              onChange(0)
              slider.current?.focus()
            }}
          >
            <RotateCcw />
          </button>
        </Tooltip>
      </div>
      <p>
        <span>{t('− Plus tôt')}</span>
        <span>{t('Plus tard +')}</span>
      </p>
    </motion.section>
  )
}
