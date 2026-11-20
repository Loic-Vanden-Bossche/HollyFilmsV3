import { useContext, useLayoutEffect, useRef } from 'react'
import { ArtworkHeroContext } from './artwork-hero-context.ts'

/** The pending route and the live video stage can host the same opening shot. */
export function PlayerProjectionSurface({
  cancelled = false,
}: {
  cancelled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const hero = useContext(ArtworkHeroContext)
  useLayoutEffect(() => {
    const host = ref.current
    if (!host || !hero) return
    if (cancelled) {
      hero.finishPlayerProjection()
      return
    }
    return hero.attachPlayerProjection(host)
  }, [hero, cancelled])
  return <div ref={ref} aria-hidden="true" className="player-projection-host" />
}
