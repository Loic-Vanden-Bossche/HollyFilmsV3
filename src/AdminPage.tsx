import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  JellyfinSession,
  RegistrationSummary,
} from '../shared/accounts.ts'
import { decideRegistration, listRegistrations } from './account-api.ts'
import { Button } from './ui/Button.tsx'

const statuses: Record<RegistrationSummary['status'], string> = {
  PENDING: 'En attente',
  PROVISIONING: 'Création en cours',
  AWAITING_PASSWORD: 'Approuvée · Première connexion requise',
  ACTIVE: 'Active',
  REJECTED: 'Refusée',
}

const date = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function AdminPage({ session }: { session: JellyfinSession }) {
  const cache = useQueryClient()
  const queryKey = ['registrations', session.deviceId]
  const registrations = useQuery({
    queryKey,
    queryFn: ({ signal }) => listRegistrations(session, signal),
    retry: false,
    gcTime: 0,
  })
  const decision = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string
      action: 'approve' | 'reject'
    }) => decideRegistration(session, id, action),
    onSettled: () => cache.invalidateQueries({ queryKey }),
  })

  return (
    <section
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8"
      aria-labelledby="admin-heading"
    >
      <a href="/" className="text-sm text-emerald-300 underline">
        Retour au compte
      </a>
      <h2 id="admin-heading" className="mt-3 text-2xl font-medium">
        Demandes d’inscription
      </h2>
      {registrations.isPending && (
        <p role="status" className="mt-4">
          Chargement…
        </p>
      )}
      {registrations.isError && (
        <p role="alert" className="mt-4 text-rose-300">
          {registrations.error.message}
        </p>
      )}
      {registrations.data?.length === 0 && (
        <p className="mt-4 text-zinc-300">Aucune demande pour le moment.</p>
      )}
      {decision.isError && (
        <p role="alert" className="mt-4 text-rose-300">
          {decision.error.message}
        </p>
      )}
      {registrations.data && registrations.data.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-800">
          {registrations.data.map((registration) => (
            <li key={registration.id} className="space-y-2 py-4">
              <p className="font-medium break-words">
                {registration.googleEmail ?? registration.username}
              </p>
              <p className="text-sm text-zinc-300">
                {registration.method === 'GOOGLE' ? 'Google' : 'Mot de passe'} ·{' '}
                {statuses[registration.status]} ·{' '}
                {date.format(new Date(registration.createdAt))}
              </p>
              {registration.decidedAt && registration.decidedBy && (
                <p className="text-xs break-words text-zinc-400">
                  Décision du {date.format(new Date(registration.decidedAt))} ·
                  Admin {registration.decidedBy}
                </p>
              )}
              {registration.lastError && (
                <p className="text-sm text-rose-300">
                  {registration.lastError}
                </p>
              )}
              {(registration.status === 'PENDING' ||
                registration.status === 'PROVISIONING') && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={decision.isPending}
                    onClick={() =>
                      decision.mutate({
                        id: registration.id,
                        action: 'approve',
                      })
                    }
                  >
                    {registration.status === 'PENDING'
                      ? 'Approuver'
                      : 'Réessayer'}
                  </Button>
                  {registration.status === 'PENDING' && (
                    <Button
                      disabled={decision.isPending}
                      onClick={() =>
                        decision.mutate({
                          id: registration.id,
                          action: 'reject',
                        })
                      }
                    >
                      Refuser
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
