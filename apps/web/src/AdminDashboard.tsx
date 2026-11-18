import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Captions,
  Clapperboard,
  ClipboardList,
  Users,
} from 'lucide-react'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { useI18n } from './i18n/I18nProvider.tsx'
import { AdminPage } from './AdminPage.tsx'
import { AdminUsers } from './AdminUsers.tsx'
import { RequestsPage } from './RequestsPage.tsx'
import { SubtitleRequests } from './SubtitleRequests.tsx'
import { Wordmark } from './ui/Wordmark.tsx'
import './admin.css'

const sections = {
  users: { label: 'Utilisateurs', icon: Users },
  registrations: { label: 'Inscriptions', icon: ClipboardList },
  media: { label: 'Demandes de médias', icon: Clapperboard },
  subtitles: { label: 'Demandes de sous-titres', icon: Captions },
} as const
type Section = keyof typeof sections

function sectionFromLocation(): Section {
  const { pathname, search } = window.location
  const section = new URLSearchParams(search).get('section')
  if (/^\/admin\/requests\/?$/.test(pathname))
    return section === 'subtitles' ? 'subtitles' : 'media'
  if (
    section === 'registrations' ||
    section === 'media' ||
    section === 'subtitles'
  )
    return section
  return 'users'
}

export function AdminDashboard({
  session,
  initialSection,
}: {
  session: JellyfinSession
  initialSection?: Section
}) {
  const { t } = useI18n()
  const [section, setSection] = useState(
    () => initialSection ?? sectionFromLocation(),
  )
  useEffect(() => {
    if (initialSection) return
    const syncSection = () => setSection(sectionFromLocation())
    window.addEventListener('popstate', syncSection)
    return () => window.removeEventListener('popstate', syncSection)
  }, [initialSection])

  return (
    <div className="admin-dashboard">
      <header className="admin-topbar">
        <a href="/app" aria-label={t('Retour à la bibliothèque')}>
          <Wordmark compact />
        </a>
        <a href="/app" className="admin-back">
          <ArrowLeft size={16} aria-hidden="true" /> {t('Catalogue')}
        </a>
      </header>
      <h1>{t('Administration')}</h1>
      <div className="admin-layout">
        <nav aria-label={t('Administration')} className="admin-navigation">
          {(Object.keys(sections) as Section[]).map((key) => {
            const { label, icon: Icon } = sections[key]
            const href = key === 'users' ? '/admin' : `/admin?section=${key}`
            return (
              <a
                key={key}
                href={href}
                aria-current={section === key ? 'page' : undefined}
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return
                  event.preventDefault()
                  if (
                    !initialSection &&
                    location.pathname + location.search !== href
                  )
                    window.history.pushState(null, '', href)
                  setSection(key)
                }}
              >
                <Icon size={19} aria-hidden="true" />
                {t(label)}
              </a>
            )
          })}
        </nav>
        <div className="admin-content">
          {section === 'users' && <AdminUsers session={session} />}
          {section === 'registrations' && <AdminPage session={session} />}
          {section === 'media' && (
            <RequestsPage session={session} administrator embedded />
          )}
          {section === 'subtitles' && (
            <SubtitleRequests session={session} administrator embedded />
          )}
        </div>
      </div>
    </div>
  )
}
