import {
  Children,
  isValidElement,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type ComponentProps,
} from 'react'
import { Select as Primitive } from '@base-ui/react/select'
import { motion, useReducedMotion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import './select.css'

// HollyFilms adaptation of the shadcn/Base UI Select composition.
const mobileQuery = '(hover: none), (pointer: coarse)'
function subscribe(callback: () => void) {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const getMobile = () => window.matchMedia(mobileQuery).matches
const getServerMobile = () => false

type SelectProps = {
  value?: string | number
  onValueChange: (value: string) => void
  children: ReactNode
  disabled?: boolean
  required?: boolean
  name?: string
  id?: string
  className?: string
  optionIcon?: (value: string) => ReactNode
  'aria-label': string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function Select({
  value,
  onValueChange,
  children,
  disabled,
  required,
  name,
  className = '',
  optionIcon,
  ...label
}: SelectProps) {
  const mobile = useSyncExternalStore(subscribe, getMobile, getServerMobile)
  const reduced = useReducedMotion()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState<HTMLElement | undefined>()
  const options = Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<ComponentProps<'option'>>(child) ||
      child.type !== 'option'
    )
      return []
    return [
      {
        value: String(child.props.value ?? ''),
        label: child.props.children,
        disabled: child.props.disabled,
      },
    ]
  })
  const selected = value == null ? (options[0]?.value ?? '') : String(value)
  if (mobile)
    return (
      <span className={'holly-select-native ' + className}>
        {optionIcon?.(selected) && (
          <span className="holly-select-native-icon" aria-hidden="true">
            {optionIcon(selected)}
          </span>
        )}
        <select
          {...label}
          name={name}
          required={required}
          disabled={disabled}
          value={selected}
          onChange={(event) => onValueChange(event.target.value)}
        >
          {children}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    )
  return (
    <Primitive.Root
      items={options}
      value={selected}
      onValueChange={(next) => {
        if (next != null) onValueChange(next)
      }}
      disabled={disabled}
      required={required}
      name={name}
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (next)
          setContainer(
            (trigger.current?.closest('dialog') ??
              document.fullscreenElement ??
              trigger.current?.closest(
                'dialog, [role="dialog"], .player-viewport, .media-dialog',
              ) ??
              document.body) as HTMLElement,
          )
        setOpen(next)
      }}
    >
      <Primitive.Trigger
        {...label}
        ref={trigger}
        className={'holly-select-trigger ' + className}
        onKeyDown={(event) => {
          if (open && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          }
        }}
      >
        {optionIcon?.(selected)}
        <Primitive.Value className="holly-select-value" />
        <Primitive.Icon
          render={
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: reduced ? 0 : 0.18 }}
            />
          }
        >
          <ChevronDown size={15} aria-hidden="true" />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal container={container}>
        <Primitive.Positioner
          align="start"
          alignItemWithTrigger={false}
          sideOffset={6}
          className="holly-select-positioner"
        >
          <Primitive.Popup
            className="holly-select-popup"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setOpen(false)
                trigger.current?.focus()
              }
            }}
            render={
              <motion.div
                initial={{
                  opacity: 0,
                  y: reduced ? 0 : -5,
                  scale: reduced ? 1 : 0.98,
                }}
                animate={{
                  opacity: open ? 1 : 0,
                  y: open || reduced ? 0 : -5,
                  scale: open || reduced ? 1 : 0.98,
                }}
                transition={{
                  duration: reduced ? 0.1 : 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            }
          >
            <Primitive.List className="holly-select-list">
              {options.map((option) => (
                <Primitive.Item
                  key={option.value}
                  value={option.value}
                  data-value={option.value}
                  disabled={option.disabled}
                  className="holly-select-option"
                >
                  {optionIcon?.(option.value)}
                  <Primitive.ItemText>{option.label}</Primitive.ItemText>
                  <Primitive.ItemIndicator className="holly-select-check">
                    <Check size={15} aria-hidden="true" />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
            </Primitive.List>
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
