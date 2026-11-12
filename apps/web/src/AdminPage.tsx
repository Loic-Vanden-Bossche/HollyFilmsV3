import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Check, Clock3, ShieldCheck, Users } from 'lucide-react'
import type {
  JellyfinSession,
  RegistrationSummary,
} from '@hollyfilms/shared/accounts'
import { decideRegistration, listRegistrations } from './account-api.ts'
import { Button } from './ui/Button.tsx'
import {
  AnimatedList,
  BlurText,
  ClickSpark,
  CountUp,
  MagicBento,
} from './components/reactbits/Effects.tsx'
import './admin.css'

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
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('all')
  const reduced = useReducedMotion()
  const [success, setSuccess] = useState({ id: '', burst: 0 })
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
    onSuccess: (_data, variables) => {
      if (variables.action === 'approve')
        setSuccess((value) => ({ id: variables.id, burst: value.burst + 1 }))
    },
    onSettled: () => cache.invalidateQueries({ queryKey }),
  })

  const requests = registrations.data ?? []
  const pending = requests.filter(
    (request) =>
      request.status === 'PENDING' || request.status === 'PROVISIONING',
  )
  const approved = requests.filter(
    (request) =>
      request.status === 'ACTIVE' || request.status === 'AWAITING_PASSWORD',
  )
  const visible =
    filter === 'pending'
      ? pending
      : filter === 'approved'
        ? approved
        : filter === 'rejected'
          ? requests.filter((request) => request.status === 'REJECTED')
          : requests

  return (
    <section className="admin-page" aria-labelledby="admin-heading">
      <a href="/app" className="admin-back">
        <ArrowLeft size={16} /> Retour à la bibliothèque
      </a>
      <header className="admin-heading">
        <div>
          <p className="admin-eyebrow">ESPACE ADMINISTRATEUR</p>
          <h2 id="admin-heading">
            <BlurText text="Inscriptions & accès." />
          </h2>
          <p>
            Gérez les inscriptions et choisissez qui rejoint votre bibliothèque.
          </p>
        </div>
        <div className="admin-emblem" aria-hidden="true">
          <ShieldCheck size={32} />
        </div>
      </header>
      <MagicBento>
        {[
          { label: 'Demandes reçues', value: requests.length, Icon: Users },
          { label: 'À traiter', value: pending.length, Icon: Clock3 },
          { label: 'Comptes approuvés', value: approved.length, Icon: Check },
        ].map(({ label, value, Icon }) => (
          <dl key={label}>
            <dt>
              <Icon size={18} />
              {label}
            </dt>
            <dd>{registrations.isSuccess ? <CountUp value={value} /> : '—'}</dd>
          </dl>
        ))}
      </MagicBento>
      <div className="admin-inbox">
        <div className="admin-inbox-heading">
          <h3>Demandes d’inscription</h3>
          <span>
            {registrations.isSuccess
              ? `${requests.length} au total`
              : 'Synchronisation'}
          </span>
        </div>
        <div
          className="admin-filters"
          role="group"
          aria-label="Filtrer les demandes"
        >
          {(
            [
              ['all', 'Toutes'],
              ['pending', 'À traiter'],
              ['approved', 'Approuvées'],
              ['rejected', 'Refusées'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
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
        {registrations.isSuccess && visible.length === 0 && (
          <p className="admin-empty" role="status">
            {requests.length === 0
              ? 'Aucune demande pour le moment.'
              : 'Aucune demande dans cette catégorie.'}
          </p>
        )}
        {decision.isError && (
          <p role="alert" className="mt-4 text-destructive">
            {decision.error.message}
          </p>
        )}
        {registrations.isSuccess && (
          <AnimatedList
            as="ul"
            className="admin-requests"
            label="Demandes d’inscription"
          >
            <AnimatePresence initial={false}>
              {visible.map((registration) => (
                <motion.li
                  key={registration.id}
                  layout={!reduced}
                  initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0.1 : 0.25 }}
                >
                  <div className="admin-request-avatar" aria-hidden="true">
                    <ClickSpark
                      burst={success.id === registration.id ? success.burst : 0}
                    />
                    {(registration.googleEmail ?? registration.username)
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="admin-request-copy">
                    <p className="admin-request-name">
                      {registration.googleEmail ?? registration.username}
                    </p>
                    <p className="admin-request-meta">
                      {registration.method === 'GOOGLE'
                        ? 'Google'
                        : 'Mot de passe'}{' '}
                      · {date.format(new Date(registration.createdAt))}
                    </p>
                    {registration.decidedAt && registration.decidedBy && (
                      <p className="text-xs break-words text-muted-foreground">
                        Décision du{' '}
                        {date.format(new Date(registration.decidedAt))} · Admin{' '}
                        {registration.decidedBy}
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
                  </div>
                  <span
                    className="admin-status"
                    data-status={registration.status}
                  >
                    {statuses[registration.status]}
                  </span>
                  {(registration.status === 'PENDING' ||
                    registration.status === 'PROVISIONING') && (
                    <div className="admin-request-actions">
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
                </motion.li>
              ))}
            </AnimatePresence>
          </AnimatedList>
        )}
      </div>
    </section>
  )
}
