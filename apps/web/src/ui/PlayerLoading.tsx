import { useEffect, useLayoutEffect, useState } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import type { LoadingPhase } from '../playback/loading-progress.ts'
import { useMotionPolicy } from '../components/reactbits/policy.ts'
import './player-loading.css'

// Completion of observed preparation milestones, not bytes or remaining time.
const progressByPhase: Record<LoadingPhase, number> = {
  source: 0,
  stream: 25,
  buffer: 50,
  image: 75,
}

export function PlayerLoading({
  visible,
  phase,
  complete = false,
}: {
  visible: boolean
  phase: LoadingPhase
  complete?: boolean
}) {
  const { reduced, pageVisible } = useMotionPolicy()
  const [shown, setShown] = useState(false)
  const target = !visible && complete ? 100 : progressByPhase[phase]
  const progress = useSpring(target, { stiffness: 550, damping: 38, mass: 0.5 })
  const fill = useTransform(progress, (value) =>
    Math.max(0, Math.min(1, value / 100)),
  )
  const label = useTransform(
    progress,
    (value) => Math.round(Math.max(0, Math.min(100, value))) + ' %',
  )
  useLayoutEffect(() => {
    if (reduced || !pageVisible || !shown) progress.jump(target)
    else progress.set(target)
  }, [target, reduced, pageVisible, shown, progress])
  useEffect(() => {
    // Only the indicator is delayed. Playback never waits for this animation.
    const timer = setTimeout(
      () => setShown(visible),
      visible ? 220 : complete ? 550 : 120,
    )
    return () => clearTimeout(timer)
  }, [visible, complete])
  if (!shown) return null
  return (
    <motion.div
      className="player-loading"
      role="progressbar"
      aria-label="Préparation de la lecture"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={target}
      aria-valuetext={target + ' % des étapes de préparation'}
      initial={{ opacity: 0, y: reduced ? 0 : 6 }}
      animate={{ opacity: visible ? 1 : 0, y: 0 }}
      transition={{
        duration: reduced ? 0.1 : 0.18,
        delay: !visible && complete && !reduced ? 0.35 : 0,
      }}
    >
      <motion.span className="player-loading-percent" aria-hidden="true">
        {label}
      </motion.span>
      <div className="player-loading-track" aria-hidden="true">
        <motion.div className="player-loading-fill" style={{ scaleX: fill }} />
      </div>
    </motion.div>
  )
}
