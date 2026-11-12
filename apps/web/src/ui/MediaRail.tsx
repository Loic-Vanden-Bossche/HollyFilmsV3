import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

export function MediaRail({
  title,
  children,
  kind = 'poster',
  count,
}: {
  title: string
  children: ReactNode
  kind?: 'poster' | 'person' | 'scene' | 'review'
  count?: number
}) {
  const ref = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion()
  const [edges, setEdges] = useState({ start: true, end: true })
  useEffect(() => {
    const node = ref.current!
    const update = () => {
      const start = node.scrollLeft < 2,
        end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 2
      setEdges((previous) =>
        previous.start === start && previous.end === end
          ? previous
          : { start, end },
      )
    }
    update()
    const resize = new ResizeObserver(update)
    resize.observe(node)
    for (const child of node.children) resize.observe(child)
    node.addEventListener('scroll', update, { passive: true })
    return () => {
      resize.disconnect()
      node.removeEventListener('scroll', update)
    }
  }, [children])
  const move = (direction: number) =>
    ref.current?.scrollBy({
      left: direction * ref.current.clientWidth * 0.85,
      behavior: reduced ? 'instant' : 'smooth',
    })
  return (
    <motion.section
      className={`detail-rail detail-rail-${kind}`}
      aria-label={title}
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: reduced ? 0 : 0.3 }}
    >
      <div className="detail-section-heading">
        <h3>
          {title}
          {count != null && <span>{count}</span>}
        </h3>
        <div className="detail-rail-controls">
          <button
            className="glass-control"
            aria-label={`${title} : précédent`}
            disabled={edges.start}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="glass-control"
            aria-label={`${title} : suivant`}
            disabled={edges.end}
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div ref={ref} className="detail-rail-track">
        {children}
      </div>
    </motion.section>
  )
}
