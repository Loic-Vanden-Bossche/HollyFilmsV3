import type { SubtitleRequestStatus } from '@hollyfilms/shared/subtitles'
export const subtitleStatuses = {
  PENDING: 'En attente',
  DOWNLOADING: 'Vérification du sous-titre…',
  DOWNLOADED: 'Sous-titre installé',
  REJECTED: 'Refusée',
  FAILED: 'Échec',
} as const satisfies Record<SubtitleRequestStatus, string>
