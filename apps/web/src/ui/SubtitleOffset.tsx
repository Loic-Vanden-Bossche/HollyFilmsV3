import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { motion, useIsPresent } from 'motion/react'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import {
  AudioLines,
  Captions,
  Check,
  ChevronDown,
  LifeBuoy,
  RotateCcw,
  SlidersHorizontal,
  Waves,
  X,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider.tsx'
import type { Message } from '../i18n/messages.ts'
import {
  correctedTime,
  matchCue,
  nudge,
  originalTiming,
  preciseStepMs,
  quickStepMs,
  type Correction,
  type SourceCue,
  type SyncJob,
  type SyncFailure,
  type SyncSnapshot,
} from '@hollyfilms/shared/subtitle-sync'
import type { TimingService } from '../playback/subtitle-sync.ts'
import {
  SubtitleReplay,
  type ReplayState,
} from '../playback/subtitle-replay.ts'
import { formatTime } from '../playback/format-time.ts'
import './subtitle-sync.css'

const stages: Record<SyncJob['stage'], Message> = {
  queued: 'Analyse en attente',
  preparing: 'Préparation des pistes',
  analyzing: 'Détection des dialogues',
  aligning: 'Alignement des répliques',
  validating: 'Vérification sur plusieurs passages',
  ready: 'Proposition disponible',
  failed: 'L’analyse a échoué. Vous pouvez réessayer.',
  cancelled: 'Analyse annulée',
  'possible-cut':
    'Le décalage change entre les passages. La piste correspond peut-être à un autre montage.',
  uncertain:
    'Les dialogues ne donnent pas de correspondance assez nette. Essayez le réglage sur une réplique.',
}
const failureMessages: Record<SyncFailure, Message> = {
  source:
    'Le serveur média n’a pas pu fournir le fichier. Vérifiez son accès, puis réessayez.',
  audio:
    'La piste audio sélectionnée est introuvable dans cette version. Choisissez une autre piste audio.',
  decode:
    'Impossible de décoder cette piste audio. Essayez une autre piste ou le réglage manuel.',
  subtitle:
    'Le texte des sous-titres est illisible. Choisissez une autre piste.',
  engine:
    'Le moteur de synchronisation s’est arrêté. Réessayez ou utilisez le réglage manuel.',
  timeout:
    'L’analyse a dépassé le temps autorisé. Vous pouvez réessayer ou régler le décalage manuellement.',
  interrupted: 'L’analyse a été interrompue. Relancez-la pour reprendre.',
  internal: stages.failed,
}
const working = (j: SyncJob | null) =>
  j &&
  ['queued', 'preparing', 'analyzing', 'aligning', 'validating'].includes(
    j.stage,
  )
function HoldButton({
  children,
  action,
}: {
  children: string
  action: () => void
}) {
  const latest = useRef(action)
  useLayoutEffect(() => {
    latest.current = action
  }, [action])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const repeated = useRef(false)
  const stop = () => {
    clearTimeout(timer.current)
    timer.current = undefined
  }
  function start() {
    stop()
    repeated.current = false
    const tick = () => {
      repeated.current = true
      latest.current()
      timer.current = setTimeout(tick, 150)
    }
    timer.current = setTimeout(tick, 450)
  }
  useEffect(() => {
    window.addEventListener('blur', stop)
    return () => {
      stop()
      window.removeEventListener('blur', stop)
    }
  }, [])
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        start()
      }}
      onKeyDown={(event) => {
        if (![' ', 'Enter'].includes(event.key)) return
        event.preventDefault()
        if (!event.repeat) start()
      }}
      onKeyUp={(event) => {
        if (![' ', 'Enter'].includes(event.key)) return
        event.preventDefault()
        if (timer.current !== undefined && !repeated.current) latest.current()
        stop()
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onBlur={stop}
      onClick={() => {
        if (!repeated.current) latest.current()
        repeated.current = false
      }}
    >
      {children}
    </button>
  )
}
type Step = 'quick' | 'choose' | 'listen' | 'verify' | 'help' | 'saved'
export function SubtitleOffset({
  value,
  onChange,
  onClose,
  onTracks,
  video,
  origin,
  cues,
  canReplay,
  service,
  initial,
  trackLabel,
}: {
  value: Correction
  onChange: (value: Correction) => void
  onClose: () => void
  onTracks: () => void
  video: HTMLVideoElement | null
  origin: number
  cues?: SourceCue[]
  canReplay: boolean
  service: TimingService
  initial?: SyncSnapshot
  trackLabel: string
}) {
  const { t, locale } = useI18n()
  const reduced = usePerformanceReducedMotion()
  const present = useIsPresent()
  const preciseId = useId()
  const panel = useRef<HTMLElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const captureButton = useRef<HTMLButtonElement>(null)
  const serviceRef = useRef(service)
  useLayoutEffect(() => {
    serviceRef.current = service
  }, [service])
  const [baseline, setBaseline] = useState(initial)
  const [step, setStep] = useState<Step>('quick')
  const [precise, setPrecise] = useState(false)
  const [needle, setNeedle] = useState('')
  const [page, setPage] = useState(0)
  const [chosen, setChosen] = useState<SourceCue>()
  const [replayState, setReplayState] = useState<ReplayState>('idle')
  const replay = useRef<SubtitleReplay | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const writing = useRef(false)
  const [message, setMessage] = useState<Message>()
  const [job, setJob] = useState<SyncJob | null>(initial?.job ?? null)
  const [starting, setStarting] = useState(false)
  const [revision, setRevision] = useState(0)
  const [jobRevision, setJobRevision] = useState(0)
  const lifetime = useRef<AbortController | undefined>(undefined)
  const sequence = useRef(0)
  const editValue = useRef(value)
  useLayoutEffect(() => {
    editValue.current = value
  }, [value])
  const attempt = useRef(value)
  const mounted = useRef(false)
  const cancel = onClose
  useEffect(() => {
    if (!present) return
    mounted.current = true
    const life = new AbortController()
    lifetime.current = life
    closeButton.current?.focus({ preventScroll: true })
    return () => {
      mounted.current = false
      life.abort()
    }
  }, [present])
  useEffect(() => {
    if (!present || !video || !canReplay) return
    const controller = new SubtitleReplay(video, origin, setReplayState)
    replay.current = controller
    return () => {
      controller.dispose()
      replay.current = undefined
    }
  }, [present, video, origin, canReplay])
  useEffect(() => {
    if (replayState === 'listening' && step === 'listen')
      captureButton.current?.focus({ preventScroll: true })
  }, [replayState, step])
  const back = () => {
    if (writing.current) return
    if (step === 'quick' || step === 'saved') cancel()
    else {
      if (step === 'listen') replay.current?.pause()
      else replay.current?.disarm()
      setStep(step === 'listen' ? 'choose' : 'quick')
    }
  }
  const backRef = useRef(back)
  useLayoutEffect(() => {
    backRef.current = back
  })
  useEffect(() => {
    if (!present) return
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        backRef.current()
      }
    }
    const dialog = panel.current?.closest('dialog')
    const cancelled = (e: Event) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      backRef.current()
    }
    document.addEventListener('keydown', escape, true)
    dialog?.addEventListener('cancel', cancelled, true)
    return () => {
      document.removeEventListener('keydown', escape, true)
      dialog?.removeEventListener('cancel', cancelled, true)
    }
  }, [present])
  const pending = !!working(job)
  const jobId = job?.id
  useEffect(() => {
    if (!present || !jobId || !pending) return
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const next = await serviceRef.current.status(jobId, abort.signal)
        if (abort.signal.aborted) return
        setJob(next)
        setMessage((current) =>
          current === 'Statut indisponible. Réessayez dans un instant.'
            ? undefined
            : current,
        )
        if (working(next)) timer = setTimeout(() => void poll(), 2500)
      } catch (error) {
        if (!abort.signal.aborted) {
          setMessage('Statut indisponible. Réessayez dans un instant.')
          if (
            error instanceof Error &&
            ['401', '403', '404'].includes(error.message)
          )
            setJob(null)
          else timer = setTimeout(() => void poll(), 5000)
        }
      }
    }
    timer = setTimeout(() => void poll(), 1500)
    return () => {
      abort.abort()
      clearTimeout(timer)
    }
  }, [present, jobId, pending])
  function edit(next: Correction) {
    if (writing.current) return
    setRevision((v) => v + 1)
    editValue.current = next
    onChange(next)
    setMessage(undefined)
  }
  async function startJob() {
    const snap = baseline,
      signal = lifetime.current?.signal
    if (!snap || !signal || starting) return
    const seq = ++sequence.current
    setJobRevision(revision)
    setMessage(undefined)
    setStarting(true)
    try {
      const next = await serviceRef.current.job(
        snap.fingerprint,
        signal,
        step === 'help',
        revision,
      )
      if (!signal.aborted && seq === sequence.current) setJob(next)
    } catch (error) {
      if (!signal.aborted)
        setMessage(
          error instanceof Error && error.message === '429'
            ? 'Le service d’analyse est occupé. Réessayez dans un instant.'
            : error instanceof Error && error.message === '409'
              ? 'Le réglage a changé. Rouvrez le panneau pour charger la dernière version.'
              : 'Analyse indisponible. Le réglage manuel reste accessible.',
        )
    } finally {
      if (!signal.aborted) setStarting(false)
    }
  }
  async function save() {
    if (writing.current) return
    writing.current = true
    setSaving(true)
    setMessage(undefined)
    try {
      const snapshot = baseline
      if (!snapshot) {
        const refreshed = await serviceRef.current.retry()
        if (!refreshed.data) throw Error('unavailable')
        if (mounted.current) {
          setBaseline(refreshed.data)
          setMessage('Vérifiez le réglage puis validez à nouveau.')
        }
        return
      }
      await serviceRef.current.save(snapshot, editValue.current)
      if (mounted.current) {
        replay.current?.dispose()
        setStep('saved')
      }
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error && error.message === '409'
            ? 'Le réglage a changé. Rouvrez le panneau pour charger la dernière version.'
            : 'Enregistrement impossible. Votre essai est conservé.',
        )
    } finally {
      writing.current = false
      if (mounted.current) setSaving(false)
    }
  }
  function choose() {
    attempt.current = editValue.current
    replay.current?.pause()
    setNeedle('')
    setChosen(undefined)
    const anchor = replay.current?.reference() ?? 0
    let nearest = 0
    for (let i = 1; i < (cues?.length ?? 0); i++)
      if (
        Math.abs(correctedTime(cues![i].startMs, value) - anchor) <
        Math.abs(correctedTime(cues![nearest].startMs, value) - anchor)
      )
        nearest = i
    setPage(Math.floor(nearest / 4))
    setStep('choose')
  }
  const matches = useMemo(() => {
    const searchable = (text: string) =>
      text.normalize().replace(/\s+/gu, ' ').trim().toLocaleLowerCase(locale)
    const q = searchable(needle)
    return q ? cues?.filter((c) => searchable(c.text).includes(q)) : cues
  }, [needle, cues, locale])
  const delta = (n: number) => edit(nudge(editValue.current, n))
  const seconds = Math.abs(value.manualMs / 1000).toLocaleString(locale, {
    maximumFractionDigits: 3,
  })
  const feedback =
    value.manualMs === 0
      ? t('Aucun décalage ajouté')
      : t(
          value.manualMs > 0
            ? 'Affichage {value} s plus tard'
            : 'Affichage {value} s plus tôt',
          { value: seconds },
        )
  const moved = replayState === 'moved'
  return (
    <motion.section
      ref={panel}
      aria-label={t('Corriger la synchronisation')}
      className="subtitle-sync"
      data-reduced={reduced}
      inert={!present}
      initial={{ opacity: 0, y: reduced ? 0 : -12, scale: reduced ? 1 : 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: reduced ? 0 : -8,
        scale: reduced ? 1 : 0.985,
        transition: { duration: reduced ? 0 : 0.15, ease: 'easeIn' },
      }}
      transition={{ duration: reduced ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header>
        <span className="sync-heading-icon">
          <Captions size={20} />
        </span>
        <div>
          <small>{trackLabel}</small>
          <h2>{t('Corriger la synchronisation')}</h2>
        </div>
        <button
          ref={closeButton}
          aria-label={t('Fermer')}
          disabled={saving}
          onClick={cancel}
        >
          <X size={18} />
        </button>
        <motion.span
          aria-hidden="true"
          className="sync-heading-line"
          initial={{ scaleX: reduced ? 1 : 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduced ? 0 : 0.38, ease: 'easeOut' }}
        />
      </header>
      {step === 'saved' ? (
        <motion.div
          className="sync-saved"
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <Check size={18} /> {t('Réglage mémorisé pour ce film')}
          <button onClick={onClose}>{t('Fermer')}</button>
        </motion.div>
      ) : (
        <motion.fieldset
          key={step}
          disabled={saving}
          initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
        >
          {(step === 'quick' || step === 'help') && (
            <>
              {(baseline?.canAnalyze || job) && (
                <div className="sync-analysis">
                  {!pending && baseline?.canAnalyze && (
                    <button
                      className="sync-accent"
                      disabled={starting}
                      onClick={() => void startJob()}
                    >
                      <Waves size={16} />
                      {t('Synchroniser automatiquement')}
                    </button>
                  )}
                  {job?.stage === 'failed' ? (
                    <div className="sync-failure" role="alert">
                      <strong>
                        {t(
                          job.failure
                            ? failureMessages[job.failure]
                            : stages.failed,
                        )}
                      </strong>
                      <small>
                        {t('Référence de l’analyse')} <code>{job.id}</code>
                      </small>
                    </div>
                  ) : (
                    job && (
                      <p role="status">
                        {t(stages[job.stage])}
                        {job.stage === 'analyzing' &&
                          !!job.processedSeconds &&
                          ' · ' + formatTime(job.processedSeconds)}
                      </p>
                    )
                  )}
                  {pending && (
                    <button
                      onClick={async () => {
                        if (!job) return
                        const seq = ++sequence.current
                        try {
                          const next = await service.cancel(job.id)
                          if (mounted.current && seq === sequence.current)
                            setJob(next)
                        } catch {
                          if (mounted.current)
                            setMessage(
                              'Statut indisponible. Réessayez dans un instant.',
                            )
                        }
                      }}
                    >
                      {t('Annuler l’analyse')}
                    </button>
                  )}
                  {job?.alignment && (
                    <p>
                      {job.alignment.scale === 1
                        ? t('Décalage constant estimé')
                        : t('Correction de cadence estimée · ×{rate}', {
                            rate: job.alignment.scale.toLocaleString(locale, {
                              maximumFractionDigits: 5,
                            }),
                          })}
                    </p>
                  )}
                  {job?.alignment && jobRevision === revision && (
                    <button
                      onClick={() => {
                        edit({ automatic: job.alignment!, manualMs: 0 })
                        setStep('quick')
                      }}
                    >
                      {t('Essayer cette proposition')}
                    </button>
                  )}
                </div>
              )}
              {step === 'help' && (
                <>
                  <p>
                    {t(
                      'Une cadence différente peut se corriger sur le film entier. Si le montage change, essayez une autre piste dans le menu des sous-titres.',
                    )}
                  </p>
                  <button onClick={onTracks}>
                    {t('Choisir une autre piste')}
                  </button>
                  <button onClick={() => setStep('quick')}>
                    {t('Retour')}
                  </button>
                </>
              )}
            </>
          )}
          {(step === 'quick' || step === 'verify') && (
            <>
              <p>{t('Les sous-titres apparaissent…')}</p>
              <div className="sync-pair">
                <HoldButton action={() => delta(quickStepMs)}>
                  {t(step === 'verify' ? 'Encore trop tôt' : 'Trop tôt')}
                </HoldButton>
                <HoldButton action={() => delta(-quickStepMs)}>
                  {t(step === 'verify' ? 'Encore trop tard' : 'Trop tard')}
                </HoldButton>
              </div>
              <output
                className="sync-feedback"
                aria-live="polite"
                aria-atomic="true"
              >
                <AudioLines size={16} aria-hidden="true" />
                <motion.span
                  key={value.manualMs}
                  initial={{ y: reduced ? 0 : 3 }}
                  animate={{ y: 0 }}
                  transition={{ duration: reduced ? 0 : 0.14, ease: 'easeOut' }}
                >
                  {value.automatic && t('Après correction automatique') + ' · '}
                  {feedback}
                </motion.span>
              </output>
              {canReplay && (
                <button
                  disabled={moved}
                  onClick={() => replay.current?.replay()}
                >
                  <RotateCcw size={14} />
                  {t(
                    step === 'verify'
                      ? 'Rejouer pour vérifier'
                      : 'Rejouer le passage',
                  )}
                </button>
              )}
              {canReplay && !!cues?.length && (
                <button
                  onClick={() => {
                    if (step === 'verify') {
                      edit(attempt.current)
                      setStep('choose')
                      replay.current?.pause()
                    } else choose()
                  }}
                >
                  {t(
                    step === 'verify'
                      ? 'Recommencer'
                      : 'Recaler sur une réplique',
                  )}
                </button>
              )}
              <div className="sync-precision">
                <button
                  type="button"
                  className="sync-disclosure"
                  aria-expanded={precise}
                  aria-controls={preciseId}
                  onClick={() => setPrecise(!precise)}
                >
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  <span>{t('Réglage précis')}</span>
                  <motion.span
                    className="sync-chevron"
                    aria-hidden="true"
                    initial={false}
                    animate={{ rotate: precise ? 180 : 0 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                  >
                    <ChevronDown size={16} />
                  </motion.span>
                </button>
                <motion.div
                  className="sync-fold"
                  id={preciseId}
                  inert={!precise}
                  aria-hidden={!precise}
                  initial={false}
                  animate={{
                    height: precise ? 'auto' : 0,
                    opacity: precise ? 1 : 0,
                  }}
                  transition={{
                    duration: reduced ? 0 : 0.22,
                    ease: [0.22, 0.75, 0.25, 1],
                  }}
                >
                  <div className="sync-fine-actions">
                    <div className="sync-pair">
                      <HoldButton action={() => delta(preciseStepMs)}>
                        {t('Trop tôt · 0,1 s')}
                      </HoldButton>
                      <HoldButton action={() => delta(-preciseStepMs)}>
                        {t('Trop tard · 0,1 s')}
                      </HoldButton>
                    </div>
                    <div className="sync-secondary-actions">
                      <button onClick={() => edit(originalTiming)}>
                        <RotateCcw size={15} aria-hidden="true" />
                        {t('Réinitialiser')}
                      </button>
                      <button onClick={() => setStep('help')}>
                        <LifeBuoy size={15} aria-hidden="true" />
                        {t('Ça se décale à nouveau')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
          {step === 'choose' && (
            <>
              <p>{t('Choisis une réplique que tu viens d’entendre.')}</p>
              <input
                type="search"
                value={needle}
                aria-label={t('Rechercher une réplique')}
                placeholder={t('Rechercher une réplique')}
                onChange={(e) => {
                  setNeedle(e.target.value)
                  setPage(0)
                }}
              />
              <div className="sync-cues">
                {matches?.slice(page * 4, page * 4 + 4).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setChosen(c)
                      setStep('listen')
                    }}
                  >
                    <time>{formatTime(c.startMs / 1000)}</time>
                    <span dir="auto">{c.text}</span>
                  </button>
                ))}
              </div>
              {!matches?.length && <p>{t('Aucune réplique trouvée')}</p>}
              <div className="sync-pair">
                <button disabled={!page} onClick={() => setPage(page - 1)}>
                  {t('Précédentes')}
                </button>
                <button
                  disabled={(page + 1) * 4 >= (matches?.length ?? 0)}
                  onClick={() => setPage(page + 1)}
                >
                  {t('Suivantes')}
                </button>
              </div>
              <button onClick={back}>{t('Retour')}</button>
            </>
          )}
          {step === 'listen' && chosen && (
            <>
              <blockquote dir="auto">{chosen.text}</blockquote>
              <p>{t('Appuie dès que cette réplique commence.')}</p>
              <button disabled={moved} onClick={() => replay.current?.replay()}>
                {t('Écouter le passage')}
              </button>
              <button
                className="sync-accent"
                ref={captureButton}
                disabled={replayState !== 'listening'}
                onKeyDown={(e) => {
                  if (e.repeat) e.preventDefault()
                }}
                onClick={() => {
                  const heard = replay.current?.capture()
                  if (heard === undefined) return
                  edit(matchCue(editValue.current, chosen.startMs, heard))
                  setStep('verify')
                }}
              >
                {t('C’est maintenant')}
              </button>
              <button onClick={back}>{t('Retour')}</button>
            </>
          )}
          {moved && (
            <button onClick={() => replay.current?.newReference()}>
              {t('Utiliser ce nouveau passage')}
            </button>
          )}
          {replayState === 'failed' && (
            <p role="status">
              {t('Ce passage ne peut pas encore être rejoué.')}
            </p>
          )}
          {!baseline && !service.loading && (
            <p role="status">
              {t(
                'Aperçu disponible. La sauvegarde nécessite une piste audio identifiée et une connexion au serveur.',
              )}
            </p>
          )}
          {message && <p role="alert">{t(message)}</p>}
          <footer>
            <button onClick={onClose}>{t('Annuler')}</button>
            {(step === 'quick' || step === 'verify') && (
              <button
                className="sync-accent"
                disabled={service.loading}
                onClick={() => void save()}
              >
                {t(saving ? 'Enregistrement…' : 'C’est bon')}
              </button>
            )}
          </footer>
        </motion.fieldset>
      )}
    </motion.section>
  )
}
