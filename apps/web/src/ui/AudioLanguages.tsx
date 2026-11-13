import { useI18n } from '../i18n/I18nProvider.tsx'
import { languageFlag } from './language-flags.ts'
import { Tooltip } from './Tooltip.tsx'
export function AudioLanguages({ languages }: { languages: string[] }) {
  const { t, locale } = useI18n()
  if (!languages.length) return null
  const names = new Intl.DisplayNames(locale, { type: 'language' })
  const label = (language: string) => {
    try {
      return names.of(language) ?? language
    } catch {
      return language
    }
  }
  const list = new Intl.ListFormat(locale).format(languages.map(label))
  return (
    <Tooltip>
      <span
        className="media-audio-languages"
        aria-label={t('Langues audio : {languages}', { languages: list })}
        title={t('Audio : {languages}', { languages: list })}
      >
        {languages.slice(0, 4).map((language) => {
          const flag = languageFlag(language)
          return (
            <span key={language}>
              {flag ? (
                <img src={flag} alt={label(language)} width={20} height={15} />
              ) : (
                <span className="media-language-code">
                  {language.toUpperCase()}
                </span>
              )}
            </span>
          )
        })}
        {languages.length > 4 && (
          <span className="media-language-more">+{languages.length - 4}</span>
        )}
      </span>
    </Tooltip>
  )
}
