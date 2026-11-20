import { useI18n } from '../i18n/I18nProvider.tsx'
import { useState } from 'react'
import { Button } from './Button.tsx'
import { PlayerLoading } from './PlayerLoading.tsx'
import { PlayerProjectionSurface } from './PlayerProjectionSurface.tsx'

export function PlaybackRouteStatus({
  onClose,
  openedAt,
  onRetry,
  onRestartOpening,
  failure,
}: {
  onClose: () => void
  openedAt?: number
  onRetry?: () => void
  onRestartOpening?: () => void
  failure?: { message: string; retry: () => void }
}) {
  const { t } = useI18n()
  const [mountedAt] = useState(Date.now)
  const retry = failure?.retry ?? onRetry
  function retryOpening() {
    onRestartOpening?.()
    retry?.()
  }
  return (
    <main
      className="playback-route-status fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background px-stage text-center text-foreground"
      aria-label={t('Préparation de la lecture')}
    >
      <PlayerProjectionSurface cancelled={!!failure} />
      {failure ? (
        <>
          <p role="alert">{failure.message}</p>
          <Button onClick={retryOpening}>{t('Réessayer')}</Button>
        </>
      ) : (
        <div className="absolute inset-x-stage top-[max(84px,calc(70px+env(safe-area-inset-top)))] text-start">
          <PlayerLoading
            wait={{
              operation: 'opening',
              since: openedAt ?? mountedAt,
              position: 0,
            }}
            onRetry={retry ? retryOpening : undefined}
          />
        </div>
      )}
      <Button className="absolute top-stage left-stage" onClick={onClose}>
        {t('Fermer')}
      </Button>
    </main>
  )
}
