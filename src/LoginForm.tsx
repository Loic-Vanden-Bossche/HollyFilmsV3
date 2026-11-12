import { useState } from 'react'
import type { SubmitEvent } from 'react'
import type { AuthOptions } from '../shared/accounts.ts'
import { registerAccount } from './account-api.ts'
import { Button } from './ui/Button.tsx'
import { TextInput } from './ui/TextInput.tsx'

type LoginFormProps = {
  notice?: string
  options?: AuthOptions
  onSignIn: (username: string, password: string) => Promise<void>
}

export function LoginForm({ notice, options, onSignIn }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const username = String(fields.get('username'))
    const password = String(fields.get('password'))
    setError(undefined)
    setIsSubmitting(true)

    try {
      if (registering) {
        await registerAccount(username, password)
        setRegistered(true)
        setRegistering(false)
      } else {
        await onSignIn(username, password)
      }
      form.reset()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'La demande a échoué. Réessaie.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8"
      aria-labelledby="login-heading"
    >
      <h2 id="login-heading" className="text-2xl font-medium">
        {registering ? 'Demander un compte' : 'Connexion à Jellyfin'}
      </h2>
      {notice && (
        <p role="status" className="mt-3 text-sm text-zinc-300">
          {notice}
        </p>
      )}
      {registered && (
        <p role="status" className="mt-3 text-sm text-emerald-300">
          Demande envoyée. Tu pourras te connecter avec tes identifiants après
          approbation.
        </p>
      )}

      <form className="mt-6" onSubmit={handleSubmit}>
        <fieldset disabled={isSubmitting} className="space-y-4">
          <label className="grid gap-2 text-sm font-medium">
            Nom d’utilisateur
            <TextInput
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Mot de passe
            <TextInput
              type="password"
              name="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
              required={registering}
              minLength={registering ? 8 : undefined}
              aria-describedby={registering ? 'password-hint' : undefined}
            />
          </label>
          {registering && (
            <p id="password-hint" className="text-sm text-zinc-400">
              Choisis un mot de passe d’au moins 8 caractères.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full">
            {isSubmitting
              ? 'Envoi…'
              : registering
                ? 'Envoyer la demande'
                : 'Se connecter'}
          </Button>
        </fieldset>
      </form>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm">
        <Button
          variant="link"
          disabled={isSubmitting}
          onClick={() => {
            setRegistering(!registering)
            setRegistered(false)
            setError(undefined)
          }}
        >
          {registering ? 'Revenir à la connexion' : 'Demander un compte'}
        </Button>
        {options?.googleStartUrl && (
          <a
            className="text-emerald-300 underline"
            href={options.googleStartUrl}
          >
            Continuer avec Google
          </a>
        )}
      </div>
    </section>
  )
}
