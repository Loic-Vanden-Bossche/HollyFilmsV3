import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { accountHeaders } from '../account-api.ts'
import { getPwaRegistration } from './runtime.ts'

export const deviceOwnerKey = 'hollyfilms.notifications.device'
const pushPath = '/api/notifications/push'
type DeviceOwner = {
  binding: string
  endpointHash: string
  userId: string
  muted?: boolean
}
const endedSessions = new WeakSet<JellyfinSession>()

class PushRequestError extends Error {
  readonly status: number
  constructor(status: number) {
    super('Notification request failed')
    this.status = status
  }
}

async function request<T = void>(
  session: JellyfinSession,
  suffix: string,
  method: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.throwIfAborted()
  signal.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, 12000)
  try {
    const response = await fetch(pushPath + suffix, {
      method,
      headers: {
        ...accountHeaders(session),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new PushRequestError(response.status)
    return response.status === 204 ? (undefined as T) : await response.json()
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}

function readOwner(): DeviceOwner | undefined {
  try {
    const owner = JSON.parse(localStorage.getItem(deviceOwnerKey) ?? 'null')
    if (typeof owner?.binding === 'string' && typeof owner.userId === 'string')
      return owner
  } catch {
    // Account ownership can still be checked by the authenticated API.
  }
}

function saveOwner(owner: DeviceOwner) {
  try {
    localStorage.setItem(deviceOwnerKey, JSON.stringify(owner))
  } catch {
    // Private browsing can disable persistent storage.
  }
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function bindingFor(session: JellyfinSession, endpoint: string) {
  return fingerprint(JSON.stringify([session.accessToken, endpoint]))
}

async function rememberOwner(
  session: JellyfinSession,
  endpoint: string,
  userId: string,
) {
  const [binding, endpointHash] = await Promise.all([
    bindingFor(session, endpoint),
    fingerprint(endpoint),
  ])
  saveOwner({ binding, endpointHash, userId })
}

function forgetOwner(binding: string | undefined) {
  try {
    if (binding && readOwner()?.binding === binding)
      localStorage.removeItem(deviceOwnerKey)
  } catch {
    // The server and push service can revoke the subscription independently.
  }
}

function subscribed(
  session: JellyfinSession,
  endpoint: string,
  signal: AbortSignal,
) {
  return request<{ subscribed: boolean }>(session, '/status', 'POST', signal, {
    endpoint,
  })
}

export async function prepareDeviceNotifications(
  session: JellyfinSession,
  userId: string,
  signal: AbortSignal,
) {
  const [registration, { publicKey }] = await Promise.all([
    getPwaRegistration(),
    request<{ publicKey: string | null }>(session, '', 'GET', signal),
  ])
  const subscription = await registration.pushManager.getSubscription()
  const linked = subscription
    ? (await subscribed(session, subscription.endpoint, signal)).subscribed
    : false
  const owner = readOwner()
  return {
    registration,
    publicKey,
    subscription,
    linked: linked && !(owner?.userId === userId && owner.muted),
  }
}

type Prepared = Awaited<ReturnType<typeof prepareDeviceNotifications>>

function setDelivery(
  registration: ServiceWorkerRegistration,
  userId: string,
  enabled: boolean,
) {
  registration.active?.postMessage({
    type: 'HOLLYFILMS_PUSH_DELIVERY',
    userId: userId.replaceAll('-', '').toLowerCase(),
    enabled,
  })
}

export async function enableDeviceNotifications(
  session: JellyfinSession,
  userId: string,
  { registration, publicKey }: Prepared,
  signal: AbortSignal,
) {
  if (!publicKey) throw new Error('Push unavailable')
  // Start the permission-bearing operation directly in the click handler.
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(
      atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')),
      (value) => value.charCodeAt(0),
    ),
  })
  signal.throwIfAborted()
  if (endedSessions.has(session))
    throw new DOMException('Session ended', 'AbortError')
  await request(session, '', 'PUT', signal, subscription.toJSON())
  await rememberOwner(session, subscription.endpoint, userId)
  if (endedSessions.has(session))
    await releaseDeviceNotifications(session, userId)
  else setDelivery(registration, userId, true)
}

async function closeDelivered(
  registration: ServiceWorkerRegistration,
  userId?: string,
) {
  if (!userId || typeof registration.getNotifications !== 'function') return
  const id = userId.replaceAll('-', '').toLowerCase()
  for (const notification of await registration.getNotifications()) {
    if (
      typeof notification.data?.userId === 'string' &&
      notification.data.userId.replaceAll('-', '').toLowerCase() === id
    )
      notification.close()
  }
}

export async function disableDeviceNotifications(
  session: JellyfinSession,
  userId: string,
  { registration, subscription }: Prepared,
  signal: AbortSignal,
) {
  if (!subscription) return
  const { endpoint } = subscription
  const binding = readOwner()?.binding
  if ((await subscribed(session, endpoint, signal)).subscribed) {
    await request(session, '', 'DELETE', signal, { endpoint })
    setDelivery(registration, userId, false)
    await subscription.unsubscribe().catch(() => false)
    forgetOwner(binding)
  }
  await closeDelivered(registration, userId)
}

export async function testDeviceNotification(
  session: JellyfinSession,
  { subscription }: Prepared,
  signal: AbortSignal,
) {
  if (!subscription) throw new PushRequestError(404)
  try {
    await request(session, '/test', 'POST', signal, {
      endpoint: subscription.endpoint,
    })
  } catch (error) {
    if (error instanceof PushRequestError && error.status === 410) {
      const binding = readOwner()?.binding
      await subscription.unsubscribe()
      forgetOwner(binding)
    }
    throw error
  }
}

export function deviceNotificationError(error: unknown) {
  if (error instanceof PushRequestError) {
    if (error.status === 409)
      return 'Un autre compte reçoit déjà les alertes ici. Désactivez-les depuis ce compte pour changer.'
    if (error.status === 410 || error.status === 404)
      return 'Cet abonnement a expiré. Réactivez les alertes sur cet appareil.'
    if (error.status === 429)
      return 'Patientez un instant avant d’envoyer un autre test.'
  }
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return Notification.permission === 'denied'
      ? 'Autorisez les notifications dans les réglages du navigateur pour ce site.'
      : 'L’autorisation n’a pas été accordée. Vous pouvez réessayer à tout moment.'
  }
  if (error instanceof DOMException && error.name === 'InvalidStateError')
    return 'La clé de notification a changé. Réinitialisez les autorisations de ce site, puis réactivez les alertes.'
  return 'Impossible de modifier les alertes pour le moment. Réessayez.'
}

/** Revoke this account’s device delivery without delaying sign-out if the network is down. */
export async function releaseDeviceNotifications(
  session: JellyfinSession,
  userId?: string,
) {
  endedSessions.add(session)
  if (!('serviceWorker' in navigator)) return
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort()
      resolve()
    }, 2000)
  })
  const release = async () => {
    const registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration) return
    const subscription = await registration.pushManager?.getSubscription()
    const owner = readOwner()
    const local =
      subscription &&
      owner &&
      (owner.binding === (await bindingFor(session, subscription.endpoint)) ||
        (userId &&
          owner.userId === userId &&
          owner.endpointHash === (await fingerprint(subscription.endpoint))))
    const recipient = userId ?? (local ? owner.userId : undefined)
    if (recipient) setDelivery(registration, recipient, false)
    await closeDelivered(registration, recipient).catch(() => {})
    if (!subscription || controller.signal.aborted) return
    const { endpoint } = subscription
    if (
      !local &&
      !(await subscribed(session, endpoint, controller.signal)).subscribed
    )
      return
    // Browser revocation also stops delivery with an expired Jellyfin session or offline API.
    if (local) saveOwner({ ...owner, muted: true })
    const [server, device] = await Promise.allSettled([
      request(session, '', 'DELETE', controller.signal, { endpoint }),
      subscription.unsubscribe(),
    ])
    if (
      server.status === 'fulfilled' ||
      (device.status === 'fulfilled' && device.value)
    )
      forgetOwner(owner?.binding)
  }
  try {
    await Promise.race([release(), deadline])
  } catch {
    // Account logout must still complete if this browser has no push service.
  } finally {
    clearTimeout(timeout)
  }
}
