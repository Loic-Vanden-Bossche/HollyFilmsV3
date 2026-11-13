import { useI18n } from '../i18n/I18nProvider.tsx'
import type { ShowcaseItem } from '@hollyfilms/shared/showcase'
import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'
import { Film } from 'lucide-react'
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
  const { ref, running, reduced } = useEffectActivity(stopped)
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
            `translate(${index % 2 ? 24 : -24}px, 36px) scale(.91)`,
            'translate(0px, 0px) scale(1)',
          ],
        },
        {
          duration: reduced ? 0 : 0.75,
          delay: reduced ? 0 : index * 0.055,
          ease: cinemaMotion.ease,
        },
      )
      animation.pause()
      return animation
    })
    floating.current = reduced
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
            { duration: 10 + index * 1.3, repeat: Infinity, ease: 'easeInOut' },
          )
          animation.pause()
          return animation
        })
    return () => {
      floating.current.forEach((animation) => animation.cancel())
      entrances.current.forEach((animation) => animation.cancel())
    }
  }, [posterKey, reduced, ref])

  useEffect(() => {
    floating.current.forEach((animation) =>
      running ? animation.play() : animation.pause(),
    )
    entrances.current.forEach((animation) => {
      if (stopped || reduced) animation.complete()
      else if (animation.state !== 'finished') {
        if (running) animation.play()
        else animation.pause()
      }
    })
  }, [running, stopped, posterKey, reduced])

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
        <div className="gallery-status glass-panel">
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
