import { useState } from 'react'
import { motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import type { ShowcaseItem } from '@hollyfilms/shared/showcase'
import { Film } from 'lucide-react'
import { useMotionClock } from '../use-landing-motion.ts'
import './catalogue-gallery.css'

function Poster({
  item,
  clock,
  phase = 0,
}: {
  item: ShowcaseItem
  clock: MotionValue<number>
  phase?: number
}) {
  const [failed, setFailed] = useState(false)
  const tileTransform = useTransform(clock, (time) => {
    const wave = time * 0.55 + phase
    return `perspective(900px) translate3d(${Math.sin(wave * 0.7) * 2}px, ${Math.sin(wave) * 3}px, 0) rotateX(${Math.sin(wave * 0.6) * 1.8}deg) rotateY(${Math.cos(wave * 0.7) * 2.2}deg) rotateZ(${Math.sin(wave * 0.5) * 0.65}deg)`
  })
  const imageTransform = useTransform(
    clock,
    (time) =>
      `translate(${Math.sin(time * 0.3 + phase) * 1.2}%, ${Math.cos(time * 0.25 + phase) * 1.2}%) scale(1.055)`,
  )
  const sheen = useTransform(
    clock,
    (time) => `${-100 + ((time / 14 + phase / 8) % 1) * 480}%`,
  )
  return (
    <motion.div
      className="gallery-poster"
      data-poster-id={item.id}
      style={{ transform: tileTransform }}
    >
      {item.poster && !failed ? (
        <motion.img
          src={item.poster}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setFailed(true)}
          style={{ transform: imageTransform }}
        />
      ) : (
        <div className="gallery-poster-fallback">
          <Film />
        </div>
      )}
      <div className="gallery-poster-vignette" />
      <motion.div
        className="gallery-poster-sheen"
        style={{ x: sheen, rotate: -18 }}
      />
      <div className="gallery-poster-caption">
        <span>
          {item.kind}
          {item.year ? ` · ${item.year}` : ''}
        </span>
        <h3>{item.title}</h3>
      </div>
    </motion.div>
  )
}

function PosterColumn({
  items,
  index,
  clock,
}: {
  items: ShowcaseItem[]
  index: number
  clock: MotionValue<number>
}) {
  // Two identical groups make the loop seamless; fill tall viewports even with a small catalogue.
  const repeated = Array.from(
    { length: Math.ceil(6 / items.length) },
    () => items,
  ).flat()
  const y = useTransform(clock, (time) => {
    const phase =
      (time / (repeated.length * (11 + index * 2)) + index * 0.075) % 1
    return `${index === 1 ? -50 + phase * 50 : -phase * 50}%`
  })
  return (
    <motion.div className="gallery-column" style={{ y }} data-column={index}>
      {[0, 1].map((copy) => (
        <div className="gallery-poster-group" key={copy}>
          {repeated.map((item, position) => (
            <Poster
              key={`${position}-${item.id}`}
              item={item}
              clock={clock}
              phase={position * 1.4 + index * 2.1}
            />
          ))}
        </div>
      ))}
    </motion.div>
  )
}

export function CatalogueGallery({
  items,
  stopped = false,
  state = 'ready',
}: {
  items: ShowcaseItem[]
  stopped?: boolean
  state?: 'loading' | 'ready' | 'error'
}) {
  const clock = useMotionClock(stopped || items.length < 4)
  const entrance = useTransform(
    clock,
    (time) => 1 + 0.06 * Math.max(0, 1 - time / 2) ** 3,
  )
  const drift = useTransform(clock, (time) => Math.sin(time / 9) * 3)
  const columns = [0, 1, 2].map((column) =>
    items.filter((_, index) => index % 3 === column),
  )
  const sparse = items.length > 0 && items.length < 4
  return (
    <div className="catalogue-gallery" data-layout={sparse ? 'sparse' : 'wall'}>
      <div className="gallery-aura" aria-hidden="true" />
      <div className="gallery-window" aria-hidden="true">
        <motion.div
          className="gallery-scene"
          style={{ scale: entrance, y: drift }}
        >
          {items.length > 0 ? (
            <div className={sparse ? 'gallery-sparse' : 'gallery-wall'}>
              {sparse
                ? items.map((item, index) => (
                    <Poster
                      key={item.id}
                      item={item}
                      clock={clock}
                      phase={index * 1.4}
                    />
                  ))
                : columns.map((column, index) => (
                    <PosterColumn
                      key={index}
                      items={column}
                      index={index}
                      clock={clock}
                    />
                  ))}
            </div>
          ) : (
            <div className="gallery-empty-posters">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="gallery-placeholder" key={index}>
                  <Film />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
      {!items.length && (
        <div className="gallery-status glass-panel">
          <p role="status">
            {state === 'loading'
              ? 'Chargement du catalogue…'
              : state === 'error'
                ? 'Catalogue momentanément indisponible.'
                : 'Aucun titre dans le catalogue pour le moment.'}
          </p>
        </div>
      )}
      <ul className="sr-only" aria-label="Titres du catalogue">
        {items.map((item) => (
          <li key={item.id}>
            {item.title} · {item.kind}
            {item.year ? ` · ${item.year}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
