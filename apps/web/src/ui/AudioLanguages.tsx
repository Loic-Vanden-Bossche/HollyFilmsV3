import fr from 'flag-icons/flags/4x3/fr.svg?url'
import gb from 'flag-icons/flags/4x3/gb.svg?url'
import us from 'flag-icons/flags/4x3/us.svg?url'
import ca from 'flag-icons/flags/4x3/ca.svg?url'
import de from 'flag-icons/flags/4x3/de.svg?url'
import es from 'flag-icons/flags/4x3/es.svg?url'
import it from 'flag-icons/flags/4x3/it.svg?url'
import pt from 'flag-icons/flags/4x3/pt.svg?url'
import br from 'flag-icons/flags/4x3/br.svg?url'
import jp from 'flag-icons/flags/4x3/jp.svg?url'
import kr from 'flag-icons/flags/4x3/kr.svg?url'
import cn from 'flag-icons/flags/4x3/cn.svg?url'
import ru from 'flag-icons/flags/4x3/ru.svg?url'
import nl from 'flag-icons/flags/4x3/nl.svg?url'
import pl from 'flag-icons/flags/4x3/pl.svg?url'
import se from 'flag-icons/flags/4x3/se.svg?url'
import inFlag from 'flag-icons/flags/4x3/in.svg?url'
import tr from 'flag-icons/flags/4x3/tr.svg?url'

const flags: Record<string, string> = {
  fr,
  en: gb,
  'en-us': us,
  'fr-ca': ca,
  de,
  es,
  it,
  pt,
  'pt-br': br,
  ja: jp,
  ko: kr,
  zh: cn,
  ru,
  nl,
  pl,
  sv: se,
  hi: inFlag,
  tr,
}
const names = new Intl.DisplayNames(['fr'], { type: 'language' })
function label(language: string) {
  try {
    return names.of(language) ?? language
  } catch {
    return language
  }
}
export function AudioLanguages({ languages }: { languages: string[] }) {
  if (!languages.length) return null
  return (
    <span
      className="media-audio-languages"
      aria-label={'Langues audio : ' + languages.map(label).join(', ')}
      title={'Audio : ' + languages.map(label).join(', ')}
    >
      {languages.slice(0, 4).map((language) => {
        const flag = flags[language] ?? flags[language.split('-')[0]]
        return (
          <span key={language} title={label(language)}>
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
  )
}
