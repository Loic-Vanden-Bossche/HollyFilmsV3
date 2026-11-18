import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Settings2,
} from 'lucide-react'
import { useI18n } from './i18n/I18nProvider.tsx'
import { localizeText } from './i18n/messages.ts'
import { markNotificationsRead } from './notification-api.ts'
import { useNotificationInbox } from './notification-inbox.ts'
import { Button } from './ui/Button.tsx'
import { Wordmark } from './ui/Wordmark.tsx'

export function NotificationsPage({
  session,
  userId,
}: {
  session: JellyfinSession
  userId: string
}) {
  const { t, locale } = useI18n()
  const inbox = useNotificationInbox(session, userId)
  const read = useMutation({
    mutationFn: (id: string | undefined) => markNotificationsRead(session, id),
    onSuccess: async () => {
      await inbox.refetch()
    },
  })
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const data = inbox.data?.pages[0]
  const items = inbox.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <main className="member-shell min-h-dvh bg-background px-5 py-7 text-foreground sm:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12 flex flex-wrap items-center justify-between gap-4">
          <a href="/app" aria-label={t('Retour au catalogue')}>
            <Wordmark compact />
          </a>
          <a
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            href="/app"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t('Catalogue')}
          </a>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {t('Notifications')}
          </h1>
          <a
            className="inline-flex min-h-11 items-center gap-2 text-sm text-link"
            href="/profile#device-notifications"
          >
            <Settings2 size={16} aria-hidden="true" />
            {t('Réglages de l’appareil')}
          </a>
        </div>
        {data && data.items.length > 0 && (
          <div className="mt-7 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <span className="text-sm text-muted-foreground" role="status">
              {data.unread
                ? t('Non lues · {count}', { count: data.unread })
                : t('Tout est lu')}
            </span>
            {data.unread > 0 && (
              <Button
                variant="link"
                disabled={read.isPending}
                onClick={() => read.mutate(undefined)}
                className="inline-flex items-center gap-2"
              >
                <CheckCheck size={16} aria-hidden="true" />
                {t('Tout marquer comme lu')}
              </Button>
            )}
          </div>
        )}
        {inbox.isPending && (
          <p className="my-8 text-muted-foreground" role="status">
            {t('Chargement des notifications…')}
          </p>
        )}
        {inbox.isError && !inbox.isFetchNextPageError && (
          <div className="my-6 flex flex-wrap items-center gap-4">
            <p role="alert">{t('Impossible de charger les notifications.')}</p>
            <Button onClick={() => void inbox.refetch()}>
              {t('Réessayer')}
            </Button>
          </div>
        )}
        {read.isError && (
          <p className="my-3 text-destructive" role="alert">
            {t('La lecture de la notification n’a pas été enregistrée.')}
          </p>
        )}
        {data && data.items.length === 0 && (
          <div className="mt-10 border-t border-border pt-10">
            <Bell size={26} className="mb-4 text-link" aria-hidden="true" />
            <h2 className="text-lg font-semibold">
              {t('Aucune notification pour le moment')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('Les nouvelles concernant tes demandes apparaîtront ici.')}
            </p>
          </div>
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const unread = !item.readAt
              const Icon = unread ? BellRing : Bell
              const path = [
                '/requests',
                '/requests?section=subtitles',
                '/profile',
              ].includes(item.url)
                ? item.url
                : '/requests'
              const destination = new URL(path, location.origin)
              if (unread) destination.searchParams.set('notice', item.id)
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 py-5 sm:gap-4"
                >
                  <Icon
                    size={18}
                    className={
                      unread
                        ? 'mt-1 shrink-0 text-primary'
                        : 'mt-1 shrink-0 text-muted-foreground'
                    }
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <a
                      href={destination.pathname + destination.search}
                      className="font-semibold hover:underline"
                    >
                      {localizeText(t, item.title)}
                    </a>
                    <p className="mt-1 text-sm break-words text-muted-foreground">
                      {item.body ===
                      'Ouvre tes demandes pour consulter la mise à jour.'
                        ? t('Ouvre tes demandes pour consulter la mise à jour.')
                        : item.body}
                    </p>
                    <time
                      dateTime={item.createdAt}
                      className="mt-2 block text-xs text-muted-foreground"
                    >
                      {date.format(new Date(item.createdAt))}
                    </time>
                  </div>
                  {unread && (
                    <Button
                      variant="link"
                      className="inline-flex min-w-11 items-center justify-center gap-2 self-center"
                      aria-label={t('Marquer comme lu · {title}', {
                        title: localizeText(t, item.title),
                      })}
                      disabled={read.isPending}
                      onClick={() => read.mutate(item.id)}
                    >
                      <Check size={17} aria-hidden="true" />
                      <span className="hidden sm:inline">
                        {t('Marquer comme lu')}
                      </span>
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {inbox.isFetchNextPageError && (
          <p role="alert" className="my-3 text-destructive">
            {t('Impossible de charger les notifications.')}
          </p>
        )}
        {inbox.hasNextPage && (
          <Button
            disabled={inbox.isFetching}
            onClick={() => void inbox.fetchNextPage({ cancelRefetch: false })}
          >
            {inbox.isFetchNextPageError
              ? t('Réessayer')
              : t('Notifications précédentes')}
          </Button>
        )}
      </div>
    </main>
  )
}
