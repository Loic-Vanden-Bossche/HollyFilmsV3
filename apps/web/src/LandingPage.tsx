import { useI18n } from './i18n/I18nProvider.tsx'
import { Tooltip } from './ui/Tooltip.tsx'
import { useRef, useState, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useTransform,
  useMotionValueEvent,
} from 'motion/react'
import type { MotionValue } from 'motion/react'
import { CatalogueGallery } from './ui/CatalogueGallery.tsx'
import {
  ArrowUpRight,
  Captions,
  Film,
  ListVideo,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { AuthOptions } from '@hollyfilms/shared/accounts'
import type { ShowcaseItem } from '@hollyfilms/shared/showcase'
import { LoginForm } from './LoginForm.tsx'
import googleLogo from './assets/logos/google-gradient-96.png'
import { LanguageSelect } from './ui/LanguageSelect.tsx'
import { Wordmark } from './ui/Wordmark.tsx'
import { ProjectorBackdrop } from './ui/ProjectorBackdrop.tsx'
import { useLandingMotion } from './use-landing-motion.ts'
import { useModalPresence } from './ui/use-modal-presence.ts'
import { duration, ease, scale, distance } from './motion/tokens.ts'
import {
  RotatingText,
  ShinyText,
  BlurText,
  Magnet,
  StarBorder,
} from './components/reactbits/Effects.tsx'
import { MotionEnvironment } from './components/reactbits/MotionEnvironment.tsx'
import './landing.css'

const features = [
  {
    icon: RotateCcw,
    title: 'Reprenez où vous en étiez.',
    detail: 'Votre progression de lecture est enregistrée.',
    label: 'Reprise de lecture',
  },
  {
    icon: Captions,
    title: 'VO, VF. À vous de choisir.',
    detail: 'Pistes audio et sous-titres disponibles dans vos fichiers.',
    label: 'Audio & sous-titres',
  },
  {
    icon: ListVideo,
    title: 'Gardez le fil de vos séries.',
    detail: 'Épisodes vus et prochains épisodes au même endroit.',
    label: 'Suivi des épisodes',
  },
  {
    icon: Film,
    title: 'Toute votre bibliothèque.',
    detail: 'Films et séries réunis, organisés et accessibles.',
    label: 'Films & séries',
  },
] as const

type Props = {
  items: ShowcaseItem[]
  catalogueState: 'loading' | 'ready' | 'error'
  options?: AuthOptions
  notice?: string
  completingGoogle?: boolean
  authenticated?: boolean
  initialAuth?: 'login' | null
  onSignIn: (username: string, password: string) => Promise<void>
}

export function LandingPage({
  items,
  catalogueState,
  options,
  notice,
  completingGoogle,
  authenticated,
  initialAuth = null,
  onSignIn,
}: Props) {
  const { t } = useI18n()
  const [paused, setPaused] = useState(false)
  const [auth, setAuth] = useState<'login' | 'register' | null>(
    notice || completingGoogle ? 'login' : initialAuth,
  )
  const [previousNotice, setPreviousNotice] = useState(notice)
  const { scope, clock, stopped, reduced } = useLandingMotion(
    paused,
    Boolean(auth),
  )
  const [featureIndex, setFeatureIndex] = useState(0)
  useMotionValueEvent(clock, 'change', (time) => {
    const next = Math.floor(time / 6) % features.length
    if (next !== featureIndex) setFeatureIndex(next)
  })
  if (notice !== previousNotice) {
    setPreviousNotice(notice)
    if (notice) setAuth('login')
  }

  return (
    <MotionEnvironment paused={paused}>
      <div ref={scope} className="showcase" data-still={stopped}>
        <MotionEnvironment paused={Boolean(auth)}>
          <a className="skip-link" href="#main">
            {t('Aller au contenu')}
          </a>
          <div className="cinema-atmosphere" aria-hidden="true">
            <ProjectorBackdrop paused={stopped} enabled={!reduced} />
          </div>

          <header className="showcase-nav">
            <a
              href="/"
              className="showcase-logo"
              aria-label={t('HollyFilms, accueil')}
            >
              <Wordmark compact />
            </a>
            <div className="showcase-nav-actions">
              <LanguageSelect compact />
              {authenticated ? (
                <a className="nav-signin glass-control" href="/app">
                  {t('Mon espace')} <ArrowUpRight size={16} />
                </a>
              ) : (
                <button
                  className="nav-signin glass-control"
                  onClick={() => setAuth('login')}
                >
                  {t('Se connecter')} <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          </header>

          <main id="main" className="cinema-stage" tabIndex={-1}>
            <section className="hero-copy" aria-labelledby="hero-title">
              <p className="eyebrow">
                <span className="eyebrow-line" />{' '}
                {t('VOTRE BIBLIOTHÈQUE, AU MÊME ENDROIT.')}
              </p>
              <h1
                id="hero-title"
                aria-label={t('HollyFilms 3.0 — Films et séries')}
              >
                <span className="title-mask">
                  <span className="title-line title-brand font-logo">
                    HollyFilms{' '}
                    <span className="release-version">
                      <ShinyText>3.0</ShinyText>
                    </span>
                  </span>
                </span>
                <span className="title-mask">
                  <span className="title-line title-accent">
                    <BlurText
                      text={t('Films & séries.')}
                      delay={duration.stagger * 2}
                    />
                  </span>
                </span>
              </h1>
              <div
                className="feature-reel"
                aria-label={t('Fonctionnalités HollyFilms')}
              >
                <div aria-hidden="true">
                  <RotatingText
                    index={featureIndex}
                    items={features.map(({ icon: Icon, title, detail }) => (
                      <div className="feature-slide" key={title}>
                        <span className="feature-symbol">
                          <Icon size={21} />
                        </span>
                        <div>
                          <p className="feature-title">{t(title)}</p>
                          <p className="feature-detail">{t(detail)}</p>
                        </div>
                      </div>
                    ))}
                  />
                </div>
                <ul className="sr-only">
                  {features.map(({ title, detail }) => (
                    <li key={title}>
                      {t(title)} {t(detail)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="feature-progress" aria-hidden="true">
                {features.map(({ label }, index) => (
                  <FeatureProgress key={label} clock={clock} index={index} />
                ))}
              </div>
              <div className="hero-actions">
                {authenticated ? (
                  <a className="cinema-cta" href="/app">
                    {t('Ouvrir HollyFilms')} <ArrowUpRight size={18} />
                  </a>
                ) : (
                  <>
                    <StarBorder className="landing-action-border">
                      <button
                        className="cinema-cta"
                        onClick={() => setAuth('register')}
                      >
                        <Magnet>
                          {t('Créer un compte')} <ArrowUpRight size={18} />
                        </Magnet>
                      </button>
                    </StarBorder>
                    {options?.googleStartUrl && (
                      <a
                        className="google-entry glass-control"
                        href={options.googleStartUrl}
                      >
                        <img
                          src={googleLogo}
                          alt=""
                          width={18}
                          height={18}
                          className="shrink-0"
                        />
                        {t('Continuer avec Google')}
                      </a>
                    )}
                  </>
                )}
              </div>
              <p className="access-note">
                <ShieldCheck size={14} />{' '}
                {t('Accès après approbation d’un administrateur.')}
              </p>
            </section>

            <section
              className="catalogue-stage"
              aria-labelledby="catalogue-heading"
            >
              <div className="catalogue-label glass-control">
                <span className="live-dot" />
                <h2 id="catalogue-heading">{t('Au catalogue')}</h2>
                <span className="catalogue-label-detail">
                  {t('FILMS & SÉRIES')}
                </span>
              </div>
              <CatalogueGallery
                items={items}
                stopped={stopped}
                state={catalogueState}
              />
              <div className="catalogue-note">
                <span className="catalogue-note-line" />
                <span>{t('Aperçu du catalogue')}</span>
                <span className="catalogue-note-line" />
              </div>
            </section>
          </main>

          <footer className="showcase-footer">
            <span className="footer-access">
              <ShieldCheck size={13} /> {t('Lecture réservée aux membres')}
            </span>
            <button
              className="animation-toggle"
              onClick={() => setPaused(!paused)}
              aria-pressed={paused}
              aria-label={
                paused
                  ? t('Reprendre les animations')
                  : t('Mettre les animations en pause')
              }
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
              <span>{paused ? t('Reprendre') : t('Pause')}</span>
            </button>
          </footer>
        </MotionEnvironment>

        <AnimatePresence>
          {auth && (
            <AuthDialog
              key={auth}
              still={reduced || paused}
              onClose={() => setAuth(null)}
            >
              {completingGoogle ? (
                <p role="status" className="p-10">
                  {t('Connexion Google en cours…')}
                </p>
              ) : (
                <LoginForm
                  key={auth}
                  initialMode={auth}
                  animationsPaused={paused}
                  notice={notice}
                  options={options}
                  onSignIn={onSignIn}
                />
              )}
            </AuthDialog>
          )}
        </AnimatePresence>
      </div>
    </MotionEnvironment>
  )
}

function AuthDialog({
  still,
  onClose,
  children,
}: {
  still: boolean
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const { dialog, surface, present } = useModalPresence()
  const pressedBackdrop = useRef(false)
  return (
    <motion.dialog
      ref={dialog}
      className="auth-dialog"
      aria-label={t('Connexion et inscription à HollyFilms')}
      inert={!present}
      aria-hidden={!present}
      data-exiting={!present || undefined}
      initial={still ? false : { opacity: 0.25 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: still ? 0 : duration.micro }}
      onPointerDown={(event) => {
        pressedBackdrop.current =
          event.button === 0 && event.target === event.currentTarget
      }}
      onPointerCancel={() => {
        pressedBackdrop.current = false
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget)
          onClose()
        pressedBackdrop.current = false
      }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <motion.section
        ref={surface}
        className="auth-surface glass-panel"
        initial={still ? false : { scale: scale.pressed, y: distance.panel }}
        animate={{ scale: 1, y: 0 }}
        exit={still ? {} : { scale: scale.pressed, y: distance.panel }}
        transition={{ duration: still ? 0 : duration.panel, ease: ease.out }}
      >
        <Tooltip>
          <button
            className="close-dialog"
            aria-label={t('Fermer')}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </Tooltip>
        {children}
      </motion.section>
    </motion.dialog>
  )
}

function FeatureProgress({
  clock,
  index,
}: {
  clock: MotionValue<number>
  index: number
}) {
  const progress = useTransform(clock, (time) =>
    Math.max(0, Math.min(1, ((time % 24) - index * 6) / 6)),
  )
  return (
    <span>
      <motion.i style={{ scaleX: progress }} />
    </span>
  )
}
