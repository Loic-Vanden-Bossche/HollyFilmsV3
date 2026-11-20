import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  queryOptions,
  useQueries,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type { MediaItem } from '@hollyfilms/shared/library'
import {
  mediaRequest,
  type MediaLocalization,
} from '@hollyfilms/shared/media-details'
import { useI18n } from './i18n/I18nProvider.tsx'
import { localizeText } from './i18n/messages.ts'

type Localizations = {
  items: Record<string, MediaLocalization>
  retry: boolean
}
const localizedMedia = createContext((item: MediaItem) => item)
const normalize = (id: string) => id.replaceAll('-', '').toLowerCase()

function combine(results: UseQueryResult<Localizations>[]) {
  return Object.assign(
    {},
    ...results.map((result) => result.data?.items),
  ) as Record<string, MediaLocalization>
}

export function MediaLocalizations({
  session,
  userId,
  items,
  children,
}: {
  session: JellyfinSession
  userId: string
  items: MediaItem[]
  children: ReactNode
}) {
  const { locale, t } = useI18n()
  const batches = useMemo(() => {
    const batches: string[][] = []
    if (locale === 'fr') return batches
    const ids = [
      ...new Set(
        items.filter((item) => item.hasTmdb).map((item) => normalize(item.id)),
      ),
    ].filter((id) => /^[a-f\d]{32}$/.test(id))
    for (let first = 0; first < ids.length; first += 12)
      batches.push(ids.slice(first, first + 12))
    return batches
  }, [items, locale])
  const translations = useQueries({
    queries: batches.map((ids) =>
      queryOptions({
        queryKey: ['localized-media', session.deviceId, userId, locale, ids],
        queryFn: ({ signal }) =>
          mediaRequest<Localizations>(
            session,
            'localizations?' +
              new URLSearchParams({ locale, ids: ids.join(',') }),
            { signal },
          ),
        staleTime: (query) => (query.state.data?.retry ? 30_000 : 15 * 60_000),
        retry: false,
        refetchOnWindowFocus: false,
      }),
    ),
    combine,
  })
  const apply = useMemo(
    () =>
      (item: MediaItem): MediaItem => {
        if (locale === 'fr') return item
        const translation = translations[normalize(item.id)]
        return {
          ...item,
          title: translation?.title ?? item.title,
          overview: translation?.overview ?? item.overview,
          genres: item.genres.map((genre) => localizeText(t, genre)),
          poster:
            translation?.poster ??
            (translation?.backdrop ? undefined : item.poster),
          backdrop: translation?.backdrop ?? item.backdrop,
          logo: translation ? translation.logo : item.logo,
          thumb: translation ? translation.thumb : item.thumb,
        }
      },
    [locale, t, translations],
  )
  return (
    <localizedMedia.Provider value={apply}>{children}</localizedMedia.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useMediaLocalization() {
  return useContext(localizedMedia)
}
