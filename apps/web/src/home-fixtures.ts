import type { MediaItem } from '@hollyfilms/shared/library'
import { catalogueItems } from './ui/catalogue-fixtures.ts'

const backdrop =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><radialGradient id="space"><stop stop-color="#164e62"/><stop offset="1" stop-color="#050b17"/></radialGradient><radialGradient id="planet" cx=".25" cy=".15"><stop stop-color="#70d5d1"/><stop offset=".3" stop-color="#275c72"/><stop offset=".7" stop-color="#11243d"/><stop offset="1" stop-color="#070d18"/></radialGradient><linearGradient id="ring"><stop stop-color="#4ade80" stop-opacity=".1"/><stop offset=".5" stop-color="#9be5e6"/><stop offset="1" stop-color="#3b82f6" stop-opacity=".1"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="50"/></filter></defs><path fill="url(#space)" d="M0 0h1920v1080H0z"/><ellipse cx="1400" cy="480" rx="520" ry="190" fill="#2584b7" opacity=".16" filter="url(#blur)"/><g fill="#c2dfe8" opacity=".65">${Array.from({ length: 100 }, (_, i) => '<circle cx="' + ((i * 197 + 117) % 1920) + '" cy="' + ((i * 73 + 29) % 1080) + '" r="' + (i % 3 === 0 ? 1.5 : 0.7) + '"/>').join('')}</g><circle cx="1310" cy="490" r="286" fill="url(#planet)"/><circle cx="1310" cy="490" r="287" stroke="#7dded8" stroke-opacity=".3" fill="none"/><g transform="translate(1310 490) rotate(-28)" fill="none" stroke="url(#ring)"><ellipse rx="525" ry="95" stroke-width="24" opacity=".16"/><ellipse rx="510" ry="83" stroke-width="6" opacity=".6"/><ellipse rx="535" ry="98" stroke-width="2" opacity=".7"/></g><path d="m970 740 85-28 110 16-94 4-11 18-22-16z" fill="#020811"/><path d="m1038 734 22 16 9-15" fill="#347b95"/><circle cx="1790" cy="220" r="48" fill="#234055" opacity=".65"/></svg>`,
  )

export const homeItems: MediaItem[] = catalogueItems.map((item, index) => ({
  ...item,
  title: item.title[0] + item.title.slice(1).toLowerCase(),
  backdrop,
  logo:
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400"><defs><linearGradient id="ink"><stop stop-color="#b0f5e8"/><stop offset="1" stop-color="#ecf4fb"/></linearGradient></defs><text x="0" y="280" fill="url(#ink)" font-family="sans-serif" font-size="180" font-weight="700" letter-spacing="12">${item.title.toUpperCase()}</text></svg>`,
    ),
  overview:
    index === 0
      ? 'À bord d’une station isolée, une équipe reçoit un signal provenant d’une orbite abandonnée. Une mission de reconnaissance remet en question tout ce qu’elle pensait savoir.'
      : 'Un nouveau signal, une piste à suivre. Découvrez ce titre dans la bibliothèque de démonstration.',
  genres: ['Science-fiction', index % 2 ? 'Thriller' : 'Aventure'],
  rating: 8.2 - index * 0.2,
  criticRating: 94 - index,
  quality: index % 2 ? '1080p' : '4K UHD',
  audioLanguages: index % 2 ? ['fr', 'en', 'ja'] : ['fr', 'en'],
  editions: index === 0 ? ['Version longue'] : [],
  watched: index === 3,
  minutes: 118 + index,
  classification: '12+',
  progress: 0,
}))
export const homeResume = homeItems.slice(1, 4).map((item, index) => ({
  ...item,
  thumb:
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
        <image width="640" height="360" href="${backdrop}"/>
        <text x="34" y="286" fill="#f1f7ff" font-family="sans-serif" font-size="52" font-weight="bold" letter-spacing="3">${item.title.toUpperCase()}</text>
      </svg>`,
    ),
  progress: 0.24 + index * 0.19,
  remainingMinutes: 76 - index * 18,
}))

// A larger catalogue lets the home stories exercise the independent shelves.
const shelfProgrammes = [
  [
    'Thriller',
    'Heure de pointe',
    'Angle mort',
    'Le Guetteur',
    'Silence radio',
    'La Planque',
    'Minuit trente',
  ],
  [
    'Aventure',
    'Au large',
    'Grand Nord',
    'Les Éclaireurs',
    'Ligne de crête',
    'Courant sud',
    'Le Col',
  ],
  [
    'Fantastique',
    'La Traversée',
    'L’Autre Rive',
    'Poussière de lune',
    'Les Veilleurs',
    'Métamorphoses',
    'Équinoxe',
  ],
  [
    'Drame',
    'Trois jours',
    'Sur le départ',
    'Le Grand Bain',
    'Première neige',
    'De passage',
    'Les Beaux Jours',
  ],
  [
    'Comédie',
    'Au suivant',
    'Le Voisin',
    'La Répétition',
    'Double jeu',
    'Terrain libre',
    'Un dimanche',
  ],
  [
    'Science-fiction',
    'Horizon rouge',
    'L’Orbite bleue',
    'Le Transit',
    'Protocole zéro',
    'Onde longue',
    'Le Sillage',
  ],
]

export const homeShelfItems: MediaItem[] = Array.from(
  { length: 36 },
  (_, i) => {
    const group = i % shelfProgrammes.length
    const programme = shelfProgrammes[group]
    const title = programme[1 + Math.floor(i / shelfProgrammes.length)]
    const base = homeItems[i % homeItems.length]
    const illustration = String(base.poster)
    const hue = [190, 55, 260, 310, 120, 0][group]
    return {
      ...base,
      id: 'shelf-' + i,
      title,
      kind: group === 5 ? 'Série' : 'Film',
      genres: [programme[0]],
      rating: 7.2 + (i % 16) / 10,
      minutes: group === 4 ? 82 + (i % 8) : 100 + i,
      poster:
        'data:image/svg+xml,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
            <defs><filter id="tone"><feColorMatrix type="hueRotate" values="${hue}"/></filter><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#080c14" stop-opacity="0"/><stop offset="1" stop-color="#080c14"/></linearGradient></defs>
            <svg width="400" height="600" viewBox="80 86 215 320" preserveAspectRatio="xMidYMid slice"><image href="${illustration}" width="400" height="600" filter="url(#tone)"/></svg>
            <rect y="350" width="400" height="250" fill="url(#shade)"/>
            <text x="24" y="538" fill="#fff" font-family="sans-serif" font-weight="bold" font-size="${Math.min(52, 610 / title.length)}">${title}</text>
          </svg>`,
        ),
      logo:
        'data:image/svg+xml,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 96"><text x="0" y="75" fill="white" font-family="sans-serif" font-size="58" font-weight="bold">${title}</text></svg>`,
        ),
      thumb:
        'data:image/svg+xml,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><filter id="tone"><feColorMatrix type="hueRotate" values="${hue}"/></filter></defs><rect width="640" height="360" fill="#101a28"/><image href="${illustration}" y="-220" width="640" height="960" filter="url(#tone)"/><text x="30" y="316" fill="white" font-family="sans-serif" font-size="42" font-weight="bold">${title}</text></svg>`,
        ),
    }
  },
)
