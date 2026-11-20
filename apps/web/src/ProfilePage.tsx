import { localizeText } from './i18n/messages.ts'
import { useI18n } from './i18n/I18nProvider.tsx'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { duration, ease, staggerDelay } from './motion/tokens.ts'
import { usePerformanceReducedMotion } from './performance/PerformanceProvider.tsx'
import { PerformancePreference } from './performance/PerformancePreference.tsx'
import {
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { AccountProfile } from '@hollyfilms/shared/profile'
import { LanguageSelect } from './ui/LanguageSelect.tsx'
import { Wordmark } from './ui/Wordmark.tsx'
import { ProfileAvatar } from './ui/ProfileAvatar.tsx'
import './profile.css'

export type ProfilePageProps = {
  profile?: AccountProfile
  avatarUrl?: string
  state: 'loading' | 'ready' | 'error'
  signingOut?: boolean
  deviceSettings?: ReactNode
  onRetry: () => void
  onUpload: (file: File) => Promise<void>
  onDeleteImage: () => Promise<void>
  onPassword: (current: string, next: string) => Promise<void>
  onSignOut: () => void
}

export function ProfilePage({
  profile,
  avatarUrl,
  state,
  signingOut,
  deviceSettings,
  onRetry,
  onUpload,
  onDeleteImage,
  onPassword,
  onSignOut,
}: ProfilePageProps) {
  const { t } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const fileInput = useRef<HTMLInputElement>(null)
  const changePhoto = useRef<HTMLButtonElement>(null)
  const resetPhoto = useRef<HTMLButtonElement>(null)
  const cancelPhoto = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const passwordForm = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{
    place: 'photo' | 'password'
    error: boolean
    text: string
  }>()
  const [removePassword, setRemovePassword] = useState(false)
  const [confirmPhoto, setConfirmPhoto] = useState(false)
  useLayoutEffect(() => {
    if (confirmPhoto) cancelPhoto.current?.focus({ preventScroll: true })
    else if (wasConfirming.current)
      (resetPhoto.current ?? changePhoto.current)?.focus({
        preventScroll: true,
      })
    wasConfirming.current = confirmPhoto
  }, [confirmPhoto])
  async function save(
    place: 'photo' | 'password',
    action: () => Promise<void>,
    success: string,
  ) {
    if (busy) return
    setBusy(true)
    setNotice(undefined)
    try {
      await action()
      setNotice({ place, error: false, text: success })
    } catch (error) {
      setNotice({
        place,
        error: true,
        text:
          error instanceof Error
            ? error.message
            : 'Impossible d’enregistrer. Réessaie.',
      })
    } finally {
      setBusy(false)
    }
  }
  const entry = (order: number) => ({
    initial: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduced ? 0 : duration.scene,
      ease: ease.out,
      delay: reduced ? 0 : staggerDelay(order),
    },
  })
  const feedback = notice && (
    <motion.p
      key={notice.text}
      className={notice.error ? 'profile-notice is-error' : 'profile-notice'}
      role={notice.error ? 'alert' : 'status'}
      initial={{ opacity: 0.55, y: reduced ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.micro, ease: ease.out }}
    >
      {notice.error ? (
        <CircleAlert size={17} aria-hidden="true" />
      ) : (
        <Check size={17} aria-hidden="true" />
      )}
      {localizeText(t, notice.text, 'Impossible d’enregistrer. Réessaie.')}
    </motion.p>
  )
  return (
    <main className="profile-page">
      <header className="profile-topbar">
        <a href="/app" aria-label={t('HollyFilms, accueil')}>
          <Wordmark />
        </a>
        <a href="/app" className="profile-back">
          <ArrowLeft size={17} /> {t('Retour au catalogue')}
        </a>
      </header>
      <motion.div className="profile-heading" {...entry(0)}>
        <span className="profile-eyebrow">{t('VOTRE ESPACE')}</span>
        <h1>
          {t('Mon profil')}
          <span>.</span>
        </h1>
        <p>{t('Votre compte, à votre image.')}</p>
      </motion.div>
      {state === 'loading' && (
        <div className="profile-grid" role="status">
          <div className="profile-panel profile-identity profile-pending">
            <span className="profile-portrait" aria-hidden="true" />
            {t('Chargement du profil…')}
          </div>
          <div className="profile-settings" aria-hidden="true">
            <div className="profile-panel surface-placeholder" />
            <div className="profile-panel surface-placeholder" />
          </div>
        </div>
      )}
      {state === 'error' && (
        <div className="profile-panel">
          <p role="alert">{t('Impossible de charger le profil.')}</p>
          <button className="profile-button" onClick={onRetry}>
            {t('Réessayer')}
          </button>
        </div>
      )}
      {profile && state === 'ready' && (
        <div className="profile-grid">
          <motion.section
            className="profile-panel profile-identity"
            aria-labelledby="profile-name"
            {...entry(1)}
          >
            <div className="profile-portrait">
              <ProfileAvatar name={profile.name} src={avatarUrl} />
              <span className="profile-portrait-badge">
                <UserRound size={20} />
              </span>
            </div>
            <span className="profile-eyebrow">
              {profile.isAdministrator
                ? t('ADMINISTRATEUR')
                : t('MEMBRE HOLLYFILMS')}
            </span>
            <h2 id="profile-name">{profile.name}</h2>
            {profile.google?.email && (
              <p className="profile-email">{profile.google.email}</p>
            )}
            <p className="profile-photo-source">
              {profile.imageTag
                ? t('Photo personnalisée')
                : profile.google?.picture
                  ? t('Photo de votre compte Google')
                  : t('Votre avatar')}
            </p>
            {profile.canEdit && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={t('Choisir une photo de profil')}
                  className="sr-only"
                  tabIndex={-1}
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file)
                      void save(
                        'photo',
                        () => onUpload(file),
                        'Photo de profil mise à jour.',
                      )
                  }}
                />
                <button
                  ref={changePhoto}
                  className="profile-button profile-primary"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <Camera size={17} /> {t('Changer la photo')}
                </button>
                <p className="profile-hint">
                  {t('JPG, PNG ou WebP · 2 Mo maximum')}
                </p>
                {profile.imageTag && (
                  <button
                    ref={resetPhoto}
                    className="profile-text-button"
                    disabled={busy}
                    aria-expanded={confirmPhoto}
                    onClick={() => setConfirmPhoto(true)}
                  >
                    <Trash2 size={15} />
                    {profile.google?.picture
                      ? t('Revenir à la photo Google')
                      : t('Supprimer la photo')}
                  </button>
                )}
                <div
                  className="profile-confirm"
                  data-disclosure={confirmPhoto ? 'open' : 'closed'}
                  inert={!confirmPhoto}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && !busy) {
                      event.preventDefault()
                      event.stopPropagation()
                      setConfirmPhoto(false)
                    }
                  }}
                >
                  <div>
                    <div className="profile-confirm-body">
                      <p>{t('Supprimer la photo personnalisée ?')}</p>
                      <div>
                        <button
                          ref={cancelPhoto}
                          className="profile-button"
                          disabled={busy}
                          onClick={() => setConfirmPhoto(false)}
                        >
                          {t('Annuler')}
                        </button>
                        <button
                          className="profile-button"
                          disabled={busy}
                          onClick={() =>
                            void save(
                              'photo',
                              async () => {
                                await onDeleteImage()
                                setConfirmPhoto(false)
                              },
                              'Photo réinitialisée.',
                            )
                          }
                        >
                          {t('Confirmer')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {notice?.place === 'photo' && feedback}
              </>
            )}
            {profile.google && !profile.google.picture && !profile.imageTag && (
              <p className="profile-hint">
                {t(
                  'Reconnectez-vous avec Google pour récupérer votre photo, ou choisissez une image.',
                )}
              </p>
            )}
            {!profile.canEdit && (
              <p className="profile-hint">
                {t(
                  'La modification du profil est désactivée par l’administrateur.',
                )}
              </p>
            )}
          </motion.section>
          <div className="profile-settings">
            <motion.section
              className="profile-panel"
              aria-labelledby="profile-preferences"
              {...entry(2)}
            >
              <h2
                id="profile-preferences"
                className="mb-4 text-lg font-semibold"
              >
                {t('Préférences')}
              </h2>
              <div className="grid gap-5">
                <LanguageSelect />
                <PerformancePreference />
              </div>
            </motion.section>
            {deviceSettings}
            <motion.section
              className="profile-panel"
              aria-labelledby="profile-security"
              {...entry(3)}
            >
              <div className="profile-section-title">
                <span>
                  <LockKeyhole size={21} />
                </span>
                <div>
                  <h2 id="profile-security">{t('Connexion & sécurité')}</h2>
                  <p>
                    {profile.google
                      ? t('Vous vous connectez avec Google.')
                      : t('Gérez le mot de passe de votre compte.')}
                  </p>
                </div>
              </div>
              {profile.google ? (
                <div className="profile-google-info">
                  <ShieldCheck size={24} />
                  <div>
                    <h3>{t('Protégé par Google')}</h3>
                    <p>
                      {t(
                        'Votre mot de passe est géré par votre compte Google. Votre connexion HollyFilms reste inchangée.',
                      )}
                    </p>
                    <a
                      className="profile-text-button"
                      href="https://myaccount.google.com/security"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('Gérer la sécurité Google ↗')}
                    </a>
                  </div>
                </div>
              ) : !profile.canEdit ? (
                <p className="profile-hint">
                  {t(
                    'Contactez l’administrateur pour modifier votre mot de passe.',
                  )}
                </p>
              ) : (
                <form
                  ref={passwordForm}
                  onSubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget)
                    const current = String(form.get('current') ?? '')
                    const next = removePassword
                      ? ''
                      : String(form.get('next') ?? '')
                    if (
                      !removePassword &&
                      next !== String(form.get('confirm') ?? '')
                    ) {
                      setNotice({
                        place: 'password',
                        error: true,
                        text: 'Les mots de passe ne correspondent pas.',
                      })
                      passwordForm.current
                        ?.querySelector<HTMLInputElement>(
                          'input[name="confirm"]',
                        )
                        ?.focus()
                      return
                    }
                    void save(
                      'password',
                      async () => {
                        await onPassword(current, next)
                        passwordForm.current?.reset()
                        setRemovePassword(false)
                      },
                      removePassword
                        ? 'Mot de passe supprimé.'
                        : 'Mot de passe enregistré.',
                    )
                  }}
                >
                  <fieldset disabled={busy} className="profile-fields">
                    {profile.hasPassword && (
                      <label>
                        {t('Mot de passe actuel')}
                        <input
                          name="current"
                          type="password"
                          autoComplete="current-password"
                          maxLength={1024}
                        />
                      </label>
                    )}
                    {!removePassword && (
                      <div className="profile-password-pair">
                        <label>
                          {t('Nouveau mot de passe')}
                          <input
                            name="next"
                            type="password"
                            autoComplete="new-password"
                            maxLength={1024}
                            required
                          />
                        </label>
                        <label>
                          {t('Confirmer le mot de passe')}
                          <input
                            name="confirm"
                            type="password"
                            autoComplete="new-password"
                            maxLength={1024}
                            required
                          />
                        </label>
                      </div>
                    )}
                    {removePassword && (
                      <p className="profile-confirm">
                        {t(
                          'Votre compte pourra être ouvert sans mot de passe. Saisissez votre mot de passe actuel pour confirmer sa suppression.',
                        )}
                      </p>
                    )}
                    <div className="profile-form-actions">
                      <button
                        type="submit"
                        className="profile-button profile-primary"
                      >
                        {busy
                          ? t('Enregistrement…')
                          : removePassword
                            ? t('Confirmer la suppression')
                            : t('Enregistrer le mot de passe')}
                      </button>
                      {!profile.isAdministrator && profile.hasPassword && (
                        <button
                          type="button"
                          className="profile-text-button"
                          onClick={() => setRemovePassword(!removePassword)}
                        >
                          {removePassword
                            ? t('Annuler')
                            : t('Supprimer le mot de passe')}
                        </button>
                      )}
                    </div>
                  </fieldset>
                  {notice?.place === 'password' && feedback}
                </form>
              )}
            </motion.section>
            <motion.section
              className="profile-panel profile-session"
              aria-label={t('Session')}
              {...entry(4)}
            >
              <div>
                <h2>{t('Votre session')}</h2>
                <p>{t('Connecté sur cet appareil.')}</p>
              </div>
              <div className="profile-session-actions">
                {profile.isAdministrator && (
                  <a href="/admin" className="profile-button">
                    <ShieldCheck size={17} /> {t('Administration')}
                  </a>
                )}
                <button
                  className="profile-button"
                  disabled={busy || signingOut}
                  onClick={onSignOut}
                >
                  <LogOut size={17} />
                  {signingOut ? t('Déconnexion…') : t('Se déconnecter')}
                </button>
              </div>
            </motion.section>
          </div>
        </div>
      )}
    </main>
  )
}
