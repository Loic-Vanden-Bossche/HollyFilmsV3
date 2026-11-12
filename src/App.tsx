import { skipToken, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { authOptions, signInPassword, statusNotice } from './account-api.ts'
import type { GoogleReturn } from './account-api.ts'
import { AdminPage } from './AdminPage.tsx'
import {
  endJellyfinSession,
  getJellyfinServerInfo,
  getJellyfinUser,
  isJellyfinAccessDenied,
} from './jellyfin.ts'
import { LoginForm } from './LoginForm.tsx'
import { readSession, writeSession } from './session.ts'
import { Button } from './ui/Button.tsx'

const jellyfinUrl = new URL('/jellyfin', window.location.origin).href
const isAdminPage = /^\/admin\/?$/.test(window.location.pathname)
const secondaryButton =
  'rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:opacity-50'

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
        setSession(response.result.session)
        setLoginNotice(undefined)
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
    setLoginNotice('Ta session Jellyfin a expiré. Reconnecte-toi.')
  }

  async function signIn(username: string, password: string) {
    const result = await signInPassword(username, password)
    if (result.status === 'authenticated') {
      setSession(result.session)
      setLoginNotice(undefined)
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
          'Déconnexion locale effectuée. Jellyfin n’a pas confirmé la fermeture de la session.',
        )
      }
    } finally {
      setSession(null)
      setIsSigningOut(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-4 px-6 py-12 sm:px-10">
      <h1 className="mb-4 text-5xl font-semibold tracking-tight sm:text-6xl">
        HollyFilms
      </h1>

      {session && isAdminPage && user.data?.isAdministrator ? (
        <AdminPage session={session} />
      ) : session ? (
        <section
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8"
          aria-labelledby="session-heading"
        >
          <h2 id="session-heading" className="text-2xl font-medium">
            Compte Jellyfin
          </h2>
          <div role="status" className="mt-3 text-sm text-zinc-300">
            {(user.isPending || sessionRejected) && (
              <p>Vérification de la session…</p>
            )}
            {user.isSuccess && (
              <p>
                Connecté en tant que <strong>{user.data.name}</strong>.
              </p>
            )}
            {user.isError && !sessionRejected && (
              <p className="text-rose-300">
                Impossible de vérifier la session auprès de Jellyfin.
              </p>
            )}
          </div>
          {isAdminPage && user.isSuccess && !user.data.isAdministrator && (
            <p role="alert" className="mt-3 text-sm text-rose-300">
              Un compte administrateur Jellyfin est requis.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {user.data?.isAdministrator && (
              <a href="/admin" className={secondaryButton}>
                Gérer les inscriptions
              </a>
            )}
            {isAdminPage && user.isSuccess && !user.data.isAdministrator && (
              <a href="/" className={secondaryButton}>
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
        </section>
      ) : isCompletingGoogle ? (
        <p
          role="status"
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
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
    <section
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      aria-labelledby="jellyfin-heading"
    >
      <h2 id="jellyfin-heading" className="text-xl font-medium">
        Serveur Jellyfin
      </h2>

      <div role="status" className="mt-3 space-y-2 text-sm">
        {server.isPending && (
          <p className="text-zinc-300">Vérification de la connexion…</p>
        )}
        {server.isError && (
          <p className="text-rose-300">
            Impossible de joindre le serveur Jellyfin.
          </p>
        )}
        {server.isSuccess && (
          <>
            <p className="font-medium text-emerald-300">Connexion établie</p>
            <p className="text-zinc-300">
              {server.data.ServerName || 'Jellyfin'} · Version{' '}
              {server.data.Version}
            </p>
            {server.data.StartupWizardCompleted === false && (
              <p className="text-zinc-300">
                L’assistant de configuration Jellyfin reste à terminer.
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
    </section>
  )
}
