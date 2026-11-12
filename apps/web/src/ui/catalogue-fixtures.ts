// Local graphic fixtures: stories never depend on the Jellyfin catalogue or external posters.
const titles = [
  'ORBITAL',
  'SIGNAL',
  'NEON',
  'VERTIGO',
  'CONTACT',
  'VECTOR',
  'ECHO',
  'ARCHIVE',
  'NEXUS',
]
export const catalogueItems = titles.map((title, index) => ({
  id: String(index),
  title,
  kind: index % 3 === 0 ? ('Série' as const) : ('Film' as const),
  year: 2026,
  poster:
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${['#173e48', '#152e5a', '#245465'][index % 3]}"/><stop offset="1" stop-color="#080f1b"/></linearGradient><radialGradient id="glow"><stop stop-color="${index % 2 ? '#3b82f6' : '#4ade80'}"/><stop offset="1" stop-color="#080f1b" stop-opacity="0"/></radialGradient></defs><path fill="url(#bg)" d="M0 0h400v600H0z"/><circle cx="${100 + index * 20}" cy="230" r="220" fill="url(#glow)" opacity=".7"/><g fill="none" stroke="#b0f5e8" opacity=".45" transform="translate(200 260) rotate(${index * 25})"><ellipse rx="120" ry="180"/><ellipse rx="90" ry="170"/><ellipse rx="60" ry="160"/><path d="M-180 0H180M0-200V200"/></g><text x="200" y="76" text-anchor="middle" fill="#b0f5e8" font-family="sans-serif" font-size="10" letter-spacing="5">HOLLYFILMS · DEMO</text><text x="200" y="455" text-anchor="middle" fill="#ecf4fb" font-family="sans-serif" font-weight="700" font-size="42" letter-spacing="5">${title}</text></svg>`,
    ),
}))
