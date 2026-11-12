export type JellyfinSession = {
  accessToken: string
  deviceId: string
}

export type AuthResult =
  | { status: 'authenticated'; session: JellyfinSession }
  | { status: 'pending' | 'rejected' }

export type AuthOptions = {
  googleStartUrl: string | null
}

export type RegistrationSummary = {
  id: string
  username: string
  method: 'PASSWORD' | 'GOOGLE'
  status:
    'PENDING' | 'PROVISIONING' | 'AWAITING_PASSWORD' | 'ACTIVE' | 'REJECTED'
  googleEmail: string | null
  createdAt: string
  decidedAt: string | null
  decidedBy: string | null
  lastError: string | null
}
