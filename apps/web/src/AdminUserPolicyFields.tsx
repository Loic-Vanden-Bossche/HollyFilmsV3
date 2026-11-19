import {
  adminUserScheduleDays,
  adminUserSyncPlayModes,
  adminUserUnratedKinds,
  type AdminUserDetails,
  type AdminUserOptions,
  type AdminUserPolicy,
} from '@hollyfilms/shared/accounts'
import { useI18n } from './i18n/I18nProvider.tsx'
import type { Message } from './i18n/messages.ts'
import { Button } from './ui/Button.tsx'
import { TextInput } from './ui/TextInput.tsx'

type PolicySection = 'account' | 'access' | 'playback' | 'restrictions'
type Option = { id: string; name: string }
type Schedule = NonNullable<AdminUserPolicy['AccessSchedules']>[number]
type ScheduleDay = (typeof adminUserScheduleDays)[number]
type UnratedKind = (typeof adminUserUnratedKinds)[number]
type SyncPlayMode = (typeof adminUserSyncPlayModes)[number]

const dayLabels: Record<ScheduleDay, Message> = {
  Monday: 'Lundi',
  Tuesday: 'Mardi',
  Wednesday: 'Mercredi',
  Thursday: 'Jeudi',
  Friday: 'Vendredi',
  Saturday: 'Samedi',
  Sunday: 'Dimanche',
  Everyday: 'Tous les jours',
  Weekday: 'Jours de semaine',
  Weekend: 'Week-end',
}

const unratedLabels: Record<UnratedKind, Message> = {
  Movie: 'Films',
  Trailer: 'Bandes-annonces',
  Series: 'Séries',
  Music: 'Musique',
  Book: 'Livres',
  LiveTvChannel: 'Chaînes TV en direct',
  LiveTvProgram: 'Émissions TV en direct',
  ChannelContent: 'Contenu des chaînes',
  Other: 'Autres contenus',
}

const syncPlayLabels: Record<SyncPlayMode, Message> = {
  CreateAndJoinGroups: 'Créer et rejoindre des groupes',
  JoinGroups: 'Rejoindre des groupes',
  None: 'Aucun accès',
}

const playback = [
  ['EnableMediaPlayback', 'Autoriser la lecture'],
  ['EnableAudioPlaybackTranscoding', 'Autoriser le transcodage audio'],
  ['EnableVideoPlaybackTranscoding', 'Autoriser le transcodage vidéo'],
  ['EnablePlaybackRemuxing', 'Autoriser le remuxage'],
  [
    'ForceRemoteSourceTranscoding',
    'Forcer le transcodage des sources distantes',
  ],
  ['EnableLiveTvAccess', 'Autoriser la TV en direct'],
  ['EnableLiveTvManagement', 'Gérer la TV en direct'],
  ['EnableCollectionManagement', 'Gérer les collections'],
  ['EnableSubtitleManagement', 'Gérer les sous-titres'],
  ['EnableLyricManagement', 'Gérer les paroles'],
  ['EnableContentDownloading', 'Autoriser les téléchargements'],
  ['EnablePublicSharing', 'Autoriser le partage public'],
  [
    'EnableRemoteControlOfOtherUsers',
    'Contrôler la lecture des autres utilisateurs',
  ],
  ['EnableSharedDeviceControl', 'Contrôler les appareils partagés'],
] as const satisfies readonly (readonly [keyof AdminUserPolicy, Message])[]

