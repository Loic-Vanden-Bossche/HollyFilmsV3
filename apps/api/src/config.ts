export type ServerConfig = {
  databaseUrl: string
  jellyfinUrl: string
  jellyfinApiKey: string
  publicOrigin: string
  trustProxy?: string
  tmdbToken?: string
  google?: { clientId: string; clientSecret: string; passwordKey: Buffer }
}

export function readConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL est requis')
  const jellyfinApiKey = env.JELLYFIN_API_KEY?.trim()
  if (!jellyfinApiKey) throw new Error('JELLYFIN_API_KEY est requise')

  const publicUrl = new URL(env.PUBLIC_ORIGIN || 'http://localhost:5173')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname)
  if (
    (publicUrl.protocol !== 'https:' &&
      !(local && publicUrl.protocol === 'http:')) ||
    publicUrl.href !== `${publicUrl.origin}/`
  ) {
    throw new Error(
      'PUBLIC_ORIGIN doit être une origine HTTPS ou une origine HTTP de boucle locale',
    )
  }

  const clientId = env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_CLIENT_SECRET
  const key = env.GOOGLE_PASSWORD_KEY
  let google: ServerConfig['google']
  if (clientId || clientSecret || key) {
    const passwordKey = Buffer.from(key ?? '', 'base64')
    if (!clientId || !clientSecret || passwordKey.length !== 32) {
      throw new Error(
        'Le SSO requiert GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_PASSWORD_KEY (32 octets en base64)',
      )
    }
    google = { clientId, clientSecret, passwordKey }
  }

  return {
    databaseUrl,
    jellyfinUrl: env.JELLYFIN_URL || 'http://127.0.0.1:8096',
    jellyfinApiKey,
    publicOrigin: publicUrl.origin,
    trustProxy: env.TRUST_PROXY || undefined,
    tmdbToken: env.TMDB_API_TOKEN?.trim() || undefined,
    google,
  }
}
