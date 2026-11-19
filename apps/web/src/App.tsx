import { localizeText } from './i18n/messages.ts'
import { useI18n } from './i18n/I18nProvider.tsx'
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState } from 'react'
import {
  authOptions,
  getShowcase,
  signInPassword,
  statusNotice,
} from './account-api.ts'
import { LandingPage } from './LandingPage.tsx'
import type { GoogleReturn } from './account-api.ts'
import {
  endJellyfinSession,
  getJellyfinServerInfo,
  getJellyfinUser,
  isJellyfinAccessDenied,
} from '@hollyfilms/shared/jellyfin'
import { LoginForm } from './LoginForm.tsx'
import {
  clearSession,
  readSession,
  subscribeToSession,
  writeSession,
} from './session.ts'
import { Button } from './ui/Button.tsx'
import { Wordmark } from './ui/Wordmark.tsx'
import { GlassPanel } from './ui/GlassPanel.tsx'
import { PlaybackRouteStatus } from './ui/PlaybackRouteStatus.tsx'
import { navigateApp, takeAppReturn, useAppRoute } from './use-app-route.ts'
import { performanceController } from './performance/profiles.ts'
import { bindPerformancePreference } from './performance/preferences.ts'
import { releaseDeviceNotifications } from './pwa/notifications.ts'
import { setPwaViewer } from './pwa/runtime.ts'
import { markNotificationsRead } from './notification-api.ts'

const jellyfinUrl = new URL('/jellyfin', window.location.origin).href
const isAdminPage = /^\/admin(?:\/requests)?\/?$/.test(window.location.pathname)
const isProfilePage = /^\/profile\/?$/.test(window.location.pathname)
const isNotificationsPage = /^\/notifications\/?$/.test(
  window.location.pathname,
)
const isRequestsPage = /^\/requests\/?$/.test(window.location.pathname)
const isLibraryPage =
  /^\/app(?:\/(favorites|movies|series|collections))?\/?$/.test(
    window.location.pathname,
  )
const isPrivatePage =
  isAdminPage ||
  isProfilePage ||
  isNotificationsPage ||
  isRequestsPage ||
  isLibraryPage
const secondaryButton = 'glass-control rounded-lg px-4 py-2 text-sm font-medium'
const AdminDashboard = lazy(() =>
  import('./AdminDashboard.tsx').then((module) => ({
    default: module.AdminDashboard,
  })),
)
const HomeScreen = lazy(() =>
  import('./HomeScreen.tsx').then((module) => ({ default: module.HomeScreen })),
)
const ProfileScreen = lazy(() =>
  import('./ProfileScreen.tsx').then((module) => ({
    default: module.ProfileScreen,
  })),
)
const RequestsPage = lazy(() =>
  import('./RequestsPage.tsx').then((module) => ({
    default: module.RequestsPage,
  })),
)
const NotificationsPage = lazy(() =>
  import('./NotificationsPage.tsx').then((module) => ({
    default: module.NotificationsPage,
  })),
)

