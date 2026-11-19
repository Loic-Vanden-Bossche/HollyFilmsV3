import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { getJellyfinServerInfo } from '@hollyfilms/shared/jellyfin'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Button } from './Button.tsx'
import { GlassPanel } from './GlassPanel.tsx'
import './jellyfin-status.css'

const statusLabels = {
  checking: 'Vérification de la connexion…',
  connected: 'Connexion établie',
  unavailable: 'Impossible de joindre le serveur.',
} as const

export function JellyfinStatus({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const heading = useId()
  const server = useQuery({
    queryKey: ['jellyfin', 'public-system-info'],
    queryFn: ({ signal }) =>
      getJellyfinServerInfo(new URL('/jellyfin', location.origin).href, signal),
    retry: false,
  })
  const checking = server.isFetching || (server.isPending && !server.isPaused)
  const state = checking
    ? 'checking'
    : server.isSuccess && !server.isPaused
      ? 'connected'
      : 'unavailable'
  const label = t('Vérifier la connexion')
  const refresh = () => void server.refetch()
  const details = (
    <div role="status" className="jellyfin-status-details" data-state={state}>
      <p className="jellyfin-status-message">
        {compact && <span aria-hidden="true" />}
        {t(statusLabels[state])}
      </p>
      {state === 'connected' && server.data && (
        <>
          {server.data.Version && (
            <p>
              {t('Version du serveur {version}', {
                version: server.data.Version,
              })}
            </p>
          )}
          {server.data.StartupWizardCompleted === false && (
            <p>
              {t('L’assistant de configuration du serveur reste à terminer.')}
            </p>
          )}
        </>
      )}
    </div>
  )

  if (compact)
    return (
      <section className="jellyfin-status-compact" aria-labelledby={heading}>
        <div>
          <h2 id={heading}>{t('État du service')}</h2>
          {details}
        </div>
        <button
          type="button"
          className="jellyfin-status-refresh"
          aria-label={label}
          title={label}
          onClick={refresh}
          disabled={server.isFetching}
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </section>
    )

  return (
    <GlassPanel aria-labelledby={heading}>
      <h2 id={heading} className="text-xl font-medium">
        {t('État du service')}
      </h2>
      {details}
      <Button className="mt-6" onClick={refresh} disabled={server.isFetching}>
        {label}
      </Button>
    </GlassPanel>
  )
}
