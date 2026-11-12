import type {
  MediaDetailsData,
  MediaRelations,
  ReviewPage,
  WatchProviders,
} from '@hollyfilms/shared/media-details'
import { homeItems } from '../home-fixtures.ts'
const portrait = (name: string, index: number) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="${index % 2 ? '#185c63' : '#233b71'}"/><stop offset="1" stop-color="#0b1422"/></linearGradient></defs><rect width="300" height="400" fill="url(#a)"/><circle cx="150" cy="152" r="62" fill="#b3d8dc" opacity=".4"/><path d="M35 400v-40a115 115 0 0 1 230 0v40" fill="#b3d8dc" opacity=".25"/><text x="150" y="355" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#dcecf2">${name
      .split(' ')
      .map((n) => n[0])
      .join('')}</text></svg>`,
  )
export const detailedMovie: MediaDetailsData = {
  item: {
    ...homeItems[1],
    kind: 'Film',
    minutes: 201,
    quality: '4K UHD',
    audioLanguages: ['fr', 'en'],
    editions: ['Version longue'],
    classification: '12+',
    criticRating: 94,
    progress: 0.32,
    remainingMinutes: 137,
  },
  tags: [
    'exploration',
    'science-fiction',
    'voyage spatial',
    'intelligence artificielle',
    'amitié',
    'quête',
    'futur',
    'sacrifice',
    'univers parallèle',
  ],
  people: [
    'Maya Laurent',
    'Adam Moreau',
    'Nora Chen',
    'Elias Bernard',
    'Léa Morel',
    'Owen Lee',
    'Sarah Martin',
    'Alex Roy',
  ].map((name, i) => ({
    id: 'person-' + i,
    name,
    type: i === 7 ? 'Director' : 'Actor',
    role: [
      'Dr. Anna Morel',
      'Commandant Vega',
      'Iris',
      'Noah',
      'Ava',
      'Milo',
      'Sofia',
      'Réalisation',
    ][i],
    image: portrait(name, i),
  })),
  directors: ['Alex Roy'],
  writers: ['Léa Morel', 'Alex Roy'],
  studios: ['HollyFilms — studio de démonstration'],
  links: [
    { name: 'IMDb', url: 'https://www.imdb.com/' },
    { name: 'TMDB', url: 'https://www.themoviedb.org/' },
    { name: 'Letterboxd', url: 'https://letterboxd.com/' },
  ],
  chapters: [
    'Le départ',
    'Un signal inconnu',
    'La traversée',
    'Premier contact',
    'Le choix',
    'Le retour',
  ].map((name, i) => ({
    name,
    position: [0, 384, 561, 681, 1320, 1920][i],
    image: homeItems[i % homeItems.length].backdrop,
  })),
}
export const detailedRelations: MediaRelations = {
  similar: homeItems,
  collections: [
    {
      id: 'collection-demo',
      item: {
        ...homeItems[0],
        id: 'collection-demo',
        title: 'Au-delà des étoiles — Collection',
        audioLanguages: ['fr', 'en'],
      },
      title: 'Au-delà des étoiles — Collection',
      count: homeItems.length,
      poster: homeItems[0].poster,
    },
  ],
  errors: [],
}
export const detailedProviders: WatchProviders = {
  status: 'ready',
  region: 'FR',
  regions: ['FR', 'CH', 'BE', 'US'],
  url: 'https://www.themoviedb.org/',
  providers: [
    { id: 1, name: 'Amazon Prime Video', offers: ['Abonnement'] },
    { id: 2, name: 'Disney Plus', offers: ['Abonnement'] },
    { id: 3, name: 'Apple TV', offers: ['Location', 'Achat'] },
  ],
}
export const detailedReviews: ReviewPage = {
  own: null,
  total: 3,
  hasMore: false,
  external: 'ready',
  items: [
    {
      id: 'demo-1',
      author: 'Cinéphile',
      rating: 9,
      source: 'HollyFilms',
      date: '2026-10-01T12:00:00Z',
      content:
        'Une aventure spatiale portée par ses personnages et une réalisation particulièrement soignée. ' +
        'Le film prend le temps de construire son univers, sans oublier les liens entre les membres de l’équipage. '.repeat(
          6,
        ),
    },
    {
      id: 'demo-2',
      author: 'Camille',
      rating: 8,
      source: 'TMDB',
      url: 'https://www.themoviedb.org/',
      date: '2026-09-15T12:00:00Z',
      content:
        'Avis de démonstration. La mise en scène et la bande originale accompagnent un récit qui garde son cap jusqu’au bout.',
    },
    {
      id: 'demo-3',
      author: 'Alex',
      rating: 7.5,
      source: 'HollyFilms',
      date: '2026-09-03T12:00:00Z',
      content:
        'Un très beau voyage visuel. Quelques longueurs, mais des personnages auxquels on s’attache.',
    },
  ],
}
