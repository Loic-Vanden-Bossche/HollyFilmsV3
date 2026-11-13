export type AccountProfile = {
  id: string
  name: string
  isAdministrator: boolean
  canEdit: boolean
  hasPassword: boolean
  imageTag: string | null
  google: { email: string | null; picture: string | null } | null
}

/** Only Google's HTTPS avatar hosts are accepted from verified OIDC claims. */
export function googlePictureUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'googleusercontent.com' ||
        url.hostname.endsWith('.googleusercontent.com'))
      ? url.href
      : null
  } catch {
    return null
  }
}