export function AdminUserPolicyFields({
  section,
  user,
  policy,
  options,
  change,
}: {
  section: PolicySection
  user: AdminUserDetails
  policy: AdminUserPolicy
  options?: AdminUserOptions
  change: (patch: AdminUserPolicy) => void
}) {
  const { t } = useI18n()

  const toggle = (
    key: keyof AdminUserPolicy,
    label: Message,
    disabled = !user.canEdit,
    help?: Message,
  ) => (
    <PolicyCheck
      key={key}
      label={t(label)}
      help={help && t(help)}
      checked={Boolean(policy[key])}
      disabled={disabled}
      onChange={(checked) => change({ [key]: checked })}
    />
  )

  if (section === 'account') {
    return (
      <>
        <fieldset className="admin-user-policy-group" disabled={!user.canEdit}>
          <legend>{t('Accès au compte')}</legend>
          <div className="admin-user-policy-grid">
            {toggle(
              'IsHidden',
              'Masquer sur l’écran de connexion',
              !user.canEdit,
              'Le masquage concerne le sélecteur de comptes Jellyfin. Les autorisations de connexion sont indépendantes.',
            )}
            {toggle('IsDisabled', 'Suspendre l’accès', !user.canChangeAccess)}
            {toggle('IsAdministrator', 'Administrateur', !user.canChangeRole)}
            {toggle(
              'EnableRemoteAccess',
              'Autoriser l’accès à distance',
              !user.canEdit || user.isCurrentUser,
            )}
            {toggle(
              'EnableUserPreferenceAccess',
              'Autoriser la modification des préférences',
            )}
          </div>
        </fieldset>
        <fieldset className="admin-user-policy-group" disabled={!user.canEdit}>
          <legend>{t('Limites de connexion')}</legend>
          <div className="admin-user-policy-grid">
            <PolicyNumber
              label={t('Nombre maximal de sessions actives')}
              help={t('0 signifie aucune limite.')}
              value={policy.MaxActiveSessions ?? 0}
              onChange={(MaxActiveSessions) => change({ MaxActiveSessions })}
            />
            <PolicyNumber
              label={t('Tentatives avant verrouillage')}
              help={t('−1 désactive le verrouillage.')}
              min={-1}
              value={policy.LoginAttemptsBeforeLockout ?? 0}
              onChange={(LoginAttemptsBeforeLockout) =>
                change({ LoginAttemptsBeforeLockout })
              }
            />
          </div>
        </fieldset>
        {user.canChangeProviders && options && (
          <fieldset
            className="admin-user-policy-group"
            disabled={!user.canEdit}
          >
            <legend>{t('Fournisseurs')}</legend>
            <div className="admin-user-policy-grid">
              <PolicySelect
                label={t('Fournisseur d’authentification')}
                defaultLabel={t('Par défaut')}
                defaultDisabled
                choices={options.authenticationProviders}
                value={policy.AuthenticationProviderId ?? ''}
                onChange={(AuthenticationProviderId) =>
                  change({ AuthenticationProviderId })
                }
              />
              <PolicySelect
                label={t('Fournisseur de réinitialisation du mot de passe')}
                defaultLabel={t('Par défaut')}
                defaultDisabled
                choices={options.passwordResetProviders}
                value={policy.PasswordResetProviderId ?? ''}
                onChange={(PasswordResetProviderId) =>
                  change({ PasswordResetProviderId })
                }
              />
            </div>
          </fieldset>
        )}
      </>
    )
  }

  if (section === 'access') {
    return (
      options && (
        <>
          <ResourceList
            title={t('Bibliothèques')}
            allLabel={t('Toutes les bibliothèques')}
            all={policy.EnableAllFolders ?? false}
            available={options.libraries}
            selected={policy.EnabledFolders ?? []}
            disabled={!user.canEdit}
            onAll={(EnableAllFolders) => change({ EnableAllFolders })}
            onSelected={(EnabledFolders) => change({ EnabledFolders })}
          />
          <ResourceList
            title={t('Appareils')}
            allLabel={t('Tous les appareils')}
            all={policy.EnableAllDevices ?? false}
            available={options.devices}
            selected={policy.EnabledDevices ?? []}
            disabled={!user.canEdit || user.isCurrentUser}
            onAll={(EnableAllDevices) => change({ EnableAllDevices })}
            onSelected={(EnabledDevices) => change({ EnabledDevices })}
          />
          <ResourceList
            title={t('Chaînes')}
            allLabel={t('Toutes les chaînes')}
            all={policy.EnableAllChannels ?? false}
            available={options.channels}
            selected={policy.EnabledChannels ?? []}
            disabled={!user.canEdit}
            onAll={(EnableAllChannels) => change({ EnableAllChannels })}
            onSelected={(EnabledChannels) => change({ EnabledChannels })}
          />
          <ResourceList
            title={t('Suppression de médias')}
            allLabel={t(
              'Autoriser la suppression dans toutes les bibliothèques',
            )}
            all={policy.EnableContentDeletion ?? false}
            available={options.libraries}
            selected={policy.EnableContentDeletionFromFolders ?? []}
            disabled={!user.canEdit}
            onAll={(EnableContentDeletion) => change({ EnableContentDeletion })}
            onSelected={(EnableContentDeletionFromFolders) =>
              change({ EnableContentDeletionFromFolders })
            }
          />
        </>
      )
    )
  }

  if (section === 'playback') {
    return (
      <>
        <fieldset className="admin-user-policy-group" disabled={!user.canEdit}>
          <legend>{t('Lecture et permissions')}</legend>
          <div className="admin-user-policy-grid">
            {playback.map(([key, label]) => toggle(key, label))}
          </div>
        </fieldset>
        <fieldset className="admin-user-policy-group" disabled={!user.canEdit}>
          <legend>{t('Diffusion')}</legend>
          <div className="admin-user-policy-grid">
            <PolicyNumber
              label={t('Débit distant maximal (Mbit/s)')}
              help={t('0 signifie aucune limite.')}
              value={(policy.RemoteClientBitrateLimit ?? 0) / 1_000_000}
              max={2_147}
              step="0.000001"
              onChange={(value) =>
                change({
                  RemoteClientBitrateLimit: Math.round(value * 1_000_000),
                })
              }
            />
            <PolicySelect
              label={t('Accès à SyncPlay')}
              value={policy.SyncPlayAccess ?? 'None'}
              choices={adminUserSyncPlayModes.map((id) => ({
                id,
                name: t(syncPlayLabels[id]),
              }))}
              onChange={(value) =>
                change({ SyncPlayAccess: value as SyncPlayMode })
              }
            />
          </div>
        </fieldset>
      </>
    )
  }

  const rating = options?.ratings.find(
    ({ value, subValue }) =>
      value === policy.MaxParentalRating &&
      subValue === (policy.MaxParentalSubRating ?? null),
  )
  const ratingValue =
    rating?.id ??
    (policy.MaxParentalRating == null ? '' : String(policy.MaxParentalRating))
  const unrated = policy.BlockUnratedItems ?? []

  return (
    <>
      <fieldset className="admin-user-policy-group" disabled={!user.canEdit}>
        <legend>{t('Contrôle parental')}</legend>
        {options && (
          <PolicySelect
            label={t('Classification maximale')}
            defaultLabel={t('Sans restriction')}
            value={ratingValue}
            choices={options.ratings}
            onChange={(id) => {
              const selected = options.ratings.find((entry) => entry.id === id)
              change({
                MaxParentalRating: selected?.value ?? null,
                MaxParentalSubRating: selected?.subValue ?? null,
              })
            }}
          />
        )}
        <div className="admin-user-policy-grid">
          <TagInput
            label={t('Tags autorisés')}
            value={policy.AllowedTags ?? []}
            onChange={(AllowedTags) => change({ AllowedTags })}
          />
          <TagInput
            label={t('Tags bloqués')}
            value={policy.BlockedTags ?? []}
            onChange={(BlockedTags) => change({ BlockedTags })}
          />
        </div>
        <fieldset className="admin-user-policy-subgroup">
          <legend>{t('Bloquer les contenus sans classification')}</legend>
          <div className="admin-user-policy-grid">
            {adminUserUnratedKinds.map((kind) => (
              <PolicyCheck
                key={kind}
                label={t(unratedLabels[kind])}
                checked={unrated.includes(kind)}
                onChange={(checked) =>
                  change({
                    BlockUnratedItems: checked
                      ? [...unrated, kind]
                      : unrated.filter((value) => value !== kind),
                  })
                }
              />
            ))}
          </div>
        </fieldset>
      </fieldset>
      <AccessSchedule
        disabled={!user.canEdit || user.isCurrentUser}
        entries={policy.AccessSchedules ?? []}
        onChange={(AccessSchedules) => change({ AccessSchedules })}
      />
    </>
  )
}

