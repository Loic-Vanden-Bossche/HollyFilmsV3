import { useEffect, useRef, type ComponentProps } from 'react'
import { animate } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import type { MediaItem } from '@hollyfilms/shared/library'
import type { HomeShelfBrowse, HomeShelfId } from '../home-shelves.ts'
import { useMotionPolicy } from '../components/reactbits/policy.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { duration, ease, staggerDelay } from '../motion/tokens.ts'
import { HorizontalRail } from './HorizontalRail.tsx'
import { MediaTile } from './MediaTile.tsx'
import '../home.css'
import './home-shelf-formats.css'

type Props = Omit<
  ComponentProps<typeof MediaTile>,
  'item' | 'wide' | 'ranked' | 'footerAction'
> & {
  id: HomeShelfId | 'resume'
  title: string
  items: MediaItem[]
  browse?: HomeShelfBrowse
  loading?: boolean
  onBrowse?: () => void
}

export function HomeMediaShelf({
  id,
  title,
  items,
  browse,
  loading = false,
  onBrowse,
  ...tileProps
}: Props) {
  const { t } = useI18n()
  const { running } = useMotionPolicy()
  const shelf = useRef<HTMLElement>(null)
  const seen = useRef(new WeakSet<Element>())
  const poster = id === 'recent' || id === 'series'
  const ranked = id === 'acclaimed'
  const resume = id === 'resume'
  const headingId = 'home-shelf-' + id

  useEffect(() => {
    if (loading) return
    const controls = new Set<ReturnType<typeof animate>>()
    const observer = new IntersectionObserver(
      (entries) => {
        let order = 0
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) continue
          observer.unobserve(target)
          if (seen.current.has(target)) continue
          seen.current.add(target)
          if (!running || target.contains(document.activeElement)) continue
          // Move the artwork inside the clipped cover. The hit target and the
          // anchor for the expanded preview stay still throughout the reveal.
          const art = target.querySelector<HTMLElement>(
            '.artwork-preview-trigger > .media-artwork',
          )
          const number = target.querySelector<HTMLElement>('.home-rank-number')
          const delay = staggerDelay(order++)
          if (art) {
            const entry = animate(
              art,
              {
                transform: [
                  poster ? 'translateY(1.4%) scale(1.055)' : 'scale(1.045)',
                  poster ? 'translateY(0%) scale(1)' : 'scale(1)',
                ],
                opacity: [0.7, 1],
              },
              { duration: duration.scene, delay, ease: ease.out },
            )
            controls.add(entry)
            void entry.then(() => controls.delete(entry))
          }
          if (number) {
            const entry = animate(
              number,
              {
                translate: ['0.16em 0', '0px 0px'],
                opacity: [0.35, 1],
              },
              {
                duration: duration.scene,
                delay: delay + duration.stagger,
                ease: ease.out,
              },
            )
            controls.add(entry)
            void entry.then(() => controls.delete(entry))
          }
        }
      },
      { threshold: 0.1 },
    )
    for (const card of shelf.current!.querySelectorAll(
      '.home-shelf-track > *',
    )) {
      if (!seen.current.has(card)) observer.observe(card)
    }
    return () => {
      observer.disconnect()
      controls.forEach((control) => control.complete())
    }
  }, [items, loading, poster, running])

  return (
    <section
      ref={shelf}
      className={resume ? 'home-shelf home-resume' : 'home-shelf'}
      data-home-shelf={loading ? undefined : id}
      data-shelf-format={poster ? 'poster' : ranked ? 'ranked' : 'landscape'}
      aria-hidden={loading || undefined}
      aria-labelledby={loading ? undefined : headingId}
    >
      <div className="home-section-header">
        <h2 id={loading ? undefined : headingId} tabIndex={-1}>
          {title}
        </h2>
        {browse && (onBrowse || loading) && (
          <button
            type="button"
            className="home-shelf-link"
            onClick={onBrowse}
            disabled={loading}
          >
            {t(browse === 'movies' ? 'Tous les films' : 'Toutes les séries')}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {loading ? (
        <div className="home-shelf-track home-shelf-skeletons">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="home-rank-card">
              <div className="home-skeleton" />
            </div>
          ))}
        </div>
      ) : (
        <HorizontalRail
          trackClassName={
            resume ? 'home-shelf-track home-resume-rail' : 'home-shelf-track'
          }
          previousLabel={
            resume
              ? t('Titres en cours précédents')
              : t('Titres précédents · {section}', { section: title })
          }
          nextLabel={
            resume
              ? t('Titres en cours suivants')
              : t('Titres suivants · {section}', { section: title })
          }
          step={resume ? 'card' : 'page'}
        >
          {items.map((item, index) => {
            const tile = (
              <MediaTile
                key={item.id}
                item={item}
                wide={!poster}
                ranked={ranked}
                {...tileProps}
              />
            )
            return ranked ? (
              <div
                key={item.id}
                className="home-rank-card"
                role="group"
                aria-label={t('Rang {rank} sur {count}', {
                  rank: index + 1,
                  count: items.length,
                })}
              >
                <span className="home-rank-number" aria-hidden="true">
                  {index + 1}
                </span>
                {tile}
              </div>
            ) : (
              tile
            )
          })}
        </HorizontalRail>
      )}
    </section>
  )
}
