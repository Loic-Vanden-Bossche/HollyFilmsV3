import type {
  DiscoveryTitle,
  MediaRequestItem,
  RequestServices,
} from '@hollyfilms/shared/requests'
import { catalogueItems } from './ui/catalogue-fixtures.ts'
export const requestSession = {
  deviceId: 'requests-story-device',
  accessToken: 'requests-story-token',
}
export const discoveryFixtures: DiscoveryTitle[] = catalogueItems
  .slice(0, 6)
  .map((item, index) => ({
    id: 100 + index,
    type: index === 5 ? 'tv' : 'movie',
    title: item.title,
    overview: 'Un titre de démonstration à ajouter à votre bibliothèque.',
    year: '2026',
    poster: item.poster,
    rating: 7.8,
    mediaStatus: index === 4 ? 2 : 1,
    requested: index === 4,
  }))
export const requestServices: RequestServices = {
  enabled: true,
  movies: true,
  series: false,
}
export const adminRequestServices: RequestServices = {
  ...requestServices,
  seerrUrl: 'https://seerr.example.com',
  services: [
    { id: 0, name: 'Films HD', type: 'movie', isDefault: true, is4k: false },
  ],
  counts: { total: 24, pending: 4, processing: 2, available: 18 },
}
export const requestFixtures: MediaRequestItem[] = discoveryFixtures
  .slice(0, 4)
  .map((title, index) => ({
    id: index + 1,
    title: { ...title, mediaStatus: index === 2 ? 5 : 2 },
    status: [1, 2, 5, 4][index],
    createdAt: '2026-11-16T19:30:00Z',
    updatedAt: '2026-11-17T10:00:00Z',
    is4k: index === 2,
    seasons: [],
    downloads:
      index === 1
        ? [{ progress: 63.7, status: 'downloading', remaining: '00:08:24' }]
        : [],
    admin: {
      requestedBy: index % 2 ? 'Alex' : 'Camille',
      modifiedBy: index ? 'Loïc' : undefined,
      profileId: 2,
      rootFolder: '/media/films',
      serverId: 0,
      externalId: 240 + index,
      serviceUrl: 'https://radarr.example.com/movie/240',
    },
  }))
