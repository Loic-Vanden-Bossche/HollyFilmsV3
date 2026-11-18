import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { duration, ease } from '../motion/tokens.ts'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import {
  ChevronDown,
  ShieldCheck,
  UserRound,
  Clapperboard,
  Bell,
} from 'lucide-react'
import { ProfileAvatar } from './ProfileAvatar.tsx'
import './account-menu.css'

export function AccountMenu({
  username,
  unreadNotifications = 0,
  avatarUrl,
  isAdmin = false,
}: {
  username: string
  unreadNotifications?: number
  avatarUrl?: string
  isAdmin?: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  return (
    <div
      ref={root}
      className="account-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      <Tooltip disabled={open}>
        <button
          ref={trigger}
          type="button"
          className="account-menu-trigger"
          aria-label={t('Menu du compte : {name}', { name: username })}
          aria-description={
            unreadNotifications
              ? t('Non lues · {count}', { count: unreadNotifications })
              : undefined
          }
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="account-menu-avatar">
            <ProfileAvatar name={username} src={avatarUrl} />
            {unreadNotifications > 0 && (
              <i className="account-unread-dot" aria-hidden="true" />
            )}
          </span>
          <ChevronDown
            size={12}
            className="account-menu-chevron"
            aria-hidden="true"
          />
        </button>
      </Tooltip>
      <AnimatePresence>
        {open && (
          <AccountLinks
            id={id}
            username={username}
            isAdmin={isAdmin}
            unread={unreadNotifications}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function AccountLinks({
  id,
  username,
  isAdmin,
  unread,
}: {
  id: string
  username: string
  isAdmin: boolean
  unread: number
}) {
  const { t } = useI18n()
  const present = useIsPresent()
  const reduced = usePerformanceReducedMotion()
  return (
    <motion.nav
      id={id}
      className="account-menu-panel"
      aria-label={t('Compte')}
      inert={!present}
      initial={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.955 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduced ? 0 : -4, scale: reduced ? 1 : 0.98 }}
      transition={{
        duration: reduced ? duration.press : duration.panel,
        ease: ease.out,
      }}
    >
      <div className="account-menu-heading">
        <strong>{username}</strong>
        <span>{isAdmin ? t('Administrateur') : t('Mon compte')}</span>
      </div>
      <a href="/profile">
        <UserRound size={18} aria-hidden="true" />
        <span>{t('Profil')}</span>
      </a>
      {isAdmin && (
        <a href="/admin">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>{t('Administration')}</span>
        </a>
      )}
      <a href="/requests">
        <Clapperboard size={18} aria-hidden="true" />
        <span>{t('Mes demandes')}</span>
      </a>
      <a href="/notifications">
        <Bell size={18} aria-hidden="true" />
        <span>{t('Notifications')}</span>
        {unread > 0 && (
          <span
            className="account-unread-count"
            aria-label={t('Non lues · {count}', { count: unread })}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </a>
    </motion.nav>
  )
}
