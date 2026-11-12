import { skipToken, useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState } from 'react'
import {
  authOptions,
  getShowcase,
  signInPassword,
  statusNotice,
} from './account-api.ts'
import { LandingPage } from './LandingPage.tsx'
import type { GoogleReturn } from './account-api.ts'
import { AdminPage } from './AdminPage.tsx'
import {
  endJellyfinSession,
  getJellyfinServerInfo,
  getJellyfinUser,
  isJellyfinAccessDenied,
} from '@hollyfilms/shared/jellyfin'
import { LoginForm } from './LoginForm.tsx'
import { readSession, writeSession } from './session.ts'
import { Button } from './ui/Button.tsx'
import { Wordmark } from './ui/Wordmark.tsx'
import { GlassPanel } from './ui/GlassPanel.tsx'

const jellyfinUrl = new URL('/jellyfin', window.location.origin).href
const isAdminPage = /^\/admin\/?$/.test(window.location.pathname)
const isPrivatePage = isAdminPage || /^\/app\/?$/.test(window.location.pathname)
const secondaryButton = 'glass-control rounded-lg px-4 py-2 text-sm font-medium'
const HomeScreen = lazy(() =>
  import('./HomeScreen.tsx').then((module) => ({ default: module.HomeScreen })),
)

export default function App({
  googleReturn,
}: {
  googleReturn?: Promise<GoogleReturn>
}) {
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

  useEffect(() => {
    writeSession(session)
  }, [session])

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
        window.location.assign('/app')
      } else {
        setLoginNotice(statusNotice(response.result.status))
      }
    })
    return () => {
      mounted = false
    }
  }, [googleReturn])

  if (session && sessionRejected && !isSigningOut) {
    setSession(null)
    setLoginNotice('Ta session a expiré. Reconnecte-toi.')
  }

  async function signIn(username: string, password: string) {
    const result = await signInPassword(username, password)
    if (result.status === 'authenticated') {
      writeSession(result.session)
      setSession(result.session)
      setLoginNotice(undefined)
      window.location.assign('/app')
    } else {
      setLoginNotice(statusNotice(result.status))
    }
  }

  async function signOut() {
    if (!session) return

    setIsSigningOut(true)
    writeSession(null)
    try {
      await endJellyfinSession(jellyfinUrl, session)
    } catch (error) {
      if (!isJellyfinAccessDenied(error)) {
        setLoginNotice(
          'Déconnexion locale effectuée. Le serveur n’a pas confirmé la fermeture de la session.',
        )
      }
    } finally {
      setSession(null)
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
        notice={loginNotice}
        completingGoogle={isCompletingGoogle}
        authenticated={Boolean(session && user.isSuccess)}
        initialAuth={isPrivatePage ? 'login' : null}
        onSignIn={signIn}
      />
    )

  if (!isAdminPage && user.isSuccess) {
    return (
      <Suspense
        fallback={
          <main className="member-shell flex min-h-dvh flex-col items-center justify-center gap-6 bg-background text-sm text-muted-foreground">
            <Wordmark />
            <p role="status">Ouverture de votre bibliothèque…</p>
          </main>
        }
      >
        <HomeScreen
          key={session.deviceId}
          session={session}
          user={user.data}
          onSignOut={() => void signOut()}
          signingOut={isSigningOut}
        />
      </Suspense>
    )
  }

  if (!isAdminPage && user.isPending)
    return (
      <main className="member-shell flex min-h-dvh flex-col items-center justify-center gap-6 bg-background text-sm text-muted-foreground">
        <Wordmark />
        <p role="status">Ouverture de votre bibliothèque…</p>
      </main>
    )

  return (
    <main
      className={`member-shell mx-auto flex min-h-svh w-full flex-col gap-6 px-6 py-10 sm:px-10 ${isAdminPage && user.data?.isAdministrator ? 'max-w-7xl' : 'max-w-xl justify-center'}`}
    >
      <h1 className="mb-4">
        <Wordmark />
      </h1>

      {session && isAdminPage && user.data?.isAdministrator ? (
        <AdminPage session={session} />
      ) : session ? (
        <GlassPanel aria-labelledby="session-heading">
          <h2 id="session-heading" className="text-2xl font-medium">
            Compte HollyFilms
          </h2>
          <div role="status" className="mt-3 text-sm text-muted-foreground">
            {(user.isPending || sessionRejected) && (
              <p>Vérification de la session…</p>
            )}
            {user.isSuccess && (
              <p>
                Connecté en tant que <strong>{user.data.name}</strong>.
              </p>
            )}
            {user.isError && !sessionRejected && (
              <p className="text-destructive">
                Impossible de vérifier la session auprès du serveur.
              </p>
            )}
          </div>
          {isAdminPage && user.isSuccess && !user.data.isAdministrator && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Un compte administrateur est requis.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {user.data?.isAdministrator && (
              <a href="/admin" className={secondaryButton}>
                Gérer les inscriptions
              </a>
            )}
            {isAdminPage && user.isSuccess && !user.data.isAdministrator && (
              <a href="/app" className={secondaryButton}>
                Retour au compte
              </a>
            )}
            {user.isError && !sessionRejected && (
              <Button
                onClick={() => void user.refetch()}
                disabled={user.isFetching || isSigningOut}
              >
                Réessayer
              </Button>
            )}
            <Button onClick={() => void signOut()} disabled={isSigningOut}>
              {isSigningOut ? 'Déconnexion…' : 'Se déconnecter'}
            </Button>
          </div>
        </GlassPanel>
      ) : isCompletingGoogle ? (
        <p role="status" className="glass-panel rounded-2xl p-6">
          Connexion Google en cours…
        </p>
      ) : (
        <LoginForm
          notice={loginNotice}
          options={options.data}
          onSignIn={signIn}
        />
      )}

      <JellyfinStatus />
    </main>
  )
}

function JellyfinStatus() {
  const server = useQuery({
    queryKey: ['jellyfin', 'public-system-info'],
    queryFn: ({ signal }) => getJellyfinServerInfo(jellyfinUrl, signal),
    retry: false,
  })

  return (
    <GlassPanel aria-labelledby="jellyfin-heading">
      <h2 id="jellyfin-heading" className="text-xl font-medium">
        État du service
      </h2>

      <div role="status" className="mt-3 space-y-2 text-sm">
        {server.isPending && (
          <p className="text-muted-foreground">Vérification de la connexion…</p>
        )}
        {server.isError && (
          <p className="text-destructive">Impossible de joindre le serveur.</p>
        )}
        {server.isSuccess && (
          <>
            <p className="font-medium text-success">Connexion établie</p>
            <p className="text-muted-foreground">
              {'HollyFilms'} · Version {server.data.Version}
            </p>
            {server.data.StartupWizardCompleted === false && (
              <p className="text-muted-foreground">
                L’assistant de configuration du serveur reste à terminer.
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
          Vérifier la connexion
        </Button>
      </div>
    </GlassPanel>
  )
}
