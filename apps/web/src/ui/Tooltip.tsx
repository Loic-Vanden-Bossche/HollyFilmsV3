import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Tooltip as Primitive } from '@base-ui/react/tooltip'
import './anchored-popup.css'
import './tooltip.css'

// HollyFilms adaptation of the shadcn/Base UI tooltip composition.
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Primitive.Provider delay={400} closeDelay={100} timeout={250}>
      {children}
    </Primitive.Provider>
  )
}

export function Tooltip({
  children,
  content,
  side = 'top',
  disabled = false,
}: {
  children: ReactElement<{
    title?: string
    'aria-label'?: string
    'aria-describedby'?: string
  }>
  content?: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
}) {
  const id = useId()
  const label = content ?? children.props.title ?? children.props['aria-label']
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState<HTMLElement | undefined>()
  const trigger = useRef<HTMLElement>(null)
  const actions = useRef<Primitive.Root.Actions>(null)
  // Only listen while visible. Scrolling, switching tabs and fullscreen changes
  // must never leave an orphaned hint over another screen or a hidden control.
  useEffect(() => {
    if (!open) return
    const close = () => actions.current?.close()
    document.addEventListener('scroll', close, true)
    document.addEventListener('visibilitychange', close)
    document.addEventListener('fullscreenchange', close)
    const observer = new MutationObserver(() => {
      if (trigger.current?.closest('[inert], [aria-hidden="true"]')) close()
    })
    const surface = trigger.current?.closest('.player-viewport, .media-dialog')
    if (surface)
      observer.observe(surface, {
        attributes: true,
        subtree: true,
        attributeFilter: ['inert', 'aria-hidden'],
      })
    return () => {
      document.removeEventListener('scroll', close, true)
      document.removeEventListener('visibilitychange', close)
      document.removeEventListener('fullscreenchange', close)
      observer.disconnect()
    }
  }, [open])
  return (
    <Primitive.Root
      open={open}
      disabled={disabled || !label}
      actionsRef={actions}
      onOpenChange={(next, details) => {
        if (next) {
          const element = details.trigger as HTMLElement | undefined
          trigger.current = element ?? null
          if (element?.closest('[inert], [aria-hidden="true"]')) {
            details.cancel()
            return
          }
          setContainer(
            (document.fullscreenElement ??
              element?.closest('dialog[open], [role="dialog"]') ??
              document.body) as HTMLElement,
          )
        }
        setOpen(next)
      }}
    >
      <Primitive.Trigger
        aria-describedby={
          [children.props['aria-describedby'], open ? id : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        render={cloneElement(children, { title: undefined })}
        onKeyDown={(event) => {
          if (open && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            actions.current?.close()
          }
        }}
      />
      <Primitive.Portal container={container}>
        <Primitive.Positioner
          disableAnchorTracking={!open}
          side={side}
          sideOffset={9}
          collisionPadding={10}
          className="holly-tooltip-positioner"
        >
          <Primitive.Popup
            id={id}
            role="tooltip"
            aria-hidden={!open}
            className="holly-tooltip"
          >
            {label}
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
