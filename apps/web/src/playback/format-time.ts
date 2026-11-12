export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = String(total % 60).padStart(2, '0')
  return hours
    ? hours + ':' + String(minutes).padStart(2, '0') + ':' + rest
    : minutes + ':' + rest
}
