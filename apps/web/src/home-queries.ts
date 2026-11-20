import { queryOptions, type QueryClient } from '@tanstack/react-query'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import {
  getLibraryPage,
  getResumeItems,
  type LibrarySort,
} from '@hollyfilms/shared/library'

export function homeShelfQuery(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  filter: 'all' | 'movies' | 'series',
  sort: LibrarySort,
) {
  return queryOptions({
    queryKey: ['home-shelf', session.deviceId, userId, filter, sort],
    queryFn: ({ signal }) =>
      getLibraryPage(baseUrl, session, userId, filter, '', 0, signal, { sort }),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function resumeQuery(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  episodesOnly: boolean,
) {
  return queryOptions({
    queryKey: [
      'library-resume',
      session.deviceId,
      userId,
      episodesOnly ? 'episodes' : 'all',
    ],
    queryFn: ({ signal }) =>
      getResumeItems(baseUrl, session, userId, signal, { episodesOnly }),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function prefetchHomeRows(
  client: QueryClient,
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
) {
  void client.prefetchQuery(
    homeShelfQuery(baseUrl, session, userId, 'all', 'recent'),
  )
  void client.prefetchQuery(resumeQuery(baseUrl, session, userId, false))
}
