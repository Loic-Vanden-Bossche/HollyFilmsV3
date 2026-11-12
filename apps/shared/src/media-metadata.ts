import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js'

const languageAliases: Record<string, string> = {
  fre: 'fr',
  fra: 'fr',
  eng: 'en',
  ger: 'de',
  deu: 'de',
  spa: 'es',
  ita: 'it',
  por: 'pt',
  jpn: 'ja',
  kor: 'ko',
  chi: 'zh',
  zho: 'zh',
  rus: 'ru',
  ara: 'ar',
  hin: 'hi',
  dut: 'nl',
  nld: 'nl',
  pol: 'pl',
  swe: 'sv',
  dan: 'da',
  nor: 'no',
  fin: 'fi',
  tur: 'tr',
  ukr: 'uk',
  heb: 'he',
  cze: 'cs',
  ces: 'cs',
  gre: 'el',
  ell: 'el',
  rum: 'ro',
  ron: 'ro',
  hun: 'hu',
  tha: 'th',
  vie: 'vi',
  ind: 'id',
}
export function normalizeAudioLanguage(language?: string | null) {
  const value = language?.trim().toLowerCase().replaceAll('_', '-')
  if (!value || ['und', 'unk', 'unknown', 'zxx', 'mul'].includes(value))
    return undefined
  const [base, ...region] = value.split('-')
  return [languageAliases[base] ?? base, ...region].join('-')
}

function edition(name?: string | null) {
  if (!name) return undefined
  const explicit = name.match(/\{edition-([^}]+)\}/i)?.[1]?.trim()
  const label = (explicit ?? name).replace(/[._]/g, ' ')
  if (/\b(version longue|extended(?: edition| cut)?)\b/i.test(label))
    return 'Version longue'
  if (/\bdirector[’']?s?\s+cut\b/i.test(label)) return 'Director’s cut'
  if (/\b(theatrical cut|theatrical edition|version cin[eé]ma)\b/i.test(label))
    return 'Version cinéma'
  if (/\b(uncut|unrated|non censur[eé]e?)\b/i.test(label))
    return 'Version non censurée'
  if (/\b(final cut)\b/i.test(label)) return 'Final cut'
  return explicit || undefined
}

export function mediaMetadata(item: BaseItemDto) {
  const sources = item.MediaSources ?? []
  const streams = [
    ...(item.MediaStreams ?? []),
    ...sources.flatMap((source) => source.MediaStreams ?? []),
  ]
  const video = streams.filter((stream) => stream.Type === 'Video')
  const width = Math.max(0, ...video.map((stream) => stream.Width ?? 0))
  const height = Math.max(0, ...video.map((stream) => stream.Height ?? 0))
  // Width also identifies widescreen releases with cropped black bars.
  const quality =
    width >= 7500 || height >= 4200
      ? '8K'
      : width >= 3800 || height >= 2100
        ? '4K UHD'
        : width >= 2500 || height >= 1400
          ? '1440p'
          : width >= 1900 || height >= 1050
            ? '1080p'
            : width >= 1250 || height >= 700
              ? '720p'
              : width || height
                ? 'SD'
                : undefined
  const audioLanguages = [
    ...new Set(
      streams
        .filter((stream) => stream.Type === 'Audio')
        .map((stream) => normalizeAudioLanguage(stream.Language))
        .filter((language): language is string => Boolean(language)),
    ),
  ]
  const editions = [
    ...new Set(
      sources
        .map((source) => edition(source.Name))
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  return { quality, audioLanguages, editions }
}
