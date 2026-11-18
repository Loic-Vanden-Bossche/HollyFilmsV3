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
import { Combobox } from '@base-ui/react/combobox'
import { motion, useReducedMotion } from 'motion/react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider.tsx'
import './select.css'

// HollyFilms adaptation of the shadcn/Base UI Select composition.
const mobileQuery = '(hover: none), (pointer: coarse)'
const searchThreshold = 8
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
  const { t, locale } = useI18n()
  const { contains } = Combobox.useFilter({ locale })
  const [mobileQueryText, setMobileQueryText] = useState('')
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
    const text =
      child.props.label ?? Children.toArray(child.props.children).join('')
    return [
      {
        value: String(child.props.value ?? text),
        label: text,
        disabled: child.props.disabled,
      },
    ]
  })
  const selected = value == null ? (options[0]?.value ?? '') : String(value)
  const searchable = options.length >= searchThreshold
  const searchLabel = t('Filtrer les options de « {field} »', {
    field: label['aria-label'],
  })
  const searchPlaceholder = t('Rechercher une option')
  if (mobile) {
    const query = searchable ? mobileQueryText.trim() : ''
    const matches = query
      ? options.filter((option) => contains(option.label, query))
      : options
    const current = options.find((option) => option.value === selected)
    return (
      <span className={'holly-select-native ' + className}>
        <span className="holly-select-native-control">
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
            onChange={(event) => {
              setMobileQueryText('')
              onValueChange(event.target.value)
            }}
          >
            {query ? (
              <>
                {current && !matches.includes(current) && (
                  <option
                    value={current.value}
                    disabled={current.disabled}
                    hidden
                  >
                    {current.label}
                  </option>
                )}
                {matches.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))}
              </>
            ) : (
              children
            )}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </span>
        {searchable && (
          <span className="holly-select-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              aria-label={searchLabel}
              placeholder={searchPlaceholder}
              disabled={disabled}
              autoComplete="off"
              value={mobileQueryText}
              onChange={(event) => setMobileQueryText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing)
                  event.preventDefault()
              }}
            />
          </span>
        )}
        {query && (
          <span className="holly-select-empty" role="status">
            {matches.length
              ? t('Options trouvées · {count}', { count: matches.length })
              : t('Aucun résultat')}
          </span>
        )}
      </span>
    )
  }
  const rootProps = {
    disabled,
    required,
    name,
    modal: false,
    open,
    onOpenChange: (next: boolean) => {
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
    },
  }
  const triggerProps = {
    ...label,
    ref: trigger,
    className: 'holly-select-trigger ' + className,
  }
  const chevron = (
    <motion.span
      aria-hidden="true"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    >
      <ChevronDown size={15} />
    </motion.span>
  )
  const popup = (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : -5, scale: reduced ? 1 : 0.98 }}
      animate={{
        opacity: open ? 1 : 0,
        y: open || reduced ? 0 : -5,
        scale: open || reduced ? 1 : 0.98,
      }}
      transition={{ duration: reduced ? 0.1 : 0.18, ease: [0.22, 1, 0.36, 1] }}
    />
  )
  if (searchable) {
    const current = options.find((option) => option.value === selected) ?? null
    return (
      <Combobox.Root
        {...rootProps}
        items={options}
        value={current}
        locale={locale}
        autoHighlight
        filter={(option, query) => contains(option.label, query.trim())}
        isItemEqualToValue={(option, current) => option.value === current.value}
        onValueChange={(option) => {
          if (option) onValueChange(option.value)
        }}
      >
        <Combobox.Trigger {...triggerProps}>
          {optionIcon?.(selected)}
          <span className="holly-select-value">{current?.label}</span>
          {chevron}
        </Combobox.Trigger>
        <Combobox.Portal container={container}>
          <Combobox.Positioner
            align="start"
            sideOffset={6}
            className="holly-select-positioner"
          >
            <Combobox.Popup
              aria-label={label['aria-label']}
              className="holly-select-popup holly-select-searchable"
              render={popup}
            >
              <div className="holly-select-search">
                <Search size={15} aria-hidden="true" />
                <Combobox.Input
                  aria-label={searchLabel}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                />
              </div>
              <Combobox.Empty>
                <div className="holly-select-empty">{t('Aucun résultat')}</div>
              </Combobox.Empty>
              <Combobox.List className="holly-select-list">
                {(option: (typeof options)[number]) => (
                  <Combobox.Item
                    key={option.value}
                    value={option}
                    data-value={option.value}
                    disabled={option.disabled}
                    className="holly-select-option"
                  >
                    {optionIcon?.(option.value)}
                    <span>{option.label}</span>
                    <Combobox.ItemIndicator className="holly-select-check">
                      <Check size={15} aria-hidden="true" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    )
  }
  return (
    <Primitive.Root
      {...rootProps}
      items={options}
      value={selected}
      onValueChange={(next) => {
        if (next != null) onValueChange(next)
      }}
    >
      <Primitive.Trigger
        {...triggerProps}
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
        {chevron}
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
            render={popup}
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
