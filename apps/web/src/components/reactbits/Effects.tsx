// Application adaptations of React Bits. See SOURCES.md and ../react-bits.LICENSE.md.
import { useI18n } from '../../i18n/I18nProvider.tsx'
import { Children, useEffect, useId, useRef, type ReactNode } from 'react'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
import { cinemaMotion, useEffectActivity, useMotionPolicy } from './policy.ts'
import {
  duration,
  distance,
  staggerDelay,
  spring,
} from '../../motion/tokens.ts'
import './effects.css'

export function GradualBlur({
  position = 'bottom',
  size = '90px',
  strength = 10,
}: {
  position?: 'top' | 'bottom' | 'left' | 'right'
  size?: string
  strength?: number
}) {
  const vertical = position === 'top' || position === 'bottom'
  return (
    <div
      className="rb-gradual-blur"
      aria-hidden="true"
      style={{
        [position]: 0,
        ...(vertical
          ? { left: 0, right: 0, height: size }
          : { top: 0, bottom: 0, width: size }),
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            backdropFilter: `blur(${(strength * (2 ** (i + 1) - 1)) / 15}px)`,
            maskImage: `linear-gradient(to ${position}, transparent ${i * 25}%, black ${(i + 1) * 25}%)`,
          }}
        />
      ))}
    </div>
  )
}
export function BlurText({
  text,
  className = '',
  delay = 0,
}: {
  text: string
  className?: string
  delay?: number
}) {
  const { running } = useMotionPolicy()
  return (
    <span className={`rb-blur-text ${className}`}>
      <span className="sr-only">{text}</span>
      {text.split(' ').map((word, i) => (
        <motion.span
          aria-hidden="true"
          key={`${word}-${i}`}
          initial={running ? { opacity: 0.35, y: distance.panel } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: running ? cinemaMotion.reveal : 0,
            delay: running ? delay + staggerDelay(i) : 0,
            ease: cinemaMotion.ease,
          }}
        >
          {word}{' '}
        </motion.span>
      ))}
    </span>
  )
}
export function ShinyText({ children }: { children: ReactNode }) {
  const { running } = useMotionPolicy()
  return (
    <span className="rb-shiny-text" data-running={running}>
      {children}
      <span className="rb-shiny-highlight" aria-hidden="true">
        {children}
      </span>
    </span>
  )
}
export function RotatingText({
  items,
  index,
}: {
  items: ReactNode[]
  index: number
}) {
  const { running } = useMotionPolicy()
  return (
    <div className="rb-rotating-text">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={index}
          initial={{
            opacity: 0,
            y: running ? distance.panel : 0,
          }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: running ? -distance.panel : 0 }}
          transition={{
            duration: running ? duration.panel : 0,
            ease: cinemaMotion.ease,
          }}
        >
          {items[index % items.length]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
export function AnimatedContent({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const { ref, reduced, running } = useEffectActivity()
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? false : { opacity: 0.5, y: distance.panel }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '40px' }}
      transition={{
        duration: running ? duration.scene : duration.press,
        delay: running ? delay : 0,
        ease: cinemaMotion.ease,
      }}
    >
      {children}
    </motion.div>
  )
}
export function StarBorder({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const { ref, running } = useEffectActivity()
  return (
    <div
      ref={ref}
      className={`rb-star-border ${className}`}
      data-running={running}
    >
      {children}
      <span className="rb-star-orbit" aria-hidden="true" />
    </div>
  )
}
export function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const { ref, running, fine } = useEffectActivity()
  return (
    <div
      ref={ref}
      className={`rb-spotlight ${className}`}
      onPointerMove={(event) => {
        if (!running || !fine || event.pointerType !== 'mouse') return
        const rect = event.currentTarget.getBoundingClientRect()
        event.currentTarget.style.setProperty(
          '--spot-x',
          `${event.clientX - rect.left}px`,
        )
        event.currentTarget.style.setProperty(
          '--spot-y',
          `${event.clientY - rect.top}px`,
        )
      }}
      data-running={running && fine}
    >
      {children}
    </div>
  )
}
export function GlareHover({ active }: { active: boolean }) {
  const { running, fine } = useMotionPolicy()
  return (
    <span className="rb-glare-clip">
      <motion.span
        className="rb-glare"
        aria-hidden="true"
        initial={false}
        animate={{
          x: active && running && fine ? '180%' : '-180%',
          opacity: active && running && fine ? 0.5 : 0,
        }}
        transition={{ duration: 0.7, ease: cinemaMotion.ease }}
      />
    </span>
  )
}
export function Magnet({ children }: { children: ReactNode }) {
  const { running, fine } = useMotionPolicy()
  const x = useSpring(0, cinemaMotion.spring),
    y = useSpring(0, cinemaMotion.spring)
  const reset = () => {
    x.set(0)
    y.set(0)
  }
  useEffect(() => {
    if (!running) {
      x.jump(0)
      y.jump(0)
    }
  }, [running, x, y])
  return (
    <span
      className="rb-magnet"
      onPointerLeave={reset}
      onPointerCancel={reset}
      onPointerMove={(event) => {
        if (!running || !fine || event.pointerType !== 'mouse') return
        const r = event.currentTarget.getBoundingClientRect()
        x.set(
          Math.max(
            -4,
            Math.min(4, (event.clientX - r.left - r.width / 2) / 12),
          ),
        )
        y.set(
          Math.max(-3, Math.min(3, (event.clientY - r.top - r.height / 2) / 8)),
        )
      }}
    >
      <motion.span style={{ x, y }}>{children}</motion.span>
    </span>
  )
}
export function AnimatedList({
  children,
  className = '',
  as = 'div',
  label,
}: {
  children: ReactNode
  className?: string
  as?: 'ul' | 'div'
  label?: string
}) {
  const scope = useRef<HTMLDivElement | HTMLUListElement>(null)
  const seen = useRef(new WeakSet<Element>())
  const { running } = useMotionPolicy()
  useEffect(() => {
    const nodes = Array.from(scope.current?.children ?? []).filter(
      (node) => !seen.current.has(node),
    )
    nodes.forEach((node) => seen.current.add(node))
    if (!nodes.length || !running) return
    const animation = animate(
      nodes,
      { opacity: [0, 1], x: [12, 0] },
      {
        duration: 0.3,
        delay: staggerDelay,
        ease: cinemaMotion.ease,
      },
    )
    return () => {
      animation.complete()
      animation.stop()
    }
  }, [children, running])
  return as === 'ul' ? (
    <ul
      ref={(node) => {
        scope.current = node!
      }}
      className={className}
      aria-label={label}
    >
      {children}
    </ul>
  ) : (
    <div
      ref={(node) => {
        scope.current = node!
      }}
      className={className}
      aria-label={label}
    >
      {children}
    </div>
  )
}
export function CountUp({ value }: { value: number }) {
  const { locale } = useI18n()
  const { running } = useMotionPolicy()
  const number = useMotionValue(value)
  const formatted = useTransform(number, (n) =>
    Math.round(n).toLocaleString(locale),
  )
  useEffect(() => {
    const controls = animate(number, value, {
      duration: running ? 0.5 : 0,
      ease: cinemaMotion.ease,
    })
    return () => controls.stop()
  }, [number, value, running])
  return (
    <span aria-label={String(value)}>
      <motion.span aria-hidden="true">{formatted}</motion.span>
    </span>
  )
}
export function MagicBento({ children }: { children: ReactNode }) {
  return (
    <div className="rb-magic-bento">
      {Children.map(children, (child) => (
        <SpotlightCard className="rb-bento-cell">{child}</SpotlightCard>
      ))}
    </div>
  )
}
export function ClickSpark({ burst }: { burst: number }) {
  const { running } = useMotionPolicy()
  return (
    <span
      className="rb-click-spark"
      aria-hidden="true"
      data-burst={burst}
      data-running={running}
    >
      {burst > 0 && (
        <span key={burst}>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4
            return (
              <i
                key={i}
                style={
                  {
                    '--spark-x': `${Math.cos(a) * 35}px`,
                    '--spark-y': `${Math.sin(a) * 35}px`,
                  } as import('react').CSSProperties
                }
              />
            )
          })}
        </span>
      )}
    </span>
  )
}
export function GooeyNav<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label?: string
}) {
  const { t } = useI18n()
  const id = useId(),
    { running } = useMotionPolicy()
  return (
    <nav className="rb-gooey-nav" aria-label={label ?? t('Bibliothèque')}>
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          aria-current={value === item.value ? 'page' : undefined}
          onClick={() => onChange(item.value)}
        >
          {value === item.value && (
            <motion.span
              className="rb-gooey-pill"
              layoutId={`${id}-pill`}
              transition={running ? spring.control : { duration: 0 }}
            />
          )}
          <span className="rb-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
export function ElasticSlider({
  value,
  onChange,
  label = 'Volume',
  className = '',
}: {
  value: number
  onChange: (value: number) => void
  label?: string
  className?: string
}) {
  const { running, fine } = useMotionPolicy()
  const stretch = useSpring(1, { stiffness: 350, damping: 22 })
  return (
    <span
      className={`rb-elastic-slider ${className}`}
      onPointerLeave={() => stretch.set(1)}
      onPointerCancel={() => stretch.set(1)}
      onPointerMove={(e) => {
        if (running && fine && e.buttons === 1) {
          const r = e.currentTarget.getBoundingClientRect()
          const over = Math.max(0, r.left - e.clientX, e.clientX - r.right)
          stretch.set(1 + Math.min(over / 300, 0.12))
        }
      }}
    >
      <motion.span
        className="rb-elastic-track"
        style={{ scaleX: running ? stretch : 1 }}
      >
        <i
          style={{
            width: '100%',
            transformOrigin: 'left',
            transform: `scaleX(${Math.min(1, Math.max(0, value))})`,
          }}
        />
      </motion.span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-label={label}
        aria-valuetext={`${Math.round(value * 100)} %`}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        onPointerUp={() => stretch.set(1)}
        onBlur={() => stretch.set(1)}
      />
    </span>
  )
}
