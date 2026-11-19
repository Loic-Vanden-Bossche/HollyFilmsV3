import { useI18n } from '../i18n/I18nProvider.tsx'
import { duration, ease } from '../motion/tokens.ts'
import {
  usePerformanceReducedMotion,
  usePerformanceProfile,
} from '../performance/PerformanceProvider.tsx'
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
  const reduced = usePerformanceReducedMotion()
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
  // TanStack owns mutable measurements; React Compiler must not memoize this hook.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    enabled: layout.width > 0,
    useAnimationFrameWithResizeObserver: true,
    count: Math.ceil(items.length / layout.columns),
    estimateSize: () => (layout.cardWidth * 3) / 2,
    gap: layout.gap,
    overscan: profile.overscan,
    scrollMargin: layout.top,
    rangeExtractor,
  })
  useLayoutEffect(() => {
    virtualizer.measure()
  }, [virtualizer, layout.width, layout.columns])

  // Animate only mounted cells, on their own layer below the virtualizer's row
  // offsets. Adjacent cards advance when a favorite leaves or a sort changes.
  const lastOrder = useRef<{ ids: Map<string, number>; width: number } | null>(
    null,
  )
  useLayoutEffect(() => {
    const ids = new Map(items.map((item, index) => [item.id, index]))
    const previous = lastOrder.current
    lastOrder.current = { ids, width: layout.width }
    if (reduced) {
      root.current
        ?.querySelectorAll('[data-grid-item]')
        .forEach((cell) =>
          cell.getAnimations().forEach((animation) => animation.cancel()),
        )
      return
    }
    if (
      !previous ||
      previous.width !== layout.width ||
      !layout.width ||
      document.hidden
    )
      return
    const strideX =
      layout.columns > 1
        ? (layout.width - layout.cardWidth) / (layout.columns - 1)
        : 0
    const offsets: { cell: HTMLElement; x: number; y: number }[] = []
    for (const cell of root.current!.querySelectorAll<HTMLElement>(
      '[data-grid-item]',
    )) {
      const id = cell.dataset.gridItem!
      const from = previous.ids.get(id)
      const to = ids.get(id)
      if (from === undefined || to === undefined || from === to) continue
      const rows =
        Math.floor(from / layout.columns) - Math.floor(to / layout.columns)
      if (Math.abs(rows) > 1) continue
      const current = new DOMMatrixReadOnly(getComputedStyle(cell).transform)
      offsets.push({
        cell,
        x:
          ((from % layout.columns) - (to % layout.columns)) * strideX +
          current.m41,
        y: rows * (cell.offsetHeight + layout.gap) + current.m42,
      })
    }
    for (const { cell, x, y } of offsets) {
      cell.getAnimations().forEach((animation) => animation.cancel())
      cell.animate(
        [
          { transform: 'translate(' + x + 'px,' + y + 'px)' },
          { transform: 'translate(0, 0)' },
        ],
        {
          duration: duration.panel * 1000,
          easing: 'cubic-bezier(' + ease.out.join(',') + ')',
        },
      )
    }
  }, [items, layout, reduced])

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
                data-grid-item={item.id}
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
    const sentinel = ref.current!
    const grid = sentinel.previousElementSibling
    // A newly mounted virtual grid has no height until its first measurement.
    // Observing the sentinel first can request a second page above the fold.
    const measurements = new ResizeObserver(() => {
      if (grid?.clientHeight) {
        measurements.disconnect()
        observer.observe(sentinel)
      }
    })
    if (count && grid?.matches('.virtual-media-grid') && !grid.clientHeight)
      measurements.observe(grid)
    else observer.observe(sentinel)
    document.addEventListener('visibilitychange', load)
    return () => {
      observer.disconnect()
      measurements.disconnect()
      document.removeEventListener('visibilitychange', load)
    }
  }, [count, hasMore, loading, error, paused, onLoadMore])
  return <div ref={ref} className="catalogue-load-trigger" aria-hidden="true" />
}
