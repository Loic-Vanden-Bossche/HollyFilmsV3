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
import { normalizeAudioLanguage } from '@hollyfilms/shared/library'

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
export function languageFlag(language?: string | null) {
  const normalized = normalizeAudioLanguage(language)
  return normalized
    ? (flags[normalized] ?? flags[normalized.split('-')[0]])
    : undefined
}
