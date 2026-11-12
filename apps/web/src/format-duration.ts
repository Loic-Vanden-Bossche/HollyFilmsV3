/** Format library durations, which the SDK exposes in minutes. */
export function formatDuration(minutes: number | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return ''
  const total = Math.round(minutes)
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return hours
    ? hours + ' h' + (rest ? ' ' + String(rest).padStart(2, '0') : '')
    : total + ' min'
}
