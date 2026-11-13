import { useI18n } from '../i18n/I18nProvider.tsx'
import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { MediaTile } from './MediaTile.tsx'
import { cinemaMotion } from '../components/reactbits/policy.ts'

// Inside each mounted virtual row, defer the expensive artwork/gesture/control
// tree until near the viewport (or keyboard focus), preserving its layout slot.
export const DeferredMediaTile = memo(function DeferredMediaTile({
  order = 0,
  ...props
}: Omit<ComponentProps<typeof MediaTile>, 'wide'> & { order?: number }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const near = useInView(ref, { once: true, margin: '240px' })
  const reduced = useReducedMotion()
  const [focused, setFocused] = useState(false)
  const restoreFocus = useRef(false)
  const ready = near || focused
  useLayoutEffect(() => {
    if (ready && restoreFocus.current) {
      restoreFocus.current = false
      ref.current
        ?.querySelector<HTMLButtonElement>('.media-tile-select')
        ?.focus({ preventScroll: true })
    }
  }, [ready])
  return (
    <motion.div
      ref={ref}
      className="deferred-media-tile"
      initial={false}
      animate={{
        opacity: ready ? 1 : 0.6,
        transform: !ready && !reduced ? 'translateY(16px)' : 'translateY(0px)',
      }}
      transition={{
        duration: reduced ? 0 : 0.4,
        delay: reduced || focused ? 0 : (order % 6) * 0.025,
        ease: cinemaMotion.ease,
      }}
    >
      {ready ? (
        <MediaTile {...props} />
      ) : (
        <button
          type="button"
          className="media-tile-placeholder"
          aria-label={
            t('Voir la fiche de {title}', { title: props.item.title }) +
            (props.item.episode ? ', ' + props.item.episode : '')
          }
          onFocus={() => {
            restoreFocus.current = true
            setFocused(true)
          }}
          onClick={() => props.onSelect(props.item)}
        >
          <span>{props.item.title}</span>
        </button>
      )}
    </motion.div>
  )
})
