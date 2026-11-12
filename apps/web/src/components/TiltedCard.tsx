// Adapted from React Bits TiltedCard and SpotlightCard (David Haz).
// Source and license: ./react-bits.LICENSE.md. Motion drives the springs here.
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import {
  motion,
  useMotionTemplate,
  useSpring,
  useTransform,
} from 'motion/react'
import { GlareHover } from './reactbits/Effects.tsx'
import { cinemaMotion, useMotionPolicy } from './reactbits/policy.ts'
import './TiltedCard.css'

const { spring, depth } = cinemaMotion
const clamp = (value: number) => Math.min(1, Math.max(-1, value))

export default function TiltedCard({
  children,
  active = false,
  disabled: disabledProp = false,
  trackingRef,
  hoverScale = depth.scale,
  tiltStrength = 1,
  hoverLift = depth.lift,
}: {
  children: ReactNode
  hoverLift?: number
  tiltStrength?: number
  hoverScale?: number
  active?: boolean
  disabled?: boolean
  trackingRef?: RefObject<HTMLElement | null>
}) {
  const { running, fine } = useMotionPolicy()
  const disabled = disabledProp || !running || !fine
  const root = useRef<HTMLDivElement>(null)
  const x = useSpring(0, spring)
  const y = useSpring(0, spring)
  const lift = useSpring(0, spring)
  const zoom = useTransform(lift, [0, 1], [1, 1.055])
  useEffect(() => {
    lift.set(active && !disabled ? 1 : 0)
  }, [active, disabled, lift])
  const rotateX = useTransform(
    y,
    [-1, 1],
    [depth.tiltX * tiltStrength, -depth.tiltX * tiltStrength],
  )
  const rotateY = useTransform(
    x,
    [-1, 1],
    [-depth.tiltY * tiltStrength, depth.tiltY * tiltStrength],
  )
  const lightX = useTransform(x, [-1, 1], [-25, 25])
  const lightY = useTransform(y, [-1, 1], [-25, 25])
  const imageX = useTransform(x, [-1, 1], [5, -5])
  const imageY = useTransform(y, [-1, 1], [5, -5])
  const reflection = useMotionTemplate`translate3d(${lightX}%, ${lightY}%, 0)`
  const parallax = useMotionTemplate`translate3d(${imageX}px, ${imageY}px, 0) scale(${zoom})`

  useEffect(() => {
    const artwork = root.current?.querySelector<HTMLElement>(
      '.media-card-artwork',
    )
    if (!artwork) return
    const update = (value: string) => {
      artwork.style.transform =
        disabled ||
        (Math.abs(x.get()) < 0.001 &&
          Math.abs(y.get()) < 0.001 &&
          lift.get() < 0.001)
          ? 'none'
          : value
    }
    update(parallax.get())
    return parallax.on('change', update)
  }, [disabled, parallax, x, y, lift])

  useEffect(() => {
    const area = trackingRef?.current ?? root.current
    if (!area || disabled || !active) {
      if (disabled) {
        x.jump(0)
        y.jump(0)
      } else {
        x.set(0)
        y.set(0)
      }
      return
    }
    let bounds: DOMRect | undefined
    let pending = 0
    let pointerX = 0,
      pointerY = 0
    const invalidate = () => {
      bounds = undefined
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      pointerX = event.clientX
      pointerY = event.clientY
      if (pending) return
      pending = requestAnimationFrame(() => {
        pending = 0
        // Read the stationary area once per entry/resize/scroll, not the
        // transformed card on every pointer event. Coalesce high-rate mice.
        bounds ??= area.getBoundingClientRect()
        x.set(
          clamp(
            ((pointerX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2,
          ),
        )
        y.set(
          clamp(
            ((pointerY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2,
          ),
        )
      })
    }
    const reset = () => {
      cancelAnimationFrame(pending)
      pending = 0
      invalidate()
      x.set(0)
      y.set(0)
    }
    const resize = new ResizeObserver(invalidate)
    resize.observe(area)
    area.addEventListener('pointermove', move, { passive: true })
    area.addEventListener('pointerleave', reset)
    area.addEventListener('pointercancel', reset)
    window.addEventListener('scroll', invalidate, {
      passive: true,
      capture: true,
    })
    window.addEventListener('resize', invalidate)
    window.addEventListener('blur', reset)
    return () => {
      cancelAnimationFrame(pending)
      resize.disconnect()
      area.removeEventListener('pointermove', move)
      area.removeEventListener('pointerleave', reset)
      area.removeEventListener('pointercancel', reset)
      window.removeEventListener('scroll', invalidate, true)
      window.removeEventListener('resize', invalidate)
      window.removeEventListener('blur', reset)
    }
  }, [active, disabled, trackingRef, x, y])

  return (
    <div ref={root} className="tilted-card" data-active={active && !disabled}>
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
        style={{
          rotateX: disabled ? 0 : rotateX,
          rotateY: disabled ? 0 : rotateY,
        }}
        initial={false}
        animate={{
          y: active && !disabled ? -hoverLift : 0,
          scale: active && !disabled ? hoverScale : 1,
        }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      >
        {children}
        <GlareHover active={active && !disabled} />
        <motion.span
          className="tilted-card__glare"
          aria-hidden="true"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.span
            className="tilted-card__light"
            style={{ transform: reflection }}
          />
        </motion.span>
        <motion.span
          className="tilted-card__edge"
          aria-hidden="true"
          initial={false}
          animate={{ opacity: active ? 0.85 : 0 }}
          transition={{ duration: 0.35 }}
        />
      </motion.div>
    </div>
  )
}