function PolicyCheck({
  checked,
  onChange,
  label,
  help,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  help?: string
  disabled?: boolean
}) {
  return (
    <label className="admin-user-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span>
        {label}
        {help && <small>{help}</small>}
      </span>
    </label>
  )
}

function PolicyNumber({
  label,
  help,
  value,
  onChange,
  min = 0,
  max = 2_147_483_647,
  step = '1',
}: {
  label: string
  help?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: string
}) {
  return (
    <label className="admin-user-field">
      <span>{label}</span>
      <TextInput
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {help && <small>{help}</small>}
    </label>
  )
}

function PolicySelect({
  label,
  choices,
  value,
  onChange,
  defaultLabel,
  defaultDisabled,
}: {
  label: string
  choices: readonly Option[]
  value: string
  onChange: (value: string) => void
  defaultLabel?: string
  defaultDisabled?: boolean
}) {
  return (
    <label className="admin-user-field">
      <span>{label}</span>
      <select
        className="glass-input admin-user-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {defaultLabel && (
          <option value="" disabled={defaultDisabled}>
            {defaultLabel}
          </option>
        )}
        {value && !choices.some((choice) => choice.id === value) && (
          <option value={value}>{value}</option>
        )}
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function ResourceList({
  title,
  allLabel,
  all,
  available,
  selected,
  disabled,
  onAll,
  onSelected,
}: {
  title: string
  allLabel: string
  all: boolean
  available: readonly Option[]
  selected: readonly string[]
  disabled: boolean
  onAll: (enabled: boolean) => void
  onSelected: (ids: string[]) => void
}) {
  const { t } = useI18n()
  const entries = [
    ...available,
    ...selected
      .filter((id) => !available.some((option) => option.id === id))
      .map((id) => ({ id, name: id })),
  ]
  return (
    <fieldset className="admin-user-policy-group" disabled={disabled}>
      <legend>{title}</legend>
      <PolicyCheck label={allLabel} checked={all} onChange={onAll} />
      {!all &&
        (entries.length ? (
          <div className="admin-user-policy-grid">
            {entries.map(({ id, name }) => (
              <PolicyCheck
                key={id}
                label={name}
                checked={selected.includes(id)}
                onChange={(checked) =>
                  onSelected(
                    checked
                      ? [...selected, id]
                      : selected.filter((saved) => saved !== id),
                  )
                }
              />
            ))}
          </div>
        ) : (
          <p className="admin-user-field-help">
            {t('Aucune option disponible.')}
          </p>
        ))}
    </fieldset>
  )
}

function TagInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string[]
  onChange: (tags: string[]) => void
}) {
  const { t } = useI18n()
  return (
    <label className="admin-user-field">
      <span>{label}</span>
      <textarea
        className="glass-input admin-user-select"
        rows={3}
        defaultValue={value.join('\n')}
        onChange={({ target }) =>
          onChange([
            ...new Set(
              target.value
                .split('\n')
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ])
        }
      />
      <small>{t('Un tag par ligne.')}</small>
    </label>
  )
}

const scheduleHours = Array.from({ length: 49 }, (_, index) => index / 2)
const hourLabel = (value: number) => {
  const minutes = Math.round(value * 60)
  return (
    String(Math.floor(minutes / 60)).padStart(2, '0') +
    ':' +
    String(minutes % 60).padStart(2, '0')
  )
}

function AccessSchedule({
  disabled,
  entries,
  onChange,
}: {
  disabled: boolean
  entries: readonly Schedule[]
  onChange: (entries: Schedule[]) => void
}) {
  const { t } = useI18n()
  // Strip Jellyfin's generated schedule IDs from administrator input.
  const rows = entries.map(({ DayOfWeek, StartHour, EndHour }) => ({
    DayOfWeek,
    StartHour,
    EndHour,
  }))
  const update = (index: number, patch: Partial<Schedule>) =>
    onChange(
      rows.map((row, key) => (key === index ? { ...row, ...patch } : row)),
    )
  const choices = (value: number) =>
    [...new Set([...scheduleHours, value])]
      .sort((a, b) => a - b)
      .map((hour) => ({ id: String(hour), name: hourLabel(hour) }))

  return (
    <fieldset className="admin-user-policy-group" disabled={disabled}>
      <legend>{t('Horaires d’accès')}</legend>
      {!rows.length && (
        <p className="admin-user-field-help">
          {t('Aucun horaire défini. L’accès est autorisé à toute heure.')}
        </p>
      )}
      {rows.map(({ DayOfWeek, StartHour, EndHour }, index) => (
        <div
          className="admin-user-schedule"
          key={index}
          role="group"
          aria-label={t('Créneau {number}', { number: index + 1 })}
        >
          <PolicySelect
            label={t('Jour')}
            value={DayOfWeek ?? 'Everyday'}
            choices={adminUserScheduleDays.map((day) => ({
              id: day,
              name: t(dayLabels[day]),
            }))}
            onChange={(day) => update(index, { DayOfWeek: day as ScheduleDay })}
          />
          <PolicySelect
            label={t('Début')}
            value={String(StartHour ?? 0)}
            choices={choices(StartHour ?? 0).filter(
              (option) => option.id !== '24',
            )}
            onChange={(hour) => update(index, { StartHour: Number(hour) })}
          />
          <PolicySelect
            label={t('Fin')}
            value={String(EndHour ?? 24)}
            choices={choices(EndHour ?? 24)}
            onChange={(hour) => update(index, { EndHour: Number(hour) })}
          />
          <Button
            onClick={() => onChange(rows.filter((_, key) => key !== index))}
          >
            {t('Retirer le créneau')}
          </Button>
        </div>
      ))}
      <Button
        onClick={() =>
          onChange([
            ...rows,
            { DayOfWeek: 'Everyday', StartHour: 8, EndHour: 22 },
          ])
        }
      >
        {t('Ajouter un créneau')}
      </Button>
    </fieldset>
  )
}
