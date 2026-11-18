import { useI18n } from '../i18n/I18nProvider.tsx'
import { Button } from './Button.tsx'
import { PlayerLoading } from './PlayerLoading.tsx'

export function PlaybackRouteStatus({
  onClose,
  failure,
}: {
  onClose: () => void
  failure?: { message: string; retry: () => void }
}) {
  const { t } = useI18n()
  return (
    <main
      className="playback-route-status fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background px-stage text-center text-foreground"
      aria-label={t('Préparation de la lecture')}
    >
      {failure ? (
        <>
          <p role="alert">{failure.message}</p>
          <Button onClick={failure.retry}>{t('Réessayer')}</Button>
        </>
      ) : (
        <>
          <span role="status" className="sr-only">
            {t('Préparation de la lecture')}
          </span>
          <PlayerLoading visible phase="source" />
        </>
      )}
      <Button className="absolute top-stage left-stage" onClick={onClose}>
        {t('Fermer')}
      </Button>
    </main>
  )
}
