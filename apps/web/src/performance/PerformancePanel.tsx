import { useRef, useSyncExternalStore } from 'react'
import { motion } from 'motion/react'
import { X, Activity } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { PerformancePreference } from './PerformancePreference.tsx'
import { useModalPresence } from '../ui/use-modal-presence.ts'
import { duration, ease } from '../motion/tokens.ts'
import {
  usePerformanceController,
  usePerformanceReducedMotion,
} from './PerformanceProvider.tsx'
import { performanceProfiles, type PerformanceTrace } from './profiles.ts'

const states = {
  warmup: 'Étalonnage',
  active: 'Mesure active',
  idle: 'En attente d’activité',
  playback: 'Lecture en cours',
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
            fill={sample.profile === 'light' ? '#8ba3be' : '#46b8d3'}
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
                {t(profileLabel(event.from))} → {t(profileLabel(event.to))}
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
  const { dialog, surface, present } = useModalPresence()
  const backdropPointer = useRef(false)
  const current = trace.samples.at(-1)
  if (!settings.admin) return null
  const number = (value: number | null | undefined, suffix = '') =>
    value == null ? '—' : `${Math.round(value)}${suffix}`
  return (
    <motion.dialog
      ref={dialog}
      className="performance-dialog"
      inert={!present}
      data-exiting={!present || undefined}
      aria-label={t('Débogage des performances')}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? duration.press : duration.micro }}
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
      <motion.section
        ref={surface}
        className="performance-panel"
        initial={{ y: reduced ? 0 : 12, scale: reduced ? 1 : 0.975 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: reduced ? 0 : 8, scale: reduced ? 1 : 0.985 }}
        transition={{ duration: reduced ? 0 : duration.panel, ease: ease.out }}
      >
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
          <PerformancePreference />
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
                </li>
              ))}
          </ol>
        ) : (
          <p>{t('Aucun changement pour le moment.')}</p>
        )}
      </motion.section>
    </motion.dialog>
  )
}
