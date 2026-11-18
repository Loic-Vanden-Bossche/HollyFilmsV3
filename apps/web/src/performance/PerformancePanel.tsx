import { useEffect, useRef, useSyncExternalStore } from 'react'
import { motion } from 'motion/react'
import { X, Activity } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Select } from '../ui/Select.tsx'
import { lockBodyScroll } from '../ui/body-scroll-lock.ts'
import {
  usePerformanceController,
  usePerformanceReducedMotion,
} from './PerformanceProvider.tsx'
import {
  performanceProfiles,
  type PerformanceTrace,
  type SwitchReason,
} from './profiles.ts'

const reasons = {
  slow: 'Ralentissement mesuré',
  stable: 'Performance stable',
  manual: 'Sélection manuelle',
  auto: 'Retour au mode automatique',
} as const
const states = {
  warmup: 'Étalonnage',
  active: 'Mesure active',
  idle: 'En attente d’activité',
  playback: 'Adaptation suspendue pendant la lecture',
} as const
const profileLabel = (id: string) =>
  performanceProfiles.find((entry) => entry.id === id)!.label

export function PerformanceGraph({ trace }: { trace: PerformanceTrace }) {
  const { t } = useI18n()
  const samples = trace.samples
  const end = Math.max(
    samples.at(-1)?.time ?? 0,
    trace.events.at(-1)?.time ?? 0,
  )
  const firstEvent = trace.events.find((event) => event.time >= end - 240000)
  const start = Math.min(samples[0]?.time ?? end, firstEvent?.time ?? end)
  const span = Math.max(20000, end - start)
  const maximum = Math.max(
    120,
    ...samples.map((sample) => Math.ceil(sample.fps / 30) * 30),
  )
  const x = (time: number) => 38 + ((time - start) / span) * 700
  const y = (fps: number) => 124 - (Math.max(0, fps) / maximum) * 110
  let path = ''
  samples.forEach((sample, index) => {
    const previous = samples[index - 1]
    const move = !previous || sample.time - previous.time > 3500
    path += `${move ? 'M' : 'L'}${x(sample.time).toFixed(1)},${y(sample.fps).toFixed(1)} `
  })
  return (
    <figure className="performance-graph">
      <svg
        viewBox="0 0 760 175"
        role="img"
        aria-label={t('Fréquence des images et changements de profil')}
      >
        {[0, maximum / 4, maximum / 2, maximum].map((fps) => (
          <g key={fps}>
            <line
              x1="38"
              x2="738"
              y1={y(fps)}
              y2={y(fps)}
              stroke="#8ba3be33"
              strokeDasharray="3 5"
            />
            <text x="28" y={y(fps) + 4} textAnchor="end">
              {fps}
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          stroke="#7dded8"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {samples.map((sample) => (
          <rect
            key={sample.time}
            x={x(sample.time)}
            y="145"
            width="5"
            height="12"
            rx="2"
            fill={
              ['#8ba3be', '#74b5aa', '#4ade80', '#46b8d3', '#3b82f6'][
                performanceProfiles.findIndex(
                  (entry) => entry.id === sample.profile,
                )
              ]
            }
          >
            <title>
              {t(profileLabel(sample.profile))} · {Math.round(sample.fps)} FPS ·{' '}
              {t(states[sample.state])}
            </title>
          </rect>
        ))}
        {trace.events
          .filter((event) => event.time >= start && event.time <= start + span)
          .map((event, index) => (
            <g key={`${event.time}-${index}`}>
              <line
                x1={x(event.time)}
                x2={x(event.time)}
                y1="10"
                y2="160"
                stroke="#4ade80"
                strokeDasharray="4 3"
              />
              <circle cx={x(event.time)} cy="10" r="4" fill="#4ade80" />
              <title>
                {t(profileLabel(event.from))} → {t(profileLabel(event.to))} ·{' '}
                {t(reasons[event.reason])}
              </title>
            </g>
          ))}
        <text x="38" y="173">
          0 s
        </text>
        <text x="738" y="173" textAnchor="end">
          {Math.round(span / 1000)} s
        </text>
      </svg>
      <figcaption>
        {t(
          'FPS mesurés par rAF · pointillés = changement de profil · bande = profil actif',
        )}
      </figcaption>
    </figure>
  )
}

export default function PerformancePanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const controller = usePerformanceController()
  const settings = useSyncExternalStore(
    controller.subscribeSettings,
    controller.getSettings,
    controller.getSettings,
  )
  const trace = useSyncExternalStore(
    controller.subscribeTrace,
    controller.getTrace,
    controller.getTrace,
  )
  const reduced = usePerformanceReducedMotion()
  const dialog = useRef<HTMLDialogElement>(null)
  const backdropPointer = useRef(false)
  const current = trace.samples.at(-1)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current!
    if (!element) return
    const unlock = lockBodyScroll()
    element.showModal()
    return () => {
      element.close()
      unlock()
      previous?.focus({ preventScroll: true })
    }
  }, [])
  if (!settings.admin) return null
  const number = (value: number | null | undefined, suffix = '') =>
    value == null ? '—' : `${Math.round(value)}${suffix}`
  return (
    <motion.dialog
      ref={dialog}
      className="performance-dialog"
      aria-label={t('Débogage des performances')}
      onKeyDownCapture={(event) => {
        if (
          event.key === 'Escape' &&
          !event.currentTarget.querySelector('.holly-select-popup[data-open]')
        ) {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onPointerDownCapture={(event) => {
        backdropPointer.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (backdropPointer.current && event.target === event.currentTarget)
          onClose()
        backdropPointer.current = false
      }}
    >
      <section className="performance-panel">
        <header>
          <div>
            <p className="performance-eyebrow">
              <Activity size={14} /> {t('Administrateur')}
            </p>
            <h2>{t('Performances')}</h2>
          </div>
          <button
            type="button"
            className="glass-control"
            onClick={onClose}
            aria-label={t('Fermer')}
          >
            <X size={20} />
          </button>
        </header>
        <div className="performance-selection">
          <label>
            {t('Mode de performance')}
            <Select
              aria-label={t('Mode de performance')}
              value={settings.selection}
              onValueChange={(value) => {
                if (
                  value === 'auto' ||
                  performanceProfiles.some((entry) => entry.id === value)
                )
                  controller.select(
                    value as typeof settings.selection,
                    performance.now(),
                  )
              }}
            >
              <option value="auto">{t('Automatique')}</option>
              {performanceProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {t(profile.label)}
                </option>
              ))}
            </Select>
          </label>
          <div className="performance-current" role="status">
            <span>{t('Profil actif')}</span>
            <strong>{t(settings.profile.label)}</strong>
            <small>
              {settings.selection === 'auto'
                ? t('Automatique')
                : t('Sélection manuelle')}
            </small>
          </div>
        </div>
        <dl className="performance-metrics">
          <div>
            <dt>FPS (rAF)</dt>
            <dd>{number(current?.fps)}</dd>
          </div>
          <div>
            <dt>{t('Image p95')}</dt>
            <dd>{number(current?.frameP95, ' ms')}</dd>
          </div>
          <div>
            <dt>{t('Temps bloqué')}</dt>
            <dd>
              {number(
                current?.blocking == null ? null : current.blocking * 100,
                '%',
              )}
            </dd>
          </div>
          <div>
            <dt>{t('Interaction maximale')}</dt>
            <dd>{number(current?.interaction, ' ms')}</dd>
          </div>
        </dl>
        <p className="performance-status">
          {current ? t(states[current.state]) : t('Mesure en cours…')}
        </p>
        <PerformanceGraph trace={trace} />
        <p className="performance-help">
          {t(
            'Réduction après deux mesures lentes. Remontée après 30 secondes stables en activité. Les onglets masqués sont exclus.',
          )}
        </p>
        <p className="performance-help">
          {t(
            'La préférence système de mouvement réduit reste prioritaire. — indique une mesure indisponible.',
          )}
        </p>
        <h3>{t('Changements de profil')}</h3>
        {trace.events.length ? (
          <ol className="performance-events">
            {trace.events
              .slice(-8)
              .reverse()
              .map((event, index) => (
                <li key={`${event.time}-${index}`}>
                  <time>{Math.round(event.time / 1000)} s</time>
                  <strong>
                    {t(profileLabel(event.from))} → {t(profileLabel(event.to))}
                  </strong>
                  <span>{t(reasons[event.reason as SwitchReason])}</span>
                </li>
              ))}
          </ol>
        ) : (
          <p>{t('Aucun changement pour le moment.')}</p>
        )}
      </section>
    </motion.dialog>
  )
}
