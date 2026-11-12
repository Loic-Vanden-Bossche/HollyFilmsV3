import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  JellyfinSession,
  RegistrationSummary,
} from '@hollyfilms/shared/accounts'
import { decideRegistration, listRegistrations } from './account-api.ts'
import { Button } from './ui/Button.tsx'
import { GlassPanel } from './ui/GlassPanel.tsx'

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
    <GlassPanel aria-labelledby="admin-heading">
      <a
        href="/app"
        className="text-sm text-link underline underline-offset-4 hover:text-accent-foreground"
      >
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
        <p role="alert" className="mt-4 text-destructive">
          {registrations.error.message}
        </p>
      )}
      {registrations.data?.length === 0 && (
        <p className="mt-4 text-muted-foreground">
          Aucune demande pour le moment.
        </p>
      )}
      {decision.isError && (
        <p role="alert" className="mt-4 text-destructive">
          {decision.error.message}
        </p>
      )}
      {registrations.data && registrations.data.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {registrations.data.map((registration) => (
            <li key={registration.id} className="space-y-2 py-4">
              <p className="font-medium break-words">
                {registration.googleEmail ?? registration.username}
              </p>
              <p className="text-sm text-muted-foreground">
                {registration.method === 'GOOGLE' ? 'Google' : 'Mot de passe'} ·{' '}
                {statuses[registration.status]} ·{' '}
                {date.format(new Date(registration.createdAt))}
              </p>
              {registration.decidedAt && registration.decidedBy && (
                <p className="text-xs break-words text-muted-foreground">
                  Décision du {date.format(new Date(registration.decidedAt))} ·
                  Admin {registration.decidedBy}
                </p>
              )}
              {registration.lastError && (
                <p className="text-sm text-destructive">
                  {registration.lastError.replace(
                    /\bjellyfin\b/gi,
                    'HollyFilms',
                  )}
                </p>
              )}
              {(registration.status === 'PENDING' ||
                registration.status === 'PROVISIONING') && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
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
                      className="text-destructive"
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
    </GlassPanel>
  )
}
