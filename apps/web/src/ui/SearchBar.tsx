import { usePerformanceReducedMotion as useReducedMotion } from '../performance/PerformanceProvider.tsx'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpLeft, Search, X } from 'lucide-react'
import { duration, ease } from '../motion/tokens.ts'
import { useMotionPolicy } from '../components/reactbits/policy.ts'
import './search-bar.css'

export function SearchBar({
  value,
  expanded,
  loading,
  onChange,
  onExpand,
  onClose,
  scopeLabel,
}: {
  value: string
  expanded: boolean
  loading: boolean
  onChange: (value: string) => void
  onExpand: () => void
  onClose: () => void
  scopeLabel?: string
}) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const restoring = useRef(false)
  const reduced = useReducedMotion()
  const { pageVisible } = useMotionPolicy()
  const close = () => {
    onClose()
    restoring.current = true
    input.current?.focus({ preventScroll: true })
    restoring.current = false
  }
  return (
    <motion.div
      className="home-search cinema-search"
      data-expanded={expanded}
      layout
      transition={{
        layout: { duration: reduced ? 0 : duration.panel, ease: ease.out },
      }}
    >
      <div className="cinema-search-glow" aria-hidden="true" />
      <AnimatePresence initial={false} mode="popLayout">
        {expanded && (
          <motion.div
            className="cinema-search-eyebrow"
            key="eyebrow"
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, delay: reduced ? 0 : 0.1 }}
          >
            <span>{t('VOTRE PROCHAINE SÉANCE')}</span>
            <span>{t('RECHERCHE')}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="cinema-search-field">
        <motion.span
          layout="position"
          className="cinema-search-icon"
          aria-hidden="true"
        >
          <Search />
        </motion.span>
        <motion.input
          layout="position"
          ref={input}
          type="search"
          autoComplete="off"
          spellCheck={false}
          aria-label={t('Rechercher dans le catalogue')}
          aria-controls={expanded ? 'home-search-results' : undefined}
          placeholder={
            expanded
              ? t('Quel titre cherchez-vous ?')
              : t('Un film, une série…')
          }
          value={value}
          onFocus={() => {
            if (!restoring.current) onExpand()
          }}
          onClick={() => {
            if (!expanded) onExpand()
          }}
          onChange={(event) => {
            if (!expanded) onExpand()
            onChange(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && expanded) {
              event.preventDefault()
              event.stopPropagation()
              close()
            }
            if (event.key === 'ArrowDown' && expanded) {
              const first = document.querySelector<HTMLButtonElement>(
                '#home-search-results .media-tile-select, #home-search-results .media-tile-placeholder',
              )
              if (first) {
                event.preventDefault()
                first.focus()
              }
            }
          }}
        />
        <AnimatePresence initial={false}>
          {value && (
            <Tooltip key="clear">
              <motion.button
                type="button"
                key="clear"
                aria-label={t('Effacer la recherche')}
                className="cinema-search-clear"
                initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  onChange('')
                  input.current?.focus()
                }}
              >
                <X size={18} />
              </motion.button>
            </Tooltip>
          )}
        </AnimatePresence>
        {expanded && (
          <Tooltip>
            <motion.button
              layout="position"
              className="cinema-search-close"
              type="button"
              onClick={close}
              aria-label={t('Fermer la recherche')}
            >
              <ArrowUpLeft size={18} />
              <span>{t('Fermer')}</span>
              <kbd>Esc</kbd>
            </motion.button>
          </Tooltip>
        )}
      </div>
      <AnimatePresence initial={false} mode="popLayout">
        {expanded && (
          <motion.div
            key="hint"
            className="cinema-search-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: reduced ? 0 : 0.18 }}
          >
            <span>
              {scopeLabel ?? t('Films & séries de votre bibliothèque')}
            </span>
            <span className="cinema-search-keyboard">
              {t('↓ pour explorer les résultats')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {expanded && (
        <motion.div
          className="cinema-search-line"
          aria-hidden="true"
          initial={{ scaleX: reduced ? 1 : 0 }}
          animate={{ scaleX: 1 }}
          transition={{
            duration: reduced ? 0 : duration.scene,
            ease: ease.out,
          }}
        >
          {loading && (
            <motion.i
              animate={
                reduced || !pageVisible ? { x: '0%' } : { x: ['-100%', '400%'] }
              }
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
