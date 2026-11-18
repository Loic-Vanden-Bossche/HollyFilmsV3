import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Search, UserRound } from 'lucide-react'
import type { AdminUser, JellyfinSession } from '@hollyfilms/shared/accounts'
import { listAdminUsers, setAdminUserAccess } from './account-api.ts'
import { useI18n } from './i18n/I18nProvider.tsx'
import { localizeText } from './i18n/messages.ts'
import { Button } from './ui/Button.tsx'
import { lockBodyScroll } from './ui/body-scroll-lock.ts'
import './admin.css'

const filters = {
  all: 'Tous les comptes',
  active: 'Actifs',
  disabled: 'Suspendus',
  administrator: 'Administrateurs',
} as const
type UserFilter = keyof typeof filters

export function AdminUsers({ session }: { session: JellyfinSession }) {
  const { t, locale } = useI18n()
  const cache = useQueryClient()
  const queryKey = ['admin-users', session.deviceId]
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<UserFilter>('all')
  const [selected, setSelected] = useState<AdminUser>()
  const [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const dialogTrigger = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const confirmTitle = useId()
  const confirmDescription = useId()
  const users = useQuery({
    queryKey,
    queryFn: ({ signal }) => listAdminUsers(session, signal),
    retry: false,
    gcTime: 0,
  })
  const update = useMutation({
    mutationFn: (user: AdminUser) =>
      setAdminUserAccess(session, user.id, !user.disabled),
    onSuccess: (_data, user) => {
      cache.setQueryData<AdminUser[]>(queryKey, (current) =>
        current?.map((row) =>
          row.id === user.id ? { ...row, disabled: !user.disabled } : row,
        ),
      )
      setNotice(
        t(
          user.disabled
            ? 'Accès rétabli pour {name}.'
            : 'Accès suspendu pour {name}.',
          { name: user.username },
        ),
      )
      setSelected(undefined)
    },
    onSettled: () => cache.invalidateQueries({ queryKey }),
  })
  useLayoutEffect(() => {
    const modal = dialog.current
    if (!selected || !modal) return
    const trigger = dialogTrigger.current
    const input = searchInput.current
    const unlockScroll = lockBodyScroll()
    modal.showModal()
    return () => {
      modal.close()
      unlockScroll()
      const focus = trigger?.isConnected ? trigger : input
      focus?.focus({ preventScroll: true })
    }
  }, [selected])

  const directory = [...(users.data ?? [])].sort((a, b) =>
    a.username.localeCompare(b.username, locale),
  )
  const needle = search.trim().toLocaleLowerCase(locale)
  const visible = directory.filter(
    (user) =>
      user.username.toLocaleLowerCase(locale).includes(needle) &&
      (filter === 'all' ||
        (filter === 'administrator' && user.administrator) ||
        (filter === 'disabled' && user.disabled && !user.setupPending) ||
        (filter === 'active' && !user.disabled && !user.setupPending)),
  )
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  return (
    <section aria-labelledby="admin-users-heading">
      <header className="admin-section-heading">
        <h2 id="admin-users-heading">{t('Utilisateurs')}</h2>
        <p>{t('Consultez tous les comptes Jellyfin et gérez leurs accès.')}</p>
      </header>
      <div className="admin-inbox">
        <div className="admin-user-toolbar">
          <label className="admin-user-search glass-control">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              ref={searchInput}
              placeholder={t('Rechercher un utilisateur')}
              aria-label={t('Rechercher un utilisateur')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Button
            onClick={() => void users.refetch()}
            disabled={users.isFetching}
            className="admin-refresh"
          >
            <RotateCcw size={15} aria-hidden="true" />
            {t('Actualiser')}
          </Button>
        </div>
        <div
          className="admin-filters"
          role="group"
          aria-label={t('Filtrer les utilisateurs')}
        >
          {(Object.keys(filters) as UserFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {t(filters[key])}
            </button>
          ))}
        </div>
        {users.isPending && (
          <p className="admin-empty" role="status">
            {t('Chargement…')}
          </p>
        )}
        {users.isError && (
          <p role="alert" className="mb-4 text-destructive">
            {localizeText(
              t,
              users.error.message,
              'Impossible de consulter les comptes.',
            )}
          </p>
        )}
        {users.data && (
          <>
            <p className="admin-user-count" role="status">
              {t('{count} sur {total} comptes', {
                count: visible.length,
                total: directory.length,
              })}
            </p>
            {notice && (
              <p className="admin-user-notice" role="status">
                {notice}
              </p>
            )}
            {visible.length === 0 ? (
              <p className="admin-empty">{t('Aucun utilisateur trouvé.')}</p>
            ) : (
              <ul className="admin-requests" aria-label={t('Utilisateurs')}>
                {visible.map((user) => {
                  const origin =
                    user.registrationMethod === 'GOOGLE'
                      ? 'Google'
                      : user.registrationMethod
                        ? 'HollyFilms'
                        : 'Jellyfin'
                  const status = user.setupPending
                    ? 'AWAITING_PASSWORD'
                    : user.disabled
                      ? 'DISABLED'
                      : 'ACTIVE'
                  const activity = user.lastActivityAt
                    ? new Date(user.lastActivityAt)
                    : null
                  const action = t(
                    user.disabled ? 'Rétablir l’accès' : 'Suspendre l’accès',
                  )
                  return (
                    <li key={user.id}>
                      <span className="admin-request-avatar" aria-hidden="true">
                        <UserRound size={19} />
                      </span>
                      <div className="admin-request-copy">
                        <p className="admin-request-name">{user.username}</p>
                        <p className="admin-request-meta">
                          {origin} ·{' '}
                          {t(user.administrator ? 'Administrateur' : 'Membre')}
                          {activity && Number.isFinite(activity.getTime()) && (
                            <>
                              {' '}
                              ·{' '}
                              {t('Dernière activité le {date}', {
                                date: date.format(activity),
                              })}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="admin-user-statuses">
                        <span className="admin-status" data-status={status}>
                          {t(
                            user.setupPending
                              ? 'Inscription en cours'
                              : user.disabled
                                ? 'Accès suspendu'
                                : 'Accès actif',
                          )}
                        </span>
                        {user.hidden && (
                          <span className="admin-status">
                            {t('Compte masqué')}
                          </span>
                        )}
                      </div>
                      {user.canChangeAccess && (
                        <Button
                          aria-label={`${action} · ${user.username}`}
                          onClick={(event) => {
                            dialogTrigger.current = event.currentTarget
                            update.reset()
                            setNotice('')
                            setSelected(user)
                          }}
                        >
                          {action}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
      {selected && (
        <dialog
          ref={dialog}
          className="admin-confirm"
          aria-labelledby={confirmTitle}
          aria-describedby={confirmDescription}
          onCancel={(event) => {
            event.preventDefault()
            if (!update.isPending) setSelected(undefined)
          }}
        >
          <h3 id={confirmTitle}>
            {t(selected.disabled ? 'Rétablir l’accès' : 'Suspendre l’accès')}
          </h3>
          <p id={confirmDescription}>
            {t(
              selected.disabled
                ? '{name} pourra à nouveau se connecter.'
                : '{name} sera déconnecté et ne pourra plus se connecter jusqu’au rétablissement de son accès.',
              { name: selected.username },
            )}
          </p>
          {update.isError && (
            <p role="alert" className="text-destructive">
              {localizeText(
                t,
                update.error.message,
                'Impossible d’effectuer cette action. Réessaie.',
              )}
            </p>
          )}
          <div className="admin-request-actions">
            <Button
              disabled={update.isPending}
              onClick={() => setSelected(undefined)}
            >
              {t('Annuler')}
            </Button>
            <Button
              variant="primary"
              disabled={update.isPending}
              onClick={() => update.mutate(selected)}
            >
              {t(
                update.isPending
                  ? 'En cours…'
                  : selected.disabled
                    ? 'Rétablir l’accès'
                    : 'Suspendre l’accès',
              )}
            </Button>
          </div>
        </dialog>
      )}
    </section>
  )
}
