import { homeItems } from './home-fixtures.ts'
import type { CollectionItem } from '@hollyfilms/shared/library'

export const collectionFixtures: CollectionItem[] = homeItems
  .slice(0, 6)
  .map((item, index) => ({
    id: `collection-${index}`,
    title: `${item.title} — Collection`,
    overview:
      'Une collection de démonstration pour explorer les titres associés.',
    poster: item.poster,
    backdrop: item.backdrop,
    count: index + 2,
  }))
export const episodeFixtures = homeItems.slice(0, 3).map((item, index) => ({
  ...item,
  kind: 'Épisode' as const,
  episode: `S1 · E${index + 2} · Le signal`,
  progress: 0.35,
  remainingMinutes: 28,
  playbackPosition: 720,
}))
