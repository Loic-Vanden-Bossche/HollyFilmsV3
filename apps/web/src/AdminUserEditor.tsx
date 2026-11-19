import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserRound, X } from 'lucide-react'
import type {
  AdminUser,
  AdminUserDetails,
  AdminUserPolicy,
  JellyfinSession,
} from '@hollyfilms/shared/accounts'
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUser,
  getAdminUserOptions,
  updateAdminUserName,
  updateAdminUserPassword,
  updateAdminUserPolicy,
} from './account-api.ts'
import { AdminUserPolicyFields } from './AdminUserPolicyFields.tsx'
import { useI18n } from './i18n/I18nProvider.tsx'
import { localizeText } from './i18n/messages.ts'
import { Button } from './ui/Button.tsx'
import { TextInput } from './ui/TextInput.tsx'
import { useModalPresence } from './ui/use-modal-presence.ts'
import './admin-user-editor.css'

const fallbackFocus = (opener: HTMLElement) =>
  opener.closest('section')?.querySelector<HTMLElement>('input[type=search]') ??
  null

const adminUserSections = {
  account: 'Compte',
  access: 'Accès aux ressources',
  playback: 'Lecture et permissions',
  restrictions: 'Contrôle parental',
  security: 'Sécurité',
} as const

export function AdminUserEditor({
  session,
  account,
  onClose,
  onChanged,
}: {
  session: JellyfinSession
  account?: AdminUser
  onClose: () => void
  onChanged: () => void
}) {
  const { t } = useI18n()
  const heading = useId()
  const { dialog } = useModalPresence(fallbackFocus)
  const [busy, setBusy] = useState(false)
  const details = useQuery({
    queryKey: ['admin-user', session.deviceId, account?.id],
    queryFn: ({ signal }) => getAdminUser(session, account!.id, signal),
    enabled: Boolean(account),
    retry: false,
    gcTime: 0,
  })

  const name =
    details.data?.displayName ??
    account?.displayName ??
    details.data?.username ??
    account?.username
  const close = () => {
    if (!busy) onClose()
  }

  return (
    <dialog
      ref={dialog}
      className="admin-user-editor"
      data-create={!account || undefined}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="admin-user-editor-frame">
        <header className="admin-user-editor-heading">
          <span className="admin-request-avatar" aria-hidden="true">
            <UserRound size={21} />
          </span>
          <div>
            <h3 id={heading}>{name ?? t('Ajouter un utilisateur')}</h3>
            {account && (
              <p>
                {t(account.administrator ? 'Administrateur' : 'Membre')}
                {account.registrationMethod === 'GOOGLE' && ' · Google'}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label={t('Fermer')}
            className="admin-user-editor-close"
            disabled={busy}
            onClick={close}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {!account ? (
          <CreateAccount
            session={session}
            onBusy={setBusy}
            onClose={close}
            onCreated={() => {
              onChanged()
              onClose()
            }}
          />
        ) : details.data ? (
          <EditAccount
            user={details.data}
            session={session}
            onBusy={setBusy}
            onChanged={onChanged}
            onDeleted={onClose}
          />
        ) : (
          <div className="admin-user-editor-body">
            {details.isPending ? (
              <p role="status">{t('Chargement…')}</p>
            ) : (
              <>
                <EditorError error={details.error} />
                <Button
                  onClick={() => void details.refetch()}
                  disabled={details.isFetching}
                >
                  {t('Réessayer')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </dialog>
  )
}

function EditorError({ error }: { error: Error | null }) {
  const { t } = useI18n()
  return (
    error && (
      <p className="admin-user-editor-error" role="alert">
        {localizeText(
          t,
          error.message,
          'Impossible d’effectuer cette action. Réessaie.',
        )}
      </p>
    )
  )
}

function CreateAccount({
  session,
  onBusy,
  onClose,
  onCreated,
}: {
  session: JellyfinSession
  onBusy: (busy: boolean) => void
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const create = useMutation({
    mutationFn: () => createAdminUser(session, username.trim(), password),
    onMutate: () => onBusy(true),
    onSuccess: onCreated,
    onSettled: () => onBusy(false),
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        create.mutate()
      }}
      aria-busy={create.isPending}
    >
      <div className="admin-user-editor-body">
        <label className="admin-user-field">
          <span>{t('Nom d’utilisateur')}</span>
          <TextInput
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            name="username"
            autoComplete="off"
            required
            maxLength={255}
            disabled={create.isPending}
          />
        </label>
        <label className="admin-user-field">
          <span>{t('Mot de passe')}</span>
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={1024}
            disabled={create.isPending}
          />
        </label>
        <EditorError error={create.error} />
      </div>
      <footer className="admin-user-editor-footer">
        <Button onClick={onClose} disabled={create.isPending}>
          {t('Annuler')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={create.isPending || !username.trim() || !password.trim()}
        >
          {t('Créer le compte')}
        </Button>
      </footer>
    </form>
  )
}

type EditSection = keyof typeof adminUserSections

function EditAccount({
  user,
  session,
  onBusy,
  onChanged,
  onDeleted,
}: {
  user: AdminUserDetails
  session: JellyfinSession
  onBusy: (busy: boolean) => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const { t } = useI18n()
  const cache = useQueryClient()
  const detailsKey = ['admin-user', session.deviceId, user.id]
  const [section, setSection] = useState<EditSection>('account')
  const [changes, setChanges] = useState<AdminUserPolicy>({})
  const [usernameDraft, setUsername] = useState<string>()
  const [password, setPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notice, setNotice] = useState('')
  const policyForm = useRef<HTMLFormElement>(null)
  const username = usernameDraft ?? user.username
  const options = useQuery({
    queryKey: ['admin-user-options', session.deviceId],
    queryFn: ({ signal }) => getAdminUserOptions(session, signal),
    enabled:
      section === 'access' ||
      section === 'restrictions' ||
      (section === 'account' && user.canChangeProviders),
    retry: false,
  })
  const policy = { ...user.policy, ...changes }
  const patch = Object.fromEntries(
    Object.entries(changes).filter(
      ([key, value]) =>
        JSON.stringify(value) !==
        JSON.stringify(user.policy[key as keyof AdminUserPolicy]),
    ),
  ) as AdminUserPolicy
  const changed = Object.keys(patch).length > 0

  const begin = () => {
    setNotice('')
    onBusy(true)
  }
  const finish = () => {
    onBusy(false)
  }
  const reloadAccount = () => {
    void cache.invalidateQueries({ queryKey: detailsKey })
    onChanged()
  }
  const save = useMutation({
    mutationFn: () => updateAdminUserPolicy(session, user.id, patch),
    onMutate: begin,
    onSuccess: () => {
      cache.setQueryData<AdminUserDetails>(
        detailsKey,
        (current) =>
          current && {
            ...current,
            policy,
          },
      )
      setChanges({})
      setNotice(t('Modifications enregistrées.'))
      reloadAccount()
    },
    onSettled: finish,
  })
  const rename = useMutation({
    mutationFn: () => updateAdminUserName(session, user.id, username.trim()),
    onMutate: begin,
    onSuccess: () => {
      cache.setQueryData<AdminUserDetails>(
        detailsKey,
        (current) =>
          current && {
            ...current,
            username: username.trim(),
            displayName: username.trim(),
          },
      )
      setUsername(undefined)
      setNotice(t('Nom d’utilisateur enregistré.'))
      reloadAccount()
    },
    onSettled: finish,
  })
  const changePassword = useMutation({
    mutationFn: () => updateAdminUserPassword(session, user.id, password),
    onMutate: begin,
    onSuccess: () => {
      setPassword('')
      setNotice(t('Mot de passe enregistré.'))
    },
    onSettled: finish,
  })
  const remove = useMutation({
    mutationFn: () => deleteAdminUser(session, user.id),
    onMutate: begin,
    onSuccess: () => {
      onChanged()
      onDeleted()
    },
    onSettled: finish,
  })
  const pending =
    save.isPending ||
    rename.isPending ||
    changePassword.isPending ||
    remove.isPending
  const selections = options.data
  const optionsNeeded =
    section === 'access' ||
    section === 'restrictions' ||
    (section === 'account' && user.canChangeProviders)

  const applyPolicy = () => {
    if (policyForm.current && !policyForm.current.reportValidity()) return
    save.mutate()
  }

  return (
    <>
      <div
        className="admin-user-sections"
        role="group"
        aria-label={t('Paramètres du compte')}
      >
        {(Object.keys(adminUserSections) as EditSection[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={section === item}
            onClick={() => {
              if (policyForm.current && !policyForm.current.reportValidity())
                return
              setSection(item)
              setConfirmDelete(false)
            }}
            disabled={pending}
          >
            {t(adminUserSections[item])}
          </button>
        ))}
      </div>
      <div className="admin-user-editor-body" aria-busy={pending}>
        {!user.canEdit && (
          <p className="admin-user-field-help">
            {t('Les paramètres de ce compte sont protégés.')}
          </p>
        )}
        {section === 'security' ? (
          <>
            <form
              className="admin-user-policy-group"
              onSubmit={(event) => {
                event.preventDefault()
                changePassword.mutate()
              }}
            >
              <h4>{t('Mot de passe')}</h4>
              {user.canChangePassword ? (
                <>
                  <label className="admin-user-field">
                    <span>{t('Nouveau mot de passe')}</span>
                    <TextInput
                      type="password"
                      autoComplete="new-password"
                      name="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={8}
                      maxLength={1024}
                      required
                      disabled={pending}
                    />
                  </label>
                  <Button type="submit" disabled={pending || !password.trim()}>
                    {t('Enregistrer le mot de passe')}
                  </Button>
                  <EditorError error={changePassword.error} />
                </>
              ) : (
                <p className="admin-user-field-help">
                  {t(
                    user.registrationMethod === 'GOOGLE'
                      ? 'Le mot de passe de ce compte est géré par Google.'
                      : 'Le mot de passe de ce compte est protégé.',
                  )}
                </p>
              )}
            </form>
            {user.canDelete && (
              <section className="admin-user-policy-group admin-user-danger">
                <h4>{t('Supprimer le compte')}</h4>
                {confirmDelete ? (
                  <>
                    <p>
                      {t('Supprimer définitivement le compte de {name} ?', {
                        name: user.displayName ?? user.username,
                      })}
                    </p>
                    <p className="admin-user-field-help">
                      {t(
                        'Son historique de lecture et ses préférences seront supprimés.',
                      )}
                    </p>
                    <div className="admin-user-inline-actions">
                      <Button
                        disabled={pending}
                        onClick={() => setConfirmDelete(false)}
                      >
                        {t('Annuler')}
                      </Button>
                      <Button
                        disabled={pending}
                        className="admin-user-delete"
                        onClick={() => remove.mutate()}
                      >
                        {t('Confirmer la suppression')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    disabled={pending}
                    className="admin-user-delete"
                    onClick={() => {
                      remove.reset()
                      setConfirmDelete(true)
                    }}
                  >
                    {t('Supprimer le compte')}
                  </Button>
                )}
                <EditorError error={remove.error} />
              </section>
            )}
          </>
        ) : (
          <>
            {section === 'account' && (
              <form
                className="admin-user-policy-group"
                onSubmit={(event) => {
                  event.preventDefault()
                  rename.mutate()
                }}
              >
                <h4>{t('Nom d’utilisateur')}</h4>
                {user.canRename ? (
                  <div className="admin-user-inline-actions">
                    <TextInput
                      name="username"
                      aria-label={t('Nom d’utilisateur')}
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      maxLength={255}
                      required
                      disabled={pending}
                    />
                    <Button
                      type="submit"
                      disabled={
                        pending ||
                        !username.trim() ||
                        username.trim() === user.username
                      }
                    >
                      {t('Renommer')}
                    </Button>
                  </div>
                ) : (
                  <p className="admin-user-field-help">
                    {t(
                      user.registrationMethod === 'GOOGLE'
                        ? 'Ce compte utilise son profil Google.'
                        : 'Le nom d’utilisateur de ce compte est protégé.',
                    )}
                  </p>
                )}
                <EditorError error={rename.error} />
              </form>
            )}
            {optionsNeeded && options.isPending && (
              <p role="status">{t('Chargement…')}</p>
            )}
            {optionsNeeded && options.isError && (
              <>
                <EditorError error={options.error} />
                <Button
                  onClick={() => void options.refetch()}
                  disabled={pending || options.isFetching}
                >
                  {t('Réessayer')}
                </Button>
              </>
            )}
            <form
              ref={policyForm}
              onSubmit={(event) => {
                event.preventDefault()
                if (user.canEdit && changed && !pending) applyPolicy()
              }}
            >
              <fieldset className="admin-user-policy" disabled={pending}>
                <AdminUserPolicyFields
                  section={section}
                  user={user}
                  policy={policy}
                  options={selections}
                  change={(fields) =>
                    setChanges((draft) => ({ ...draft, ...fields }))
                  }
                />
              </fieldset>
            </form>
          </>
        )}
      </div>
      <footer className="admin-user-editor-footer">
        <div className="admin-user-editor-feedback">
          {notice && <p role="status">{notice}</p>}
          <EditorError error={save.error} />
        </div>
        {user.canEdit && (
          <Button
            variant="primary"
            disabled={pending || !changed}
            onClick={applyPolicy}
          >
            {t('Enregistrer les paramètres')}
          </Button>
        )}
      </footer>
    </>
  )
}
