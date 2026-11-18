import { useI18n } from '../i18n/I18nProvider.tsx'
import { usePerformanceProfile } from '../performance/PerformanceProvider.tsx'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import {
  defaultRangeExtractor,
  useWindowVirtualizer,
  type Range,
} from '@tanstack/react-virtual'
import { DeferredMediaTile } from './DeferredMediaTile.tsx'
import type { MediaItem } from '@hollyfilms/shared/library'
import './virtual-media-grid.css'

type Props = Omit<
  ComponentProps<typeof DeferredMediaTile>,
  'item' | 'order'
> & {
  items: MediaItem[]
  total: number
}

/** Row virtualization keeps the document scrollbar and the existing responsive grid. */
export const VirtualMediaGrid = memo(function VirtualMediaGrid({
  items,
  total,
  ...tileProps
}: Props) {
  const { t } = useI18n()
  const profile = usePerformanceProfile()
  const root = useRef<HTMLDivElement>(null)
  const probe = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({
    columns: 6,
    width: 0,
    gap: 30,
    top: 0,
    cardWidth: 200,
  })
  const [focusedId, setFocusedId] = useState<string>()
  useLayoutEffect(() => {
    const element = root.current!
    const grid = probe.current!
    let frame = 0
    let previousWidth = -1
    let columns = 6
    let gap = 0
    let columnGap = 0
    const measure = () => {
      frame = 0
      const width = element.clientWidth
      // The body also resizes as images/rows arrive. Only reread responsive
      // grid styles when its width changes, and batch geometry reads per frame.
      if (width !== previousWidth) {
        const style = getComputedStyle(grid)
        columns = style.gridTemplateColumns.split(' ').length
        gap = parseFloat(style.rowGap) || 0
        columnGap = parseFloat(style.columnGap) || 0
        previousWidth = width
      }
      const next = {
        columns,
        width,
        gap,
        top: element.getBoundingClientRect().top + window.scrollY,
        cardWidth: (width - (columns - 1) * columnGap) / columns,
      }
      setLayout((previous) =>
        Object.keys(next).every(
          (key) =>
            previous[key as keyof typeof next] ===
            next[key as keyof typeof next],
        )
          ? previous
          : next,
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    // The initial ResizeObserver delivery follows browser layout. Measuring in
    // the mount commit forced layout of the entire page during its intro.
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    observer.observe(document.body)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [])
  const focusedIndex = items.findIndex((item) => item.id === focusedId)
  const focusedRow =
    focusedIndex < 0 ? -1 : Math.floor(focusedIndex / layout.columns)
  const rangeExtractor = useCallback(
    (range: Range) => {
      const rows = defaultRangeExtractor(range)
      // Retain the initiating card while a dialog owns focus, and while tabbing.
      if (
        focusedRow >= 0 &&
        focusedRow < range.count &&
        !rows.includes(focusedRow)
      )
        rows.push(focusedRow)
      return rows.sort((a, b) => a - b)
    },
    [focusedRow],
  )
  const getItemKey = useCallback(
    (index: number) => items[index * layout.columns].id,
    [items, layout.columns],
  )
  // TanStack owns mutable measurements; React Compiler must not memoize this hook.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    enabled: layout.width > 0,
    count: Math.ceil(items.length / layout.columns),
    estimateSize: () => (layout.cardWidth - 2) * 1.5 + 76,
    gap: layout.gap,
    overscan: profile.overscan,
    scrollMargin: layout.top,
    getItemKey,
    rangeExtractor,
  })
  useLayoutEffect(() => {
    virtualizer.measure()
  }, [virtualizer, layout.width, layout.columns])

  return (
    <div
      ref={root}
      className="virtual-media-grid"
      role="list"
      aria-label={t('Titres du catalogue')}
      style={{ height: virtualizer.getTotalSize() }}
    >
      <div
        ref={probe}
        className="home-grid virtual-grid-probe"
        aria-hidden="true"
      />
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          ref={virtualizer.measureElement}
          data-index={row.index}
          className="home-grid virtual-media-row"
          role="presentation"
          style={{ transform: `translateY(${row.start - layout.top}px)` }}
        >
          {items
            .slice(row.index * layout.columns, (row.index + 1) * layout.columns)
            .map((item, column) => (
              <div
                key={item.id}
                role="listitem"
                aria-setsize={total}
                aria-posinset={row.index * layout.columns + column + 1}
                onFocusCapture={() => setFocusedId(item.id)}
              >
                <DeferredMediaTile {...tileProps} item={item} order={column} />
              </div>
            ))}
        </div>
      ))}
    </div>
  )
})

export function CatalogueLoadTrigger({
  count,
  hasMore,
  loading,
  error,
  paused,
  onLoadMore,
}: {
  count: number
  hasMore?: boolean
  loading?: boolean
  error?: boolean
  paused?: boolean
  onLoadMore: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const requestedCount = useRef(-1)
  useEffect(() => {
    if (!hasMore || loading || error || paused) return
    let near = false
    const load = () => {
      if (!near || document.hidden || requestedCount.current === count) return
      requestedCount.current = count
      onLoadMore()
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting
        load()
      },
      { rootMargin: '800px 0px' },
    )
    observer.observe(ref.current!)
    document.addEventListener('visibilitychange', load)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', load)
    }
  }, [count, hasMore, loading, error, paused, onLoadMore])
  return <div ref={ref} className="catalogue-load-trigger" aria-hidden="true" />
}
