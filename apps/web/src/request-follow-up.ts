type FollowUpStorage = Pick<Storage, 'getItem' | 'setItem'>

export const requestFollowUpKey = (account: string) =>
  `hollyfilms:requests:follow-up:v1:${encodeURIComponent(account)}`

/** Claim at successful submission, so dismissal and reload never repeat the prompt. */
export function createRequestFollowUp(
  storage: () => FollowUpStorage = () => window.localStorage,
) {
  const seen = new Set<string>()
  return (account: string) => {
    const key = requestFollowUpKey(account)
    if (seen.has(key)) return false
    try {
      if (storage().getItem(key) === 'shown') return false
      storage().setItem(key, 'shown')
    } catch {
      seen.add(key)
      // Keep the once-per-runtime guarantee when browser storage is blocked.
    }
    return true
  }
}

export const claimRequestFollowUp = createRequestFollowUp()
