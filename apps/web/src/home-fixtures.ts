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
  progress: 0.24 + index * 0.19,
  remainingMinutes: 76 - index * 18,
}))
