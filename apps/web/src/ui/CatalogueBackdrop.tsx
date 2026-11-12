import { useEffect, useRef } from 'react'
import { useAnimate, useInView } from 'motion/react'
import { useMotionPolicy } from '../components/reactbits/policy.ts'
import './catalogue-backdrop.css'

export function CatalogueBackdrop({ paused = false }: { paused?: boolean }) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const visible = useInView(scope)
  const policy = useMotionPolicy(paused)
  const running = policy.running && visible
  const animations = useRef<ReturnType<typeof animate>[]>([])

  useEffect(() => {
    if (policy.reduced) return
    const loops = [
      animate(
        '.catalogue-nebula-green',
        {
          transform: [
            'translate3d(-8%, -6%, 0) rotate(-18deg) scale(1)',
            'translate3d(12%, 14%, 0) rotate(12deg) scale(1.18)',
            'translate3d(-8%, -6%, 0) rotate(-18deg) scale(1)',
          ],
        },
        { duration: 24, repeat: Infinity, ease: 'easeInOut' },
      ),
      animate(
        '.catalogue-nebula-blue',
        {
          transform: [
            'translate3d(8%, 5%, 0) scale(1)',
            'translate3d(-15%, -12%, 0) scale(1.22)',
            'translate3d(8%, 5%, 0) scale(1)',
          ],
        },
        { duration: 30, repeat: Infinity, ease: 'easeInOut' },
      ),
      animate(
        '.catalogue-nebula-teal',
        {
          transform: [
            'translate3d(-10%, 15%, 0) rotate(-30deg)',
            'translate3d(15%, -14%, 0) rotate(5deg)',
            'translate3d(-10%, 15%, 0) rotate(-30deg)',
          ],
        },
        { duration: 20, repeat: Infinity, ease: 'easeInOut' },
      ),
      ...[0, 1, 2].map((i) =>
        animate(
          '.catalogue-ribbon-' + i,
          {
            transform: [
              `translate3d(-4%, 6%, 0) rotate(${-24 + i * 6}deg) scaleY(1)`,
              `translate3d(5%, -10%, 0) rotate(${-12 + i * 5}deg) scaleY(1.25)`,
              `translate3d(-4%, 6%, 0) rotate(${-24 + i * 6}deg) scaleY(1)`,
            ],
            opacity: [0.3, 0.8, 0.3],
          },
          { duration: 18 + i * 6, repeat: Infinity, ease: 'easeInOut' },
        ),
      ),
      animate(
        '.catalogue-stardust',
        {
          transform: [
            'translate3d(0, 0, 0)',
            'translate3d(2%, -3%, 0)',
            'translate3d(0, 0, 0)',
          ],
          opacity: [0.35, 0.7, 0.35],
        },
        { duration: 16, repeat: Infinity, ease: 'easeInOut' },
      ),
    ]
    loops.forEach((loop) => loop.pause())
    animations.current = loops
    return () => {
      loops.forEach((loop) => loop.cancel())
      animations.current = []
    }
  }, [animate, policy.reduced])

  useEffect(() => {
    animations.current.forEach((loop) => (running ? loop.play() : loop.pause()))
  }, [running, policy.reduced])

  return (
    <div
      className="catalogue-backdrop"
      aria-hidden="true"
      data-motion={running ? 'running' : 'paused'}
    >
      <div ref={scope} className="catalogue-atmosphere">
        <div className="catalogue-nebula catalogue-nebula-green" />
        <div className="catalogue-nebula catalogue-nebula-blue" />
        <div className="catalogue-nebula catalogue-nebula-teal" />
        {[0, 1, 2].map((i) => (
          <div key={i} className={`catalogue-ribbon catalogue-ribbon-${i}`} />
        ))}
        <div className="catalogue-stardust">
          {Array.from({ length: 28 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37 + 9) % 100}%`,
                top: `${(i * 23 + 7) % 100}%`,
                opacity: 0.25 + (i % 4) * 0.15,
                width: i % 5 === 0 ? 3 : 2,
                height: i % 5 === 0 ? 3 : 2,
              }}
            />
          ))}
        </div>
        <div className="catalogue-vignette" />
      </div>
    </div>
  )
}
