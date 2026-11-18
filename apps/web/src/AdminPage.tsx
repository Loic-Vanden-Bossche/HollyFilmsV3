import { useI18n } from './i18n/I18nProvider.tsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { localizeText } from './i18n/messages.ts'
import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { spring } from './motion/tokens.ts'
import { RequestRow } from './ui/RequestRow.tsx'
import { usePerformanceReducedMotion } from './performance/PerformanceProvider.tsx'
import { ArrowLeft, Check, Clock3, ShieldCheck, Users } from 'lucide-react'
import type {
  JellyfinSession,
  RegistrationSummary,
} from '@hollyfilms/shared/accounts'
import { decideRegistration, listRegistrations } from './account-api.ts'
import { Button } from './ui/Button.tsx'
import {
  BlurText,
  ClickSpark,
  CountUp,
  MagicBento,
} from './components/reactbits/Effects.tsx'
import './admin.css'

const statuses = {
  PENDING: 'En attente',
  PROVISIONING: 'Création en cours',
  AWAITING_PASSWORD: 'Approuvée · Première connexion requise',
  ACTIVE: 'Active',
  REJECTED: 'Refusée',
} as const satisfies Record<RegistrationSummary['status'], string>

export function AdminPage({ session }: { session: JellyfinSession }) {
  const { t, locale } = useI18n()
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('all')
  const reduced = usePerformanceReducedMotion()
  const indicator = useId()
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
        <ArrowLeft size={16} /> {t('Retour à la bibliothèque')}
      </a>
      <header className="admin-heading">
        <div>
          <p className="admin-eyebrow">{t('ESPACE ADMINISTRATEUR')}</p>
          <h2 id="admin-heading">
            <BlurText text={t('Inscriptions & accès.')} />
          </h2>
          <p>
            {t(
              'Gérez les inscriptions et choisissez qui rejoint votre bibliothèque.',
            )}
          </p>
        </div>
        <div className="admin-emblem" aria-hidden="true">
          <ShieldCheck size={32} />
        </div>
      </header>
      <MagicBento>
        {[
          { label: t('Demandes reçues'), value: requests.length, Icon: Users },
          { label: t('À traiter'), value: pending.length, Icon: Clock3 },
          {
            label: t('Comptes approuvés'),
            value: approved.length,
            Icon: Check,
          },
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
          <h3>{t('Demandes d’inscription')}</h3>
          <span>
            {registrations.isSuccess
              ? t('{count} au total', { count: requests.length })
              : t('Synchronisation')}
          </span>
        </div>
        <div
          className="admin-filters"
          role="group"
          aria-label={t('Filtrer les demandes')}
        >
          {(
            [
              ['all', t('Toutes')],
              ['pending', t('À traiter')],
              ['approved', t('Approuvées')],
              ['rejected', t('Refusées')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {filter === value && (
                <motion.span
                  className="selection-light"
                  aria-hidden="true"
                  layoutId={reduced ? undefined : indicator}
                  transition={spring.control}
                />
              )}
              {label}
            </button>
          ))}
        </div>
        {registrations.isPending && (
          <p role="status" className="surface-placeholder mt-4">
            {t('Chargement…')}
          </p>
        )}
        {registrations.isError && (
          <p role="alert" className="mt-4 text-destructive">
            {localizeText(
              t,
              registrations.error.message,
              'Impossible de consulter les comptes.',
            )}
          </p>
        )}
        {registrations.isSuccess && visible.length === 0 && (
          <p className="admin-empty" role="status">
            {requests.length === 0
              ? t('Aucune demande pour le moment.')
              : t('Aucune demande dans cette catégorie.')}
          </p>
        )}
        {decision.isError && (
          <p role="alert" className="mt-4 text-destructive">
            {localizeText(
              t,
              decision.error.message,
              'Impossible d’effectuer cette action. Réessaie.',
            )}
          </p>
        )}
        {registrations.isSuccess && (
          <ul
            className="admin-requests"
            aria-label={t('Demandes d’inscription')}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((registration, index) => (
                <RequestRow key={registration.id} as="li" order={index}>
                  <div className="admin-request-avatar" aria-hidden="true">
                    {success.id === registration.id && (
                      <ClickSpark burst={success.burst} />
                    )}
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
                        : t('Mot de passe')}{' '}
                      · {date.format(new Date(registration.createdAt))}
                    </p>
                    {registration.decidedAt && registration.decidedBy && (
                      <p className="text-xs break-words text-muted-foreground">
                        {t('Décision du {date} · Admin {name}', {
                          date: date.format(new Date(registration.decidedAt)),
                          name: registration.decidedBy,
                        })}
                      </p>
                    )}
                    {registration.lastError && (
                      <p className="text-sm text-destructive">
                        {localizeText(
                          t,
                          registration.lastError,
                          'La création du compte a échoué. Réessaie.',
                        )}
                      </p>
                    )}
                  </div>
                  <span
                    key={registration.status}
                    className="admin-status"
                    data-status={registration.status}
                  >
                    {t(statuses[registration.status])}
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
                          ? t('Approuver')
                          : t('Réessayer')}
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
                          {t('Refuser')}
                        </Button>
                      )}
                    </div>
                  )}
                </RequestRow>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  )
}
