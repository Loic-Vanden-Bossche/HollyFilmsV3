import { localizeText } from './i18n/messages.ts'
import { useI18n } from './i18n/I18nProvider.tsx'
import { Tooltip } from './ui/Tooltip.tsx'
import { useEffect, useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import {
  ArrowRight,
  Play,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import type { AuthOptions } from '@hollyfilms/shared/accounts'
import { registerAccount } from './account-api.ts'
import { TextInput } from './ui/TextInput.tsx'
import { Wordmark } from './ui/Wordmark.tsx'
import googleLogo from './assets/logos/google-gradient-96.png'
import { rememberAppReturn } from './use-app-route.ts'
import {
  BlurText,
  SpotlightCard,
  StarBorder,
  ShinyText,
} from './components/reactbits/Effects.tsx'
import { useMotionPolicy } from './components/reactbits/policy.ts'
import { duration, ease, scale, spring, staggerDelay } from './motion/tokens.ts'
import './auth.css'

type LoginFormProps = {
  initialMode?: 'login' | 'register'
  notice?: string
  options?: AuthOptions
  animationsPaused?: boolean
  onSignIn: (username: string, password: string) => Promise<void>
}

export function LoginForm({
  notice,
  options,
  onSignIn,
  initialMode = 'login',
  animationsPaused = false,
}: LoginFormProps) {
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState<string>()
  const [registering, setRegistering] = useState(initialMode === 'register')
  const [registered, setRegistered] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const successHeading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const { running } = useMotionPolicy(animationsPaused)
  const still = !running
  const transition = {
    duration: still ? 0 : duration.panel,
    ease: ease.out,
  }
  const enter = {
    hidden: { opacity: still ? 1 : 0, y: still ? 0 : 12 },
    visible: (order: number) => ({
      opacity: 1,
      y: 0,
      transition: { ...transition, delay: still ? 0 : staggerDelay(order) },
    }),
  }
  const feedback = {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition,
  }

  useEffect(() => {
    if (registered) successHeading.current?.focus()
  }, [registered])

  function changeMode(register: boolean) {
    if (submitting.current) return
    setRegistering(register)
    setError(undefined)
    setShowPassword(false)
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
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
      } else {
        await onSignIn(username, password)
      }
      form.reset()
      setShowPassword(false)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'La demande a échoué. Réessaie.',
      )
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <LayoutGroup id={id}>
      <StarBorder className="auth-effect-frame">
        <SpotlightCard>
          <motion.section
            className="auth-card glass-panel"
            aria-labelledby={
              id + (registered ? '-success-heading' : '-heading')
            }
            initial="hidden"
            animate="visible"
          >
            <div className="auth-light" aria-hidden="true">
              <motion.div
                key={String(registering)}
                initial={{ x: still ? '0%' : '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                  duration: still ? 0 : duration.feature,
                  ease: ease.inOut,
                }}
              />
            </div>
            <div className="auth-layout">
              <aside
                className="auth-aside"
                aria-label={t('Votre espace cinéma')}
              >
                <div className="auth-aside-visual" aria-hidden="true">
                  <motion.div
                    className="auth-orbit"
                    initial={{ rotate: still ? -12 : -30, opacity: 0 }}
                    animate={{ rotate: -12, opacity: 1 }}
                    transition={{
                      duration: still ? 0 : duration.feature,
                      ease: ease.out,
                    }}
                  />
                  <motion.div
                    className="auth-orbit auth-orbit-inner"
                    initial={{ rotate: still ? 12 : 30, opacity: 0 }}
                    animate={{ rotate: 12, opacity: 1 }}
                    transition={{
                      duration: still ? 0 : duration.feature,
                      delay: still ? 0 : duration.stagger,
                      ease: ease.out,
                    }}
                  />
                  <span className="auth-aside-play">
                    <Play size={32} fill="currentColor" />
                  </span>
                </div>
                <p className="auth-aside-kicker">HOLLYFILMS 3.0</p>
                <p className="auth-aside-title">
                  {t('Votre bibliothèque.')}
                  <br />
                  {t('Votre séance.')}
                </p>
                <p className="auth-aside-detail">
                  {t(
                    'Retrouvez vos films, vos séries et votre progression dans un seul espace.',
                  )}
                </p>
                <span className="auth-aside-caption">
                  <ShieldCheck size={15} /> {t('Un espace réservé aux membres')}
                </span>
              </aside>
              <div className="auth-main">
                <motion.div className="auth-brand" variants={enter} custom={0}>
                  <Wordmark compact />
                  <span className="auth-edition">
                    <ShinyText>3.0</ShinyText>
                  </span>
                </motion.div>

                <div hidden={registered} className="auth-form-content">
                  <motion.div
                    className="auth-switch"
                    role="group"
                    aria-label={t('Connexion ou inscription')}
                    variants={enter}
                    custom={1}
                  >
                    {[false, true].map((register) => (
                      <motion.button
                        key={String(register)}
                        type="button"
                        aria-pressed={registering === register}
                        disabled={isSubmitting}
                        onClick={() => changeMode(register)}
                        whileTap={still ? undefined : { scale: scale.pressed }}
                      >
                        {registering === register && (
                          <motion.span
                            className="auth-switch-active"
                            layoutId="auth-mode"
                            transition={
                              still ? { duration: 0 } : spring.control
                            }
                          />
                        )}
                        <span>
                          {register ? t('Inscription') : t('Connexion')}
                        </span>
                      </motion.button>
                    ))}
                  </motion.div>

                  <motion.div
                    className="auth-intro"
                    variants={enter}
                    custom={2}
                  >
                    <motion.div
                      key={String(registering)}
                      initial={{ opacity: 0, y: still ? 0 : 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={transition}
                    >
                      <h2 id={registered ? undefined : id + '-heading'}>
                        <BlurText
                          text={
                            registering
                              ? t('Créer votre compte.')
                              : t('Bon retour.')
                          }
                        />
                      </h2>
                      <p>
                        {registering
                          ? t('Votre accès commence ici.')
                          : t('Vos films et séries vous attendent.')}
                      </p>
                    </motion.div>
                  </motion.div>

                  {options?.googleStartUrl && (
                    <motion.div variants={enter} custom={3}>
                      <motion.a
                        className="auth-google glass-control"
                        href={options.googleStartUrl}
                        aria-disabled={isSubmitting || undefined}
                        tabIndex={isSubmitting ? -1 : undefined}
                        onClick={(event) => {
                          if (submitting.current) event.preventDefault()
                          else rememberAppReturn()
                        }}
                        whileHover={
                          still || isSubmitting ? undefined : { y: -2 }
                        }
                        whileTap={
                          still || isSubmitting
                            ? undefined
                            : { scale: scale.pressed }
                        }
                        transition={transition}
                      >
                        <img
                          src={googleLogo}
                          alt=""
                          width={20}
                          height={20}
                          className="shrink-0"
                        />
                        {t('Continuer avec Google')}
                        <ArrowRight size={16} aria-hidden="true" />
                      </motion.a>
                      <div className="auth-divider">
                        <span />
                        {t('ou avec vos identifiants')}
                        <span />
                      </div>
                    </motion.div>
                  )}

                  <AnimatePresence initial={false}>
                    {notice && (
                      <motion.div
                        key="notice"
                        {...feedback}
                        className="auth-feedback"
                      >
                        <p role="status" className="auth-notice">
                          {notice}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
                    <fieldset disabled={isSubmitting} className="auth-fields">
                      <motion.div variants={enter} custom={4}>
                        <label htmlFor={id + '-username'}>
                          {t('Nom d’utilisateur')}
                        </label>
                        <div className="auth-input-wrap">
                          <motion.span
                            className="auth-focus"
                            aria-hidden="true"
                            animate={{
                              opacity: focused === 'username' ? 1 : 0,
                            }}
                            transition={transition}
                          />
                          <UserRound
                            size={18}
                            className="auth-input-icon"
                            aria-hidden="true"
                          />
                          <TextInput
                            id={id + '-username'}
                            name="username"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            required
                            placeholder={t('Votre nom d’utilisateur')}
                            onFocus={() => setFocused('username')}
                            onBlur={() => setFocused(null)}
                          />
                        </div>
                      </motion.div>
                      <motion.div variants={enter} custom={5}>
                        <label htmlFor={id + '-password'}>
                          {t('Mot de passe')}
                        </label>
                        <div className="auth-input-wrap">
                          <motion.span
                            className="auth-focus"
                            aria-hidden="true"
                            animate={{
                              opacity: focused === 'password' ? 1 : 0,
                            }}
                            transition={transition}
                          />
                          <LockKeyhole
                            size={18}
                            className="auth-input-icon"
                            aria-hidden="true"
                          />
                          <TextInput
                            id={id + '-password'}
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete={
                              registering ? 'new-password' : 'current-password'
                            }
                            required={registering}
                            minLength={registering ? 8 : undefined}
                            aria-describedby={
                              registering ? id + '-password-hint' : undefined
                            }
                            placeholder={
                              registering
                                ? t('8 caractères minimum')
                                : t('Votre mot de passe')
                            }
                            onFocus={() => setFocused('password')}
                            onBlur={() => setFocused(null)}
                          />
                          <Tooltip>
                            <motion.button
                              className="auth-password-toggle"
                              type="button"
                              aria-label={
                                showPassword
                                  ? t('Masquer le mot de passe')
                                  : t('Afficher le mot de passe')
                              }
                              aria-pressed={showPassword}
                              onClick={() => setShowPassword(!showPassword)}
                              whileTap={
                                still ? undefined : { scale: scale.pressed }
                              }
                            >
                              <motion.span
                                key={String(showPassword)}
                                initial={{
                                  opacity: 0,
                                  rotate: still ? 0 : -25,
                                }}
                                animate={{ opacity: 1, rotate: 0 }}
                                transition={{
                                  duration: still ? 0 : duration.micro,
                                  ease: ease.out,
                                }}
                              >
                                {showPassword ? (
                                  <EyeOff size={18} />
                                ) : (
                                  <Eye size={18} />
                                )}
                              </motion.span>
                            </motion.button>
                          </Tooltip>
                        </div>
                        <AnimatePresence initial={false}>
                          {registering && (
                            <motion.div {...feedback} className="auth-feedback">
                              <p
                                id={id + '-password-hint'}
                                className="auth-hint"
                              >
                                {t('Choisissez au moins 8 caractères.')}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      <motion.button
                        className="auth-submit"
                        type="submit"
                        variants={enter}
                        custom={6}
                        whileHover={
                          still || isSubmitting ? undefined : { y: -2 }
                        }
                        whileTap={
                          still || isSubmitting
                            ? undefined
                            : { scale: scale.pressed }
                        }
                        transition={transition}
                      >
                        <motion.span
                          className="auth-submit-content"
                          key={isSubmitting ? 'sending' : String(registering)}
                          initial={{ opacity: 0, y: still ? 0 : 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: still ? 0 : duration.press,
                            ease: ease.out,
                          }}
                        >
                          {isSubmitting ? (
                            <>
                              <motion.span
                                aria-hidden="true"
                                className="auth-busy-dot"
                                animate={{
                                  opacity: still ? 1 : [0.35, 1, 0.35],
                                }}
                                transition={{
                                  duration: 1,
                                  repeat: still ? 0 : Infinity,
                                }}
                              />
                              {t('Envoi…')}
                            </>
                          ) : (
                            <>
                              {registering
                                ? t('Envoyer la demande')
                                : t('Se connecter')}
                              <ArrowRight size={18} aria-hidden="true" />
                            </>
                          )}
                        </motion.span>
                      </motion.button>
                    </fieldset>
                    <span role="status" className="sr-only">
                      {isSubmitting ? t('Envoi en cours…') : ''}
                    </span>
                    <AnimatePresence initial={false}>
                      {error && (
                        <motion.div {...feedback} className="auth-feedback">
                          <p role="alert" className="auth-error">
                            {localizeText(
                              t,
                              error,
                              'La demande a échoué. Réessaie.',
                            )}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </form>
                  <motion.p className="auth-access" variants={enter} custom={7}>
                    <ShieldCheck size={15} aria-hidden="true" />
                    <span>
                      {t(
                        'L’accès nécessite l’approbation d’un administrateur.',
                      )}
                    </span>
                  </motion.p>
                </div>

                {registered && (
                  <motion.div
                    className="auth-feedback"
                    initial={{ opacity: still ? 1 : 0.65, y: still ? 0 : 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={transition}
                  >
                    <div className="auth-success">
                      <motion.div
                        className="auth-success-icon"
                        initial={{ scale: still ? 1 : 0.7 }}
                        animate={{ scale: 1 }}
                        transition={still ? { duration: 0 } : spring.control}
                      >
                        <svg
                          viewBox="0 0 40 40"
                          width={40}
                          height={40}
                          fill="none"
                          aria-hidden="true"
                        >
                          <motion.path
                            d="m10 20 7 7 14-14"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: still ? 1 : 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{
                              duration: still ? 0 : 0.5,
                              delay: still ? 0 : 0.15,
                            }}
                          />
                        </svg>
                      </motion.div>
                      <h2
                        id={id + '-success-heading'}
                        ref={successHeading}
                        tabIndex={-1}
                      >
                        {t('Demande envoyée.')}
                      </h2>
                      <p>
                        {t(
                          'Votre compte est en attente d’approbation. Vous pourrez ensuite vous connecter avec vos identifiants.',
                        )}
                      </p>
                      <div className="auth-success-status">
                        <Check size={14} aria-hidden="true" />
                        {t('Inscription enregistrée')}
                      </div>
                      <motion.button
                        type="button"
                        className="auth-google glass-control"
                        whileHover={still ? undefined : { y: -2 }}
                        whileTap={still ? undefined : { scale: scale.pressed }}
                        onClick={() => {
                          setRegistered(false)
                          changeMode(false)
                          requestAnimationFrame(() =>
                            document.getElementById(id + '-username')?.focus(),
                          )
                        }}
                      >
                        {t('Revenir à la connexion')}
                        <ArrowRight size={16} aria-hidden="true" />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.section>
        </SpotlightCard>
      </StarBorder>
    </LayoutGroup>
  )
}
