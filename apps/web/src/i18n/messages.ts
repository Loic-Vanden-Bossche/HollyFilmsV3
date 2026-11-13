import en from './en.ts'
import zh from './zh-Hans.ts'

export type Message = keyof typeof en
export type Locale = 'fr' | 'en' | 'zh-Hans'
export type LanguagePreference = Locale | 'auto'
export type MessageValues = Record<string, string | number>
export type Translate = (message: Message, values?: MessageValues) => string

const chinese: Record<Message, string> = zh

export function isLanguagePreference(
  value: unknown,
): value is LanguagePreference {
  return (
    value === 'auto' || value === 'fr' || value === 'en' || value === 'zh-Hans'
  )
}

export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (base === 'zh') return 'zh-Hans'
    if (base === 'fr' || base === 'en') return base
  }
  return 'en'
}

export function translate(
  locale: Locale,
  message: Message,
  values?: MessageValues,
): string {
  const text =
    locale === 'fr' ? message : (locale === 'en' ? en : chinese)[message]
  return values
    ? text.replace(/\{(\w+)\}/g, (token, key: string) => {
        const value = values[key]
        return typeof value === 'number'
          ? value.toLocaleString(locale)
          : (value ?? token)
      })
    : text
}

export function localizeText(t: Translate, value: string, fallback?: Message) {
  if (isMessage(value)) return t(value)
  return fallback ? t(fallback) : value
}

export function isMessage(message: string): message is Message {
  return Object.hasOwn(en, message)
}
