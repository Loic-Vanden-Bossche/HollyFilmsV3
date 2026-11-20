import type { MediaLocalization } from '@hollyfilms/shared/media-details'

export const mediaLocales = {
  en: { language: 'en', regions: ['US', 'GB', 'CA', 'AU'] },
  'zh-Hans': { language: 'zh', regions: ['CN', 'SG'] },
} as const

export type MediaLocale = keyof typeof mediaLocales

type TmdbImage = { iso_639_1?: string | null; file_path?: string }
type Translation = {
  iso_639_1?: string
  iso_3166_1?: string
  data?: { title?: string; name?: string; overview?: string }
}
export type TmdbLocalizedDetails = {
  title?: string
  name?: string
  overview?: string
  original_title?: string
  original_name?: string
  translations?: { translations?: Translation[] }
  images?: {
    posters?: TmdbImage[]
    backdrops?: TmdbImage[]
    logos?: TmdbImage[]
  }
}

export function localizeTmdb(data: TmdbLocalizedDetails, locale: MediaLocale) {
  const { language, regions } = mediaLocales[locale]
  const translations = regions.flatMap((region) =>
    (data.translations?.translations ?? [])
      .filter(
        (entry) => entry.iso_639_1 === language && entry.iso_3166_1 === region,
      )
      .flatMap((entry) => entry.data ?? []),
  )
  const image = (
    list: TmdbImage[] | undefined,
    lang: string | null,
    size: string,
  ) => {
    const path = list?.find(
      (entry) =>
        entry.iso_639_1 === lang &&
        /^\/[\w.-]+\.(?:jpg|png|webp)$/i.test(entry.file_path ?? ''),
    )?.file_path
    return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined
  }
  const localization: MediaLocalization = {
    // TMDB often leaves the English translation title blank when it matches
    // the original. The main details were requested with language=en-US.
    title:
      translations
        .map((entry) => entry.title?.trim() || entry.name?.trim())
        .find(Boolean) ||
      (locale === 'en'
        ? data.title?.trim() ||
          data.name?.trim() ||
          data.original_title?.trim() ||
          data.original_name?.trim()
        : undefined),
    overview:
      translations.map((entry) => entry.overview?.trim()).find(Boolean) ||
      (locale === 'en' ? data.overview?.trim() : undefined),
    poster: image(data.images?.posters, language, 'w500'),
    thumb: image(data.images?.backdrops, language, 'w780'),
    backdrop: image(data.images?.backdrops, null, 'w1280'),
    logo: image(data.images?.logos, language, 'w500'),
  }
  return Object.values(localization).some(Boolean) ? localization : undefined
}
