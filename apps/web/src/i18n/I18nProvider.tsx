import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  detectLocale,
  isLanguagePreference,
  translate,
  type LanguagePreference,
  type Locale,
  type Translate,
} from './messages.ts'

const storageKey = 'hollyfilms.language'
const description =
  'HollyFilms. Consultez le catalogue de films et séries de notre bibliothèque et créez votre compte. Accès après approbation.'

function readPreference(): LanguagePreference {
  try {
    const stored = localStorage.getItem(storageKey)
    if (isLanguagePreference(stored)) return stored
  } catch {
    // Some browsers block persistent storage.
  }
  return 'auto'
}

function browserLocale() {
  return detectLocale(
    navigator.languages.length ? navigator.languages : [navigator.language],
  )
}

type I18n = {
  locale: Locale
  preference: LanguagePreference
  setPreference: (preference: LanguagePreference) => void
  t: Translate
}

const Context = createContext<I18n>({
  locale: 'fr',
  preference: 'auto',
  setPreference: () => {},
  t: (message, values) => translate('fr', message, values),
})

export function I18nProvider({
  children,
  initialPreference,
}: {
  children: ReactNode
  /** Storybook can isolate its language from the browser's saved preference. */
  initialPreference?: LanguagePreference
}) {
  const [preference, setPreference] = useState(
    () => initialPreference ?? readPreference(),
  )
  const [detected, setDetected] = useState(browserLocale)
  const locale = preference === 'auto' ? detected : preference
  useEffect(() => {
    const update = () => setDetected(browserLocale())
    window.addEventListener('languagechange', update)
    return () => window.removeEventListener('languagechange', update)
  }, [])
  useEffect(() => {
    if (initialPreference !== undefined) return
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setPreference(readPreference())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [initialPreference])
  const value = useMemo<I18n>(
    () => ({
      locale,
      preference,
      t: (message, values) => translate(locale, message, values),
      setPreference: (next) => {
        setPreference(next)
        if (initialPreference !== undefined) return
        try {
          localStorage.setItem(storageKey, next)
        } catch {
          // The preference still applies in the current tab.
        }
      },
    }),
    [locale, preference, initialPreference],
  )
  useEffect(() => {
    document.documentElement.lang = locale
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', translate(locale, description))
  }, [locale])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useI18n() {
  return useContext(Context)
}
