import { useEffect, useRef, useState } from 'react'
import { useAnimate, useReducedMotion } from 'motion/react'
import './catalogue-backdrop.css'

export function CatalogueBackdrop({ paused = false }: { paused?: boolean }) {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(() => !document.hidden)
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const animations = useRef<ReturnType<typeof animate>[]>([])
  const running = !paused && !reduced && visible

  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    if (reduced) return
    const loop = { repeat: Infinity, ease: 'easeInOut' as const }
    const controls = [
      animate(
        '.catalogue-aurora-mint',
        {
          x: ['-6%', '9%', '-6%'],
          y: ['-4%', '10%', '-4%'],
          rotate: [-24, -9, -24],
          scale: [1, 1.13, 1],
        },
        { ...loop, duration: 24 },
      ),
      animate(
        '.catalogue-aurora-blue',
        {
          x: ['8%', '-10%', '8%'],
          y: ['6%', '-8%', '6%'],
          rotate: [18, -6, 18],
          scale: [1.1, 0.92, 1.1],
        },
        { ...loop, duration: 31 },
      ),
      animate(
        '.catalogue-light-arcs',
        {
          rotate: [-16, -3, -16],
          x: ['-3%', '5%', '-3%'],
          scale: [1, 1.08, 1],
          opacity: [0.45, 0.85, 0.45],
        },
        { ...loop, duration: 28 },
      ),
      animate(
        '.catalogue-dust',
        {
          y: [0, -48, 0],
          x: [0, 24, 0],
          opacity: [0.35, 0.7, 0.35],
        },
        { ...loop, duration: 19 },
      ),
    ]
    controls.forEach((control) => control.pause())
    animations.current = controls
    return () => {
      controls.forEach((control) => control.cancel())
      animations.current = []
    }
  }, [animate, reduced])

  useEffect(() => {
    animations.current.forEach((control) =>
      running ? control.play() : control.pause(),
    )
  }, [running, reduced])

  return (
    <div
      ref={scope}
      className="catalogue-backdrop"
      aria-hidden="true"
      data-motion={running ? 'running' : 'paused'}
    >
      <div className="catalogue-atmosphere">
        <div className="catalogue-aurora catalogue-aurora-mint" />
        <div className="catalogue-aurora catalogue-aurora-blue" />
        <div className="catalogue-light-arcs">
          <i />
          <i />
          <i />
        </div>
        <div className="catalogue-dust">
          {Array.from({ length: 28 }, (_, index) => (
            <i
              key={index}
              style={{
                left: `${(index * 37 + 9) % 100}%`,
                top: `${(index * 61 + 13) % 100}%`,
                opacity: 0.25 + (index % 4) * 0.18,
              }}
            />
          ))}
        </div>
        <div className="catalogue-vignette" />
      </div>
    </div>
  )
}
