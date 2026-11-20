import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  BellRing,
  Check,
  CircleAlert,
  Download,
  MonitorSmartphone,
  RefreshCw,
  Send,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider.tsx'
import type { Message } from '../i18n/messages.ts'
import type {
  DeviceAction,
  DevicePushState,
} from '../pwa/use-device-preferences.ts'
import { allowPageScrollInterruption } from './page-scroll.ts'
import '../profile.css'

export type DeviceSettingsProps = {
  installed: boolean
  canInstall: boolean
  updateAvailable: boolean
  ios: boolean
  pushState: DevicePushState
  canTest: boolean
  action?: DeviceAction
  notice?: { error: boolean; message: Message }
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  applyUpdate: () => void
  onAction: (action: DeviceAction) => void
  onRetry: () => void
}

const descriptions: Record<DevicePushState, Message> = {
  checking: 'Vérification des alertes de cet appareil…',
  ready:
    'Recevez les nouvelles de vos demandes de films, de séries et de sous-titres, même après avoir fermé HollyFilms.',
  enabled: 'Les mises à jour de vos demandes sont envoyées sur cet appareil.',
  offline: 'Reconnectez-vous pour gérer les alertes de cet appareil.',
  ios: 'Pour recevoir les alertes, ouvrez HollyFilms depuis votre écran d’accueil.',
  insecure:
    'Ouvrez HollyFilms en HTTPS pour activer les alertes sur cet appareil.',
  unsupported:
    'Ce navigateur ne prend pas en charge les notifications sur cet appareil.',
  denied:
    'Autorisez les notifications dans les réglages du navigateur pour ce site.',
  unconfigured:
    'Les notifications sur appareil ne sont pas encore configurées sur ce serveur.',
  failed: 'Impossible de vérifier les alertes de cet appareil.',
}

export function DeviceSettings({
  installed,
  canInstall,
  updateAvailable,
  ios,
  pushState,
  canTest,
  action,
  notice,
  install,
  applyUpdate,
  onAction,
  onRetry,
}: DeviceSettingsProps) {
  const { t } = useI18n()
  const heading = useRef<HTMLHeadingElement>(null)
  const [installing, setInstalling] = useState(false)
  const [installNotice, setInstallNotice] = useState<Message>()
  useEffect(() => {
    const followAnchor = () => {
      if (window.location.hash !== '#device-notifications') return
      heading.current?.focus({ preventScroll: true })
      allowPageScrollInterruption()
      heading.current?.closest('section')?.scrollIntoView({ block: 'start' })
    }
    followAnchor()
    window.addEventListener('hashchange', followAnchor)
    return () => window.removeEventListener('hashchange', followAnchor)
  }, [])
  async function promptInstall() {
    if (installing) return
    setInstalling(true)
    setInstallNotice(undefined)
    try {
      const response = await install()
      if (response === 'unavailable')
        setInstallNotice(
          'Ouvrez le menu du navigateur pour voir les options d’installation disponibles.',
        )
    } catch {
      setInstallNotice(
        'Impossible de lancer l’installation. Réessayez depuis le menu du navigateur.',
      )
    } finally {
      setInstalling(false)
    }
  }
  return (
    <section
      className="profile-panel profile-device"
      id="device-notifications"
      aria-labelledby="device-settings-title"
    >
      <div className="profile-section-title">
        <span>
          <MonitorSmartphone size={21} aria-hidden="true" />
        </span>
        <h2 id="device-settings-title" ref={heading} tabIndex={-1}>
          {t('Sur cet appareil')}
        </h2>
      </div>
      <div className="device-setting">
        <div>
          <h3>{t('Application HollyFilms')}</h3>
          <p>
            {t(
              installed
                ? 'HollyFilms est installée sur cet appareil.'
                : canInstall
                  ? 'Ajoutez HollyFilms à votre écran d’accueil pour ouvrir directement le catalogue.'
                  : ios
                    ? 'Dans Safari, touchez Partager puis « Sur l’écran d’accueil ».'
                    : 'Ouvrez le menu du navigateur pour voir les options d’installation disponibles.',
            )}
          </p>
        </div>
        {!installed && canInstall && (
          <button
            type="button"
            className="profile-button"
            disabled={installing}
            onClick={() => void promptInstall()}
          >
            <Download size={16} aria-hidden="true" />
            {t('Installer HollyFilms')}
          </button>
        )}
      </div>
      {installNotice && (
        <p className="profile-hint" role="status">
          {t(installNotice)}
        </p>
      )}
      {updateAvailable && (
        <div className="device-setting">
          <p>{t('Une mise à jour de HollyFilms est prête.')}</p>
          <button
            type="button"
            className="profile-button"
            onClick={applyUpdate}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {t('Recharger pour mettre à jour')}
          </button>
        </div>
      )}
      <div className="device-setting">
        <div>
          <h3>
            {pushState === 'enabled' ? (
              <BellRing size={16} aria-hidden="true" />
            ) : (
              <Bell size={16} aria-hidden="true" />
            )}
            {t('Alertes sur cet appareil')}
          </h3>
          <p aria-live="polite">{t(descriptions[pushState])}</p>
          <a href="/notifications" className="profile-text-button">
            {t('Voir toutes les notifications')}
          </a>
        </div>
        {(pushState === 'ready' || pushState === 'enabled') && (
          <div className="device-actions">
            <button
              type="button"
              className={
                pushState === 'ready' ? 'profile-button' : 'profile-text-button'
              }
              aria-disabled={Boolean(action)}
              onClick={() => {
                if (!action)
                  onAction(pushState === 'ready' ? 'enable' : 'disable')
              }}
            >
              {action === 'enable'
                ? t('Activation…')
                : action === 'disable'
                  ? t('Désactivation…')
                  : pushState === 'ready'
                    ? t('Activer les alertes')
                    : t('Désactiver les alertes')}
            </button>
            {pushState === 'enabled' && canTest && (
              <button
                type="button"
                className="profile-button"
                aria-disabled={Boolean(action)}
                onClick={() => {
                  if (!action) onAction('test')
                }}
              >
                <Send size={15} aria-hidden="true" />{' '}
                {action === 'test' ? t('Envoi…') : t('Envoyer un test')}
              </button>
            )}
          </div>
        )}
        {pushState === 'failed' && (
          <button type="button" className="profile-button" onClick={onRetry}>
            {t('Réessayer')}
          </button>
        )}
      </div>
      {notice && notice.message !== descriptions[pushState] && (
        <p
          className={
            notice.error ? 'profile-notice is-error' : 'profile-notice'
          }
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? (
            <CircleAlert size={16} aria-hidden="true" />
          ) : (
            <Check size={16} aria-hidden="true" />
          )}
          {t(notice.message)}
        </p>
      )}
    </section>
  )
}
