import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Palette, RotateCcw } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { cinemaMotion } from '../components/reactbits/policy.ts'
import {
  classicSubtitle,
  subtitleYellow,
  type SubtitleSlot,
  type SubtitleStyle,
  type SubtitleStyles,
} from '../playback/preferences.ts'
import './subtitle-appearance.css'

export function SubtitleAppearance({
  styles,
  hasSecondary,
  onChange,
  burned = false,
}: {
  styles: SubtitleStyles
  hasSecondary: boolean
  onChange: (slot: SubtitleSlot, style: SubtitleStyle) => void
  burned?: boolean
}) {
  const { t, locale } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const [open, setOpen] = useState(false)
  const [selectedSlot, setSlot] = useState<SubtitleSlot>('primary')
  const slot = hasSecondary ? selectedSlot : 'primary'
  const id = useId()
  const style = styles[slot]
  const size = new Intl.NumberFormat(locale, { style: 'percent' }).format(
    style.scale,
  )
  const transition = {
    duration: reduced ? 0 : cinemaMotion.interaction,
    ease: cinemaMotion.ease,
  }
  const update = (patch: Partial<SubtitleStyle>) =>
    onChange(slot, { ...style, ...patch, customized: true })
  return (
    <section className="caption-editor">
      <button
        className="caption-editor-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Palette size={16} aria-hidden="true" />
        <strong>{t('Apparence des sous-titres')}</strong>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={transition}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </motion.span>
      </button>
      <div id={id} inert={!open}>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              className="caption-editor-fold"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transition}
            >
              <div className="caption-editor-body">
                {hasSecondary && (
                  <div
                    className="caption-editor-slots"
                    role="group"
                    aria-label={t('Piste à personnaliser')}
                  >
                    {(['primary', 'secondary'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={slot === value}
                        onClick={() => setSlot(value)}
                      >
                        <span
                          aria-hidden="true"
                          style={{ color: styles[value].color }}
                        >
                          Aa
                        </span>
                        {value === 'primary'
                          ? t('Principale')
                          : t('Secondaire')}
                      </button>
                    ))}
                  </div>
                )}
                {burned && slot === 'primary' ? (
                  <p>{t('Cette piste est incrustée dans la vidéo.')}</p>
                ) : (
                  <motion.div
                    className="caption-editor-options"
                    key={slot}
                    initial={{ opacity: reduced ? 1 : 0 }}
                    animate={{ opacity: 1 }}
                    transition={transition}
                  >
                    <div
                      className="caption-editor-colors"
                      role="group"
                      aria-label={t('Couleur')}
                    >
                      {[
                        [classicSubtitle.color, t('Blanc')],
                        [subtitleYellow, t('Jaune')],
                      ].map(([color, label]) => (
                        <button
                          key={color}
                          type="button"
                          aria-pressed={color === style.color}
                          onClick={() => update({ color })}
                        >
                          <i style={{ backgroundColor: color }}>
                            {color === style.color && (
                              <Check size={12} aria-hidden="true" />
                            )}
                          </i>
                          {label}
                        </button>
                      ))}
                      <input
                        type="color"
                        aria-label={t('Couleur personnalisée')}
                        value={style.color}
                        onChange={(event) =>
                          update({ color: event.target.value })
                        }
                      />
                    </div>
                    <label className="caption-editor-size">
                      <span>{t('Taille')}</span>
                      <input
                        type="range"
                        min={0.7}
                        max={1.8}
                        step={0.1}
                        aria-label={t('Taille')}
                        aria-valuetext={size}
                        value={style.scale}
                        onChange={(event) =>
                          update({ scale: Number(event.target.value) })
                        }
                      />
                      <output>{size}</output>
                    </label>
                    <button
                      className="caption-editor-reset"
                      type="button"
                      disabled={!style.customized}
                      onClick={() => onChange(slot, classicSubtitle)}
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      {t('Rétablir le style d’origine')}
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