export default function App({
  googleReturn,
}: {
  googleReturn?: Promise<GoogleReturn>
}) {
  const { t } = useI18n()
  const route = useAppRoute()
  const client = useQueryClient()
  const [session, setSession] = useState(readSession)
  const [loginNotice, setLoginNotice] = useState<string>()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isCompletingGoogle, setIsCompletingGoogle] = useState(
    Boolean(googleReturn),
  )

  const options = useQuery({
    queryKey: ['auth-options'],
    queryFn: ({ signal }) => authOptions(signal),
    enabled: !session,
    retry: false,
  })
  const showcase = useQuery({
    queryKey: ['showcase'],
    queryFn: ({ signal }) => getShowcase(signal),
    enabled: !isPrivatePage || !session,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const user = useQuery({
    queryKey: ['jellyfin', 'current-user', session?.deviceId],
    queryFn: session
      ? ({ signal }) => getJellyfinUser(jellyfinUrl, session, signal)
      : skipToken,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const sessionRejected = isJellyfinAccessDenied(user.error)
  const viewer =
    session && user.isSuccess && !isSigningOut ? user.data.id : null
  useEffect(() => {
    setPwaViewer(viewer)
    return () => setPwaViewer(null)
  }, [viewer])
  useEffect(() => {
    const notice = new URLSearchParams(location.search).get('notice')
    if (
      !viewer ||
      !session ||
      !notice ||
      !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(notice)
    )
      return
    let active = true
    const markOpened = () => {
      if (new URLSearchParams(location.search).get('notice') !== notice) return
      void markNotificationsRead(session, notice)
        .then(() => {
          if (!active) return
          const url = new URL(location.href)
          if (url.searchParams.get('notice') === notice) {
            url.searchParams.delete('notice')
            history.replaceState(history.state, '', url)
          }
          void client.invalidateQueries({
            queryKey: ['notifications', session.deviceId, viewer],
          })
        })
        .catch(() => {})
    }
    markOpened()
    window.addEventListener('online', markOpened)
    return () => {
      active = false
      window.removeEventListener('online', markOpened)
    }
  }, [client, session, viewer])
  useEffect(() => {
    return bindPerformancePreference(
      performanceController,
      jellyfinUrl,
      session && user.isSuccess && user.data.isAdministrator && !isSigningOut
        ? user.data.id
        : null,
    )
  }, [
    session,
    user.isSuccess,
    user.data?.isAdministrator,
    user.data?.id,
    isSigningOut,
  ])

  useEffect(() => subscribeToSession(setSession), [])

  useEffect(() => {
    let mounted = true
    void googleReturn?.then((response) => {
      if (!mounted) return
      setIsCompletingGoogle(false)
      if ('error' in response) {
        setLoginNotice(response.error)
      } else if (response.result.status === 'authenticated') {
        writeSession(response.result.session)
        setSession(response.result.session)
        setLoginNotice(undefined)
        window.location.assign(takeAppReturn())
      } else {
        setLoginNotice(statusNotice(response.result.status))
      }
    })
    return () => {
      mounted = false
    }
  }, [googleReturn])

  useEffect(() => {
    if (!session || !sessionRejected || isSigningOut) return
    const remaining = clearSession(session)
    // oxlint-disable-next-line react/set-state-in-effect
    setSession(remaining)
    if (remaining) return
    void releaseDeviceNotifications(session, user.data?.id).catch(() => {})
    setLoginNotice('Ta session a expiré. Reconnecte-toi.')
  }, [session, sessionRejected, isSigningOut, user.data?.id])

  async function signIn(username: string, password: string) {
    const result = await signInPassword(username, password)
    if (result.status === 'authenticated') {
      writeSession(result.session)
      setSession(result.session)
      setLoginNotice(undefined)
      window.location.assign(
        isPrivatePage
          ? window.location.pathname +
              window.location.search +
              window.location.hash
          : '/app',
      )
    } else {
      setLoginNotice(statusNotice(result.status))
    }
  }

  async function signOut() {
    if (!session) return

    setIsSigningOut(true)
    setSession(clearSession(session))
    try {
      await releaseDeviceNotifications(session, user.data?.id).catch(() => {})
      await endJellyfinSession(jellyfinUrl, session)
    } catch (error) {
      if (!isJellyfinAccessDenied(error)) {
        setLoginNotice(
          'Déconnexion locale effectuée. Le serveur n’a pas confirmé la fermeture de la session.',
        )
      }
    } finally {
      setIsSigningOut(false)
    }
  }

  if (!isPrivatePage || !session)
    return (
      <LandingPage
        items={showcase.data?.items ?? []}
        catalogueState={
          showcase.isPending ? 'loading' : showcase.isError ? 'error' : 'ready'
        }
        options={options.data}
        notice={loginNotice ? localizeText(t, loginNotice) : undefined}
        completingGoogle={isCompletingGoogle}
        authenticated={Boolean(session && user.isSuccess)}
        initialAuth={isPrivatePage ? 'login' : null}
        onSignIn={signIn}
      />
    )

  const opening =
    isLibraryPage && route.play ? (
      <PlaybackRouteStatus
        openedAt={route.openedAt}
        onRestartOpening={route.restartOpening}
        onRetry={
          user.isPending
            ? () =>
                void client.resetQueries({
                  queryKey: ['jellyfin', 'current-user', session.deviceId],
                  exact: true,
                })
            : undefined
        }
        onClose={() => navigateApp({ play: undefined })}
        failure={
          user.isError && !sessionRejected
            ? {
                message: t(
                  'Impossible de vérifier la session auprès du serveur.',
                ),
                retry: () => void user.refetch(),
              }
            : undefined
        }
      />
    ) : (
      <main className="member-shell member-opening flex min-h-dvh flex-col items-center justify-center gap-6 bg-background text-sm text-muted-foreground">
        <Wordmark />
        <p role="status">{t('Ouverture de votre bibliothèque…')}</p>
      </main>
    )

  if (!isAdminPage && user.isSuccess) {
    return (
      <Suspense fallback={opening}>
        {isNotificationsPage ? (
          <NotificationsPage session={session} userId={user.data.id} />
        ) : isRequestsPage ? (
          <RequestsPage session={session} />
        ) : isProfilePage ? (
          <ProfileScreen
            session={session}
            onSignOut={() => void signOut()}
            signingOut={isSigningOut}
          />
        ) : (
          <HomeScreen
            routeOpenedAt={route.openedAt}
            key={session.deviceId}
            session={session}
            user={user.data}
            onSignOut={() => void signOut()}
            signingOut={isSigningOut}
          />
        )}
      </Suspense>
    )
  }

  if (user.isPending || (isLibraryPage && route.play)) return opening

  if (isAdminPage && user.data?.isAdministrator)
    return (
      <Suspense fallback={opening}>
        <main className="member-shell mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-9">
          <AdminDashboard key={session.deviceId} session={session} />
          <JellyfinStatus />
        </main>
      </Suspense>
    )

  return (
    <main className="member-shell mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-6 px-6 py-10 sm:px-10">
      <h1 className="mb-4">
        <Wordmark />
      </h1>

      {session ? (
        <GlassPanel aria-labelledby="session-heading">
          <h2 id="session-heading" className="text-2xl font-medium">
            {t('Compte HollyFilms')}
          </h2>
          <div role="status" className="mt-3 text-sm text-muted-foreground">
            {(user.isPending || sessionRejected) && (
              <p>{t('Vérification de la session…')}</p>
            )}
            {user.isSuccess && (
              <p>
                {t('Connecté en tant que')} <strong>{user.data.name}</strong>.
              </p>
            )}
            {user.isError && !sessionRejected && (
              <p className="text-destructive">
                {t('Impossible de vérifier la session auprès du serveur.')}
              </p>
            )}
          </div>
          {isAdminPage && user.isSuccess && !user.data.isAdministrator && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {t('Un compte administrateur est requis.')}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {user.data?.isAdministrator && (
              <a href="/admin" className={secondaryButton}>
                {t('Administration')}
              </a>
            )}
            {isAdminPage && user.isSuccess && !user.data.isAdministrator && (
              <a href="/app" className={secondaryButton}>
                {t('Retour au compte')}
              </a>
            )}
            {user.isError && !sessionRejected && (
              <Button
                onClick={() => void user.refetch()}
                disabled={user.isFetching || isSigningOut}
              >
                {t('Réessayer')}
              </Button>
            )}
            <Button onClick={() => void signOut()} disabled={isSigningOut}>
              {isSigningOut ? t('Déconnexion…') : t('Se déconnecter')}
            </Button>
          </div>
        </GlassPanel>
      ) : isCompletingGoogle ? (
        <p role="status" className="glass-panel rounded-2xl p-6">
          {t('Connexion Google en cours…')}
        </p>
      ) : (
        <LoginForm
          notice={loginNotice ? localizeText(t, loginNotice) : undefined}
          options={options.data}
          onSignIn={signIn}
        />
      )}

      <JellyfinStatus />
    </main>
  )
}

function JellyfinStatus() {
  const { t } = useI18n()
  const server = useQuery({
    queryKey: ['jellyfin', 'public-system-info'],
    queryFn: ({ signal }) => getJellyfinServerInfo(jellyfinUrl, signal),
    retry: false,
  })

  return (
    <GlassPanel aria-labelledby="jellyfin-heading">
      <h2 id="jellyfin-heading" className="text-xl font-medium">
        {t('État du service')}
      </h2>

      <div role="status" className="mt-3 space-y-2 text-sm">
        {server.isPending && (
          <p className="text-muted-foreground">
            {t('Vérification de la connexion…')}
          </p>
        )}
        {server.isError && (
          <p className="text-destructive">
            {t('Impossible de joindre le serveur.')}
          </p>
        )}
        {server.isSuccess && (
          <>
            <p className="font-medium text-success">{t('Connexion établie')}</p>
            <p className="text-muted-foreground">
              {'HollyFilms'} {t('· Version')} {server.data.Version}
            </p>
            {server.data.StartupWizardCompleted === false && (
              <p className="text-muted-foreground">
                {t('L’assistant de configuration du serveur reste à terminer.')}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-6">
        <Button
          onClick={() => void server.refetch()}
          disabled={server.isFetching}
        >
          {t('Vérifier la connexion')}
        </Button>
      </div>
    </GlassPanel>
  )
}
