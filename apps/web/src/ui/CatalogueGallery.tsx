import { useI18n } from '../i18n/I18nProvider.tsx'
import type { ShowcaseItem } from '@hollyfilms/shared/showcase'
import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'
import { Film } from 'lucide-react'
import { duration, distance, staggerDelay } from '../motion/tokens.ts'
import {
  cinemaMotion,
  useEffectActivity,
} from '../components/reactbits/policy.ts'
import './catalogue-gallery.css'

// One focal poster, two wings and four distant posters. No cloned catalogue tiles.
const positions = [
  'lead',
  'left',
  'right',
  'north-west',
  'north-east',
  'south-west',
  'south-east',
]
export function CatalogueGallery({
  items,
  stopped = false,
  state = 'ready',
}: {
  items: ShowcaseItem[]
  stopped?: boolean
  state?: 'loading' | 'ready' | 'error'
}) {
  const { t } = useI18n()
  const { ref, running, reduced, profile } = useEffectActivity(stopped)
  const floating = useRef<ReturnType<typeof animate>[]>([])
  const entrances = useRef<ReturnType<typeof animate>[]>([])
  const posters = items.slice(0, positions.length)
  const count = posters.length
  const posterKey = posters.map((item) => item.id).join(',')

  useEffect(() => {
    const cards =
      ref.current?.querySelectorAll<HTMLElement>('.gallery-reveal') ?? []
    const drifts =
      ref.current?.querySelectorAll<HTMLElement>('.gallery-drift') ?? []
    entrances.current = Array.from(cards, (card, index) => {
      const animation = animate(
        card,
        {
          opacity: [0, 1],
          transform: [
            `translate(${index ? (index % 2 ? -distance.panel : distance.panel) : 0}px, ${index ? distance.panel : distance.scene}px) scale(.965)`,
            'translate(0px, 0px) scale(1)',
          ],
        },
        {
          duration: reduced ? 0 : duration.feature,
          delay: reduced ? 0 : staggerDelay(index),
          ease: cinemaMotion.ease,
        },
      )
      animation.pause()
      return animation
    })
    floating.current =
      reduced || !profile.ambient
        ? []
        : Array.from(drifts, (card, index) => {
            const direction = index % 2 ? -1 : 1
            const animation = animate(
              card,
              {
                transform: [
                  'translateY(0px)',
                  `translateY(${direction * 12}px)`,
                  'translateY(0px)',
                ],
              },
              {
                duration: 10 + index * 1.3,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            )
            animation.pause()
            return animation
          })
    return () => {
      floating.current.forEach((animation) => animation.cancel())
      entrances.current.forEach((animation) => animation.cancel())
    }
  }, [posterKey, reduced, ref, profile.ambient])

  useEffect(() => {
    floating.current.forEach((animation) =>
      running ? animation.play() : animation.pause(),
    )
    entrances.current.forEach((animation) => {
      if (stopped || reduced || !profile.ambient) animation.complete()
      else if (animation.state !== 'finished') {
        if (running) animation.play()
        else animation.pause()
      }
    })
  }, [running, stopped, posterKey, reduced, profile.ambient])

  return (
    <div
      ref={ref}
      className="catalogue-gallery"
      data-layout={count < 4 ? 'sparse' : 'constellation'}
      data-motion={running ? 'running' : 'paused'}
    >
      <div className="gallery-light" aria-hidden="true" />
      <div className="gallery-composition" aria-hidden="true">
        <div className="gallery-orbit" />
        <div className="gallery-orbit gallery-orbit-secondary" />
        {posters.map((item, index) => (
          <div
            key={item.id}
            className="gallery-position"
            data-position={positions[index]}
          >
            <div className="gallery-reveal">
              <div className="gallery-drift">
                <div className="gallery-poster" data-poster-id={item.id}>
                  <Film className="gallery-fallback" strokeWidth={1} />
                  {item.poster && (
                    <img
                      key={item.poster}
                      src={item.poster}
                      alt=""
                      draggable={false}
                      decoding="async"
                      onLoad={(event) => {
                        event.currentTarget.dataset.ready = 'true'
                      }}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <div className="gallery-caption">
                    <span>
                      {t(item.kind)}
                      {item.year ? ` · ${item.year}` : ''}
                    </span>
                    <strong>{item.title}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!items.length && (
        <div className="gallery-status" data-state={state}>
          <p role="status">
            {state === 'loading'
              ? t('Chargement du catalogue…')
              : state === 'error'
                ? t('Catalogue momentanément indisponible.')
                : t('Aucun titre dans le catalogue pour le moment.')}
          </p>
        </div>
      )}
      <ul className="sr-only" aria-label={t('Titres du catalogue')}>
        {items.map((item) => (
          <li key={item.id}>
            {item.title} · {t(item.kind)}
            {item.year ? ' · ' + item.year : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
