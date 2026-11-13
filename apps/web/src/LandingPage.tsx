import { useI18n } from './i18n/I18nProvider.tsx'
import { Tooltip } from './ui/Tooltip.tsx'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import {
  AnimatePresence,
  motion,
  useAnimate,
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
import googleLogo from './assets/logos/google-gradient.png'
import { LanguageSelect } from './ui/LanguageSelect.tsx'
import { Wordmark } from './ui/Wordmark.tsx'
import { ProjectorBackdrop } from './ui/ProjectorBackdrop.tsx'
import { useLandingMotion } from './use-landing-motion.ts'
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
  const [dialog, animateDialog] = useAnimate<HTMLDialogElement>()
  const closing = useRef(false)
  const pressedBackdrop = useRef(false)
  const [dialogClosing, setDialogClosing] = useState(false)
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
  useEffect(() => {
    const element = dialog.current
    if (!element || !auth) return
    element.showModal()
    const animation = animateDialog(
      element,
      {
        opacity: [0, 1],
        y: [reduced || paused ? 0 : 18, 0],
        scale: [reduced || paused ? 1 : 0.97, 1],
      },
      { duration: reduced || paused ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] },
    )
    return () => animation.stop()
  }, [auth, animateDialog, dialog, reduced, paused])

  async function closeAuth() {
    if (closing.current || !dialog.current?.open) return
    closing.current = true
    setDialogClosing(true)
    await animateDialog(
      dialog.current,
      {
        opacity: 0,
        y: reduced || paused ? 0 : 10,
        scale: reduced || paused ? 1 : 0.98,
      },
      { duration: reduced || paused ? 0 : 0.18, ease: 'easeIn' },
    )
    dialog.current?.close()
    setAuth(null)
    setDialogClosing(false)
    closing.current = false
  }

  return (
    <MotionEnvironment paused={paused}>
      <div ref={scope} className="showcase" data-still={stopped}>
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
                  <BlurText text={t('Films & séries.')} delay={0.28} />
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
                      <svg
                        width={18}
                        height={18}
                        viewBox="940 940 940 940"
                        aria-hidden="true"
                        focusable="false"
                        className="shrink-0"
                      >
                        <image href={googleLogo} width={2820} height={2820} />
                      </svg>
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
              key={items.map((item) => item.id).join(',')}
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

        <AnimatePresence>
          {auth && !dialogClosing && (
            <motion.div
              className="auth-dimmer"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced || paused ? 0 : 0.2 }}
            />
          )}
        </AnimatePresence>
        <dialog
          ref={dialog}
          className="auth-dialog glass-panel"
          onPointerDown={(event) => {
            pressedBackdrop.current =
              event.button === 0 && isDialogBackdrop(event)
          }}
          onPointerCancel={() => {
            pressedBackdrop.current = false
          }}
          onClick={(event) => {
            const dismiss = pressedBackdrop.current && isDialogBackdrop(event)
            pressedBackdrop.current = false
            if (dismiss) void closeAuth()
          }}
          onCancel={(event) => {
            event.preventDefault()
            void closeAuth()
          }}
          onClose={() => {
            if (!dialog.current?.open) setAuth(null)
          }}
          aria-label={t('Connexion et inscription à HollyFilms')}
        >
          <Tooltip>
            <motion.button
              className="close-dialog"
              aria-label={t('Fermer')}
              onClick={() => void closeAuth()}
              whileHover={
                reduced || paused ? undefined : { rotate: 90, scale: 1.08 }
              }
              whileTap={reduced || paused ? undefined : { scale: 0.9 }}
            >
              <X size={21} />
            </motion.button>
          </Tooltip>
          {completingGoogle ? (
            <p role="status" className="p-10">
              {t('Connexion Google en cours…')}
            </p>
          ) : (
            auth && (
              <LoginForm
                key={auth}
                initialMode={auth}
                animationsPaused={paused}
                notice={notice}
                options={options}
                onSignIn={onSignIn}
              />
            )
          )}
        </dialog>
      </div>
    </MotionEnvironment>
  )
}

function isDialogBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false
  // Native dialogs also receive backdrop events; their border and padding stay inside.
  const bounds = event.currentTarget.getBoundingClientRect()
  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
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
