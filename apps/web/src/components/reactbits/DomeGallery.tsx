// React Bits Dome Gallery: spherical tile projection; passive Motion camera adaptation.
// Dragging, enlargement, gestures and external demo images intentionally omitted.
import { useI18n } from '../../i18n/I18nProvider.tsx'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { animate } from 'motion/react'
import { Film } from 'lucide-react'
import type { ShowcaseItem } from '@hollyfilms/shared/showcase'
import { useEffectActivity } from './policy.ts'
import { GradualBlur } from './Effects.tsx'
import './effects.css'

export function DomeGallery({
  items,
  paused = false,
}: {
  items: ShowcaseItem[]
  paused?: boolean
}) {
  const { ref, running } = useEffectActivity(paused || items.length < 4)
  const [radius, setRadius] = useState(600)
  const { t } = useI18n()
  const sphere = useRef<HTMLDivElement>(null)
  const orbit = useRef<ReturnType<typeof animate> | null>(null)
  const sparse = items.length < 4
  useEffect(() => {
    if (sparse || !sphere.current) return
    // Full transform keyframes use the browser compositor instead of updating
    // rotateY from a JavaScript clock on every display frame.
    const frames = Array.from(
      { length: 121 },
      (_, i) =>
        'translateZ(' +
        -radius +
        'px) rotateX(-5deg) rotateY(' +
        (-12 + Math.sin((i / 120) * Math.PI * 2) * 18) +
        'deg)',
    )
    const animation = animate(
      sphere.current,
      { transform: frames },
      { duration: Math.PI * 34, repeat: Infinity, ease: 'linear' },
    )
    animation.pause()
    orbit.current = animation
    return () => {
      animation.cancel()
      orbit.current = null
    }
  }, [radius, sparse])
  useEffect(() => {
    if (running) orbit.current?.play()
    else orbit.current?.pause()
  }, [running, radius, sparse])
  useEffect(() => {
    const node = ref.current!
    const resize = new ResizeObserver(([entry]) =>
      setRadius(
        Math.max(
          310,
          Math.min(
            900,
            Math.max(
              entry.contentRect.width * 0.85,
              entry.contentRect.height * 0.8,
            ),
          ),
        ),
      ),
    )
    resize.observe(node.querySelector('.rb-dome-stage')!)
    return () => resize.disconnect()
  }, [ref])
  return (
    <div
      ref={ref}
      className={`rb-dome ${sparse ? 'rb-dome-sparse' : ''}`}
      data-motion={running ? 'running' : 'paused'}
      style={{ '--dome-radius': `${radius}px` } as CSSProperties}
    >
      <div className="rb-dome-stage" aria-hidden="true">
        <div ref={sphere} className="rb-dome-sphere">
          {(sparse
            ? items
            : Array.from({ length: 21 }, (_, i) => items[i % items.length])
          )
            .filter(Boolean)
            .map((item, i) => (
              <div
                className="rb-dome-tile"
                key={`${item.id}-${i}`}
                style={
                  sparse
                    ? undefined
                    : {
                        transform: `rotateY(${((i % 7) - 3) * 23}deg) rotateX(${(Math.floor(i / 7) - 1) * 32 + ((i % 7) % 2 ? 3 : -3)}deg) translateZ(${radius}px)`,
                      }
                }
              >
                <div
                  className="gallery-poster rb-dome-poster"
                  data-poster-id={item.id}
                >
                  <Film className="rb-dome-fallback" />
                  {item.poster && (
                    <img
                      src={item.poster}
                      alt=""
                      draggable={false}
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <div className="rb-dome-caption">
                    <span>
                      {t(item.kind)}
                      {item.year ? ` · ${item.year}` : ''}
                    </span>
                    <strong>{item.title}</strong>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
      <GradualBlur
        position="left"
        size="calc(var(--dome-bleed, 0px) + 20%)"
        strength={24}
      />
      <GradualBlur position="right" size="12%" strength={5} />
      <GradualBlur position="top" size="14%" strength={8} />
      <GradualBlur position="bottom" size="16%" strength={8} />
    </div>
  )
}
