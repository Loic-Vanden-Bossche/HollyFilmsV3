import type { Translate } from './i18n/messages.ts'

/** Format library durations, which the SDK exposes in minutes. */
export function formatDuration(
  minutes: number | undefined,
  t: Translate,
): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return ''
  const total = Math.round(minutes)
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return hours
    ? rest
      ? t('{hours} h {minutes}', {
          hours,
          minutes: String(rest).padStart(2, '0'),
        })
      : t('{hours} h', { hours })
    : t('{minutes} min', { minutes: total })
}
