import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type { Message } from '../i18n/messages.ts'
import { getPwaRegistration, usePwaShell } from './runtime.ts'
import {
  deviceOwnerKey,
  deviceNotificationError,
  disableDeviceNotifications,
  enableDeviceNotifications,
  prepareDeviceNotifications,
  testDeviceNotification,
} from './notifications.ts'

export type DevicePushState =
  | 'checking'
  | 'ready'
  | 'enabled'
  | 'offline'
  | 'ios'
  | 'insecure'
  | 'unsupported'
  | 'denied'
  | 'unconfigured'
  | 'failed'
export type DeviceAction = 'enable' | 'disable' | 'test'

function browserState() {
  return {
    online: navigator.onLine,
    permission:
      typeof Notification !== 'undefined' ? Notification.permission : undefined,
  }
}

export function useDevicePreferences(session: JellyfinSession, userId: string) {
  const shell = usePwaShell()
  const [browser, setBrowser] = useState(browserState)
  const [action, setAction] = useState<DeviceAction>()
  const [notice, setNotice] = useState<{ error: boolean; message: Message }>()
  const operation = useRef<AbortController | null>(null)
  const ios =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const supported =
    window.isSecureContext &&
    'PushManager' in window &&
    'serviceWorker' in navigator &&
    browser.permission !== undefined
  const canQuery =
    supported &&
    browser.online &&
    shell.workerState === 'ready' &&
    browser.permission !== 'denied' &&
    (!ios || shell.installed)
  const prepared = useQuery({
    queryKey: ['device-notifications', userId, session.deviceId],
    queryFn: ({ signal }) =>
      prepareDeviceNotifications(session, userId, signal),
    enabled: canQuery,
    retry: false,
    networkMode: 'always',
  })
  const { refetch } = prepared
  useEffect(() => {
    let disposed = false
    let permission: PermissionStatus | undefined
    const sync = () => {
      if (!disposed) setBrowser(browserState())
    }
    const onStorage = (event: StorageEvent) => {
      if (canQuery && event.key === deviceOwnerKey) void refetch()
    }
    if (navigator.permissions) {
      void navigator.permissions
        .query({ name: 'notifications' })
        .then((result) => {
          if (disposed) return
          permission = result
          permission.addEventListener('change', sync)
        })
        .catch(() => {})
    }
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    window.addEventListener('focus', sync)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', sync)
    return () => {
      disposed = true
      permission?.removeEventListener('change', sync)
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [canQuery, refetch])
  useEffect(
    () => () => {
      operation.current?.abort()
      operation.current = null
    },
    [session.accessToken],
  )

  let pushState: DevicePushState
  if (!window.isSecureContext) pushState = 'insecure'
  else if (ios && !shell.installed) pushState = 'ios'
  else if (!supported || shell.workerState === 'unsupported')
    pushState = 'unsupported'
  else if (browser.permission === 'denied') pushState = 'denied'
  else if (!browser.online) pushState = 'offline'
  else if (shell.workerState === 'failed' || prepared.isError)
    pushState = 'failed'
  else if (!prepared.data || shell.workerState !== 'ready')
    pushState = 'checking'
  else if (prepared.data.linked) pushState = 'enabled'
  else if (!prepared.data.publicKey) pushState = 'unconfigured'
  else pushState = 'ready'

  async function perform(next: DeviceAction) {
    if (!prepared.data || operation.current) return
    const control = new AbortController()
    operation.current = control
    setAction(next)
    setNotice(undefined)
    try {
      if (next === 'enable')
        await enableDeviceNotifications(
          session,
          userId,
          prepared.data,
          control.signal,
        )
      else if (next === 'disable')
        await disableDeviceNotifications(
          session,
          userId,
          prepared.data,
          control.signal,
        )
      else await testDeviceNotification(session, prepared.data, control.signal)
      if (control.signal.aborted) return
      setNotice({
        error: false,
        message:
          next === 'test'
            ? 'Le test a été envoyé au service de notification de cet appareil.'
            : next === 'enable'
              ? 'Cet appareil recevra les prochaines alertes.'
              : 'Les alertes sont désactivées sur cet appareil.',
      })
    } catch (error) {
      if (!control.signal.aborted)
        setNotice({ error: true, message: deviceNotificationError(error) })
    } finally {
      if (!control.signal.aborted) {
        setBrowser(browserState())
        await refetch()
        if (!control.signal.aborted) {
          operation.current = null
          setAction(undefined)
        }
      }
    }
  }
  return {
    ...shell,
    ios,
    pushState,
    action,
    notice,
    canTest: Boolean(prepared.data?.publicKey),
    onAction: perform,
    onRetry: () => {
      if (shell.workerState === 'failed')
        void getPwaRegistration().catch(() => {})
      else void refetch()
    },
  }
}
