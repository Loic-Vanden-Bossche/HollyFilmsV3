import { motion } from 'motion/react'
import { Check, CircleAlert, Clock3, LoaderCircle } from 'lucide-react'
import type { SubtitleRequestStatus } from '@hollyfilms/shared/subtitles'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { subtitleStatuses } from '../subtitle-status.ts'
import { useMotionPolicy } from '../components/reactbits/policy.ts'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import './subtitles.css'

export function SubtitleFeedback({
  title,
  description,
  tone = 'loading',
  skeleton = false,
}: {
  title: string
  description?: string
  tone?: 'loading' | 'success' | 'error' | 'neutral'
  skeleton?: boolean
}) {
  const reduced = usePerformanceReducedMotion()
  const { pageVisible } = useMotionPolicy()
  const running = tone === 'loading' && !reduced && pageVisible
  const Icon =
    tone === 'loading'
      ? LoaderCircle
      : tone === 'success'
        ? Check
        : tone === 'error'
          ? CircleAlert
          : Clock3
  return (
    <motion.div
      className="subtitle-feedback-card"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -6 }}
      transition={{ duration: reduced ? 0.1 : 0.22 }}
    >
      <div className="subtitle-feedback-copy">
        <motion.span
          className="subtitle-feedback-icon"
          aria-hidden="true"
          animate={{ rotate: running ? 360 : 0 }}
          transition={
            running
              ? { duration: 1.4, repeat: Infinity, ease: 'linear' }
              : { duration: 0 }
          }
        >
          <Icon size={21} />
        </motion.span>
        <div>
          <strong>{title}</strong>
          {description && <p>{description}</p>}
        </div>
      </div>
      {tone === 'loading' && (
        <div className="subtitle-loading-track" aria-hidden="true">
          <motion.i
            animate={running ? { x: ['-100%', '350%'] } : { x: '100%' }}
            transition={
              running
                ? { duration: 1.7, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0 }
            }
          />
        </div>
      )}
      {skeleton && (
        <div className="subtitle-skeleton" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
    </motion.div>
  )
}

export function SubtitleStatusBadge({
  status,
}: {
  status: SubtitleRequestStatus
}) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  return (
    <motion.span
      className="subtitle-status-badge"
      data-state={status}
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -4 }}
      transition={{ duration: 0.18 }}
    >
      {status === 'DOWNLOADED' ? (
        <Check size={13} />
      ) : status === 'PENDING' ? (
        <Clock3 size={13} />
      ) : status === 'DOWNLOADING' ? (
        <LoaderCircle size={13} />
      ) : (
        <CircleAlert size={13} />
      )}
      {t(subtitleStatuses[status])}
    </motion.span>
  )
}
