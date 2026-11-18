import type {
  SubtitleLibrary,
  SubtitleCandidate,
  SubtitleRequest,
} from '@hollyfilms/shared/subtitles'
export const subtitleSession = {
  deviceId: 'subtitle-story',
  accessToken: 'subtitle-story-token',
}
export const subtitleItemId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
export const subtitleRequestFixture: SubtitleRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  itemId: subtitleItemId,
  sourceId: subtitleItemId,
  itemName: 'Orbital',
  sourceName: 'Version cinéma · 1080p',
  language: 'fra',
  status: 'PENDING',
  createdAt: '2026-11-17T15:00:00Z',
  requester: 'Camille',
}
export const subtitleLibraryFixture: SubtitleLibrary = {
  administrator: true,
  languages: [
    { code: 'fra', iso2: 'fr', name: 'French' },
    { code: 'eng', iso2: 'en', name: 'English' },
    { code: 'zho', iso2: 'zh', name: 'Chinese' },
  ],
  versions: [
    {
      id: subtitleItemId,
      name: 'Version cinéma · 1080p',
      tracks: [
        {
          index: 2,
          title: 'English · SRT',
          language: 'eng',
          codec: 'subrip',
          external: true,
        },
      ],
    },
    {
      id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      name: 'Version longue · 4K',
      tracks: [],
    },
  ],
  requests: [],
}
export const subtitleCandidates: SubtitleCandidate[] = [
  {
    id: 'provider_french_release',
    name: 'Orbital.2026.1080p.BluRay — French',
    provider: 'Open Subtitles',
    language: 'fra',
    format: 'srt',
    author: 'CinemaFR',
    rating: 8.5,
    downloads: 1240,
    hashMatch: true,
    forced: false,
    hearingImpaired: false,
    machineTranslated: false,
  },
]
