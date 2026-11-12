// Adapted from React Bits TiltedCard and SpotlightCard (David Haz).
// Source and license: ./react-bits.LICENSE.md. Motion drives the springs here.
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import {
  motion,
  useMotionTemplate,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionStyle,
} from 'motion/react'
import './TiltedCard.css'

const spring = { stiffness: 190, damping: 25, mass: 0.65 }
const clamp = (value: number) => Math.min(1, Math.max(-1, value))

export default function TiltedCard({
  children,
  active = false,
  disabled: disabledProp = false,
  trackingRef,
}: {
  children: ReactNode
  active?: boolean
  disabled?: boolean
  trackingRef?: RefObject<HTMLElement | null>
}) {
  const disabled = Boolean(useReducedMotion()) || disabledProp
  const root = useRef<HTMLDivElement>(null)
  const x = useSpring(0, spring)
  const y = useSpring(0, spring)
  const lift = useSpring(0, spring)
  const zoom = useTransform(lift, [0, 1], [1, 1.055])
  useEffect(() => {
    lift.set(active && !disabled ? 1 : 0)
  }, [active, disabled, lift])
  const rotateX = useTransform(y, [-1, 1], [6, -6])
  const rotateY = useTransform(x, [-1, 1], [-7, 7])
  const lightX = useTransform(x, [-1, 1], [0, 100])
  const lightY = useTransform(y, [-1, 1], [0, 100])
  const imageX = useTransform(x, [-1, 1], [5, -5])
  const imageY = useTransform(y, [-1, 1], [5, -5])
  const reflection = useMotionTemplate`radial-gradient(ellipse at ${lightX}% ${lightY}%, #b0f5e83d, #7dded80a 42%, transparent 70%)`
  const edge = useMotionTemplate`radial-gradient(ellipse at ${lightX}% ${lightY}%, #b0f5e8, #4ade8080 30%, #3b82f650 60%, transparent)`
  const parallax = useMotionTemplate`translate3d(${imageX}px, ${imageY}px, 0) scale(${zoom})`

  useEffect(() => {
    const area = trackingRef?.current ?? root.current
    if (!area || disabled || !active) {
      x.set(0)
      y.set(0)
      return
    }
    // Measure the stationary hit area, never the transformed poster.
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const rect = area.getBoundingClientRect()
      const image = root.current?.getBoundingClientRect()
      x.set(
        clamp(
          ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2,
        ),
      )
      y.set(
        clamp(
          ((event.clientY - rect.top) /
            Math.max(1, image?.height ?? rect.height) -
            0.5) *
            2,
        ),
      )
    }
    const reset = () => {
      x.set(0)
      y.set(0)
    }
    area.addEventListener('pointermove', move, { passive: true })
    area.addEventListener('pointerleave', reset)
    area.addEventListener('pointercancel', reset)
    window.addEventListener('blur', reset)
    return () => {
      area.removeEventListener('pointermove', move)
      area.removeEventListener('pointerleave', reset)
      area.removeEventListener('pointercancel', reset)
      window.removeEventListener('blur', reset)
    }
  }, [active, disabled, trackingRef, x, y])

  return (
    <div ref={root} className="tilted-card">
      <motion.div
        className="tilted-card__halo"
        aria-hidden="true"
        initial={false}
        animate={{
          opacity: active ? 0.7 : 0,
          scale: active && !disabled ? 1.04 : 0.96,
        }}
        transition={{ duration: disabled ? 0.15 : 0.4 }}
      />
      <motion.div
        className="tilted-card__body"
        style={
          {
            rotateX: disabled ? 0 : rotateX,
            rotateY: disabled ? 0 : rotateY,
            transformPerspective: 850,
            '--card-parallax': disabled ? 'none' : parallax,
          } as MotionStyle
        }
        initial={false}
        animate={{
          y: active && !disabled ? -5 : 0,
          scale: active && !disabled ? 1.025 : 1,
        }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      >
        {children}
        <motion.span
          className="tilted-card__glare"
          aria-hidden="true"
          style={{ background: reflection }}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
        <motion.span
          className="tilted-card__edge"
          aria-hidden="true"
          style={{ background: edge }}
          initial={false}
          animate={{ opacity: active ? 0.85 : 0 }}
          transition={{ duration: 0.35 }}
        />
      </motion.div>
    </div>
  )
}
