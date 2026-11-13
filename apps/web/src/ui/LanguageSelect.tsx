import { Languages } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { isLanguagePreference } from '../i18n/messages.ts'
import { Select } from './Select.tsx'

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { t, preference, setPreference } = useI18n()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Languages size={17} className="shrink-0" aria-hidden="true" />
      {!compact && <span>{t('Langue de l’interface')}</span>}
      <Select
        aria-label={t('Langue de l’interface')}
        value={preference}
        onValueChange={(value) => {
          if (isLanguagePreference(value)) setPreference(value)
        }}
      >
        <option value="auto">{t('Langue du navigateur')}</option>
        <option value="en">English</option>
        <option value="zh-Hans">简体中文</option>
        <option value="fr">Français</option>
      </Select>
    </div>
  )
}
