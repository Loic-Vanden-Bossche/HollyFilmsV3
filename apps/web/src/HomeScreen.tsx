import { useI18n } from './i18n/I18nProvider.tsx'
import { DiscoveryResults } from './ui/DiscoveryResults.tsx'
import type { InfiniteData } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  getLibraryPage,
  getCollectionsPage,
  getCollection,
  getResumeItems,
  setMediaFavorite,
  setMediaWatched,
} from '@hollyfilms/shared/library'
import type { LibraryPage, MediaItem } from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { getMediaDetails } from '@hollyfilms/shared/media-details'
import { PlaybackPlayer } from './PlaybackPlayer.tsx'
import { PlaybackRouteStatus } from './ui/PlaybackRouteStatus.tsx'
import { HomePage } from './HomePage.tsx'
import { useProfile } from './use-profile.ts'
import { useRemoteCommands } from './playback/remote-commands.ts'
import type { RemoteControlMessage } from './playback/remote-commands.ts'
import type { PlaybackTarget, StreamOptions } from './playback/playback-api.ts'
import { navigateApp, useAppRoute } from './use-app-route.ts'
import type { AppRoute } from './app-route.ts'

function savePlaybackLocation(location: Partial<AppRoute>, previousId: string) {
  // A queued player update must not reopen a player closed through browser Back.
  if (new URLSearchParams(window.location.search).get('play') === previousId)
    navigateApp(location, 'progress')
}

function toTarget(item: MediaItem): PlaybackTarget {
  return {
    id: item.id,
    title: item.episode ? item.title + ' · ' + item.episode : item.title,
    kind: item.kind,
    seriesId: item.seriesId,
    start: item.playbackPosition ?? 0,
  }
}

export function HomeScreen({
  session,
  user,
  onSignOut,
  signingOut,
}: {
  session: JellyfinSession
  user: { id: string; name: string; isAdministrator: boolean }
  onSignOut: () => void
  signingOut: boolean
}) {
  const { t } = useI18n()
  const client = useQueryClient()
  const route = useAppRoute()
  // Keep an existing catalogue and its scroll position. A direct player link
  // only needs the catalogue after the viewer returns to it.
  const [libraryMounted, setLibraryMounted] = useState(!route.play)
  if (!route.play && !libraryMounted) setLibraryMounted(true)
  const profile = useProfile(session, libraryMounted)
  const baseUrl = new URL('/jellyfin', window.location.origin).href
  const [playbackSeed, setPlayback] = useState<{
    item: MediaItem
    resume: boolean
    openedAt?: number
    options?: StreamOptions
    queue?: PlaybackTarget[]
    queuedNext?: PlaybackTarget[]
    queuedLast?: PlaybackTarget[]
  } | null>(null)
  const [selectedSeed, setSelectedSeed] = useState<MediaItem | null>(null)
  const selectedDetails = useQuery({
    queryKey: ['media-details', session.deviceId, user.id, route.media],
    queryFn: ({ signal }) =>
      getMediaDetails(baseUrl, session, user.id, route.media!, signal),
    enabled: !!route.media && !route.play && selectedSeed?.id !== route.media,
    staleTime: 60_000,
    retry: false,
  })
  const playingDetails = useQuery({
    queryKey: ['media-details', session.deviceId, user.id, route.play],
    queryFn: ({ signal }) =>
      getMediaDetails(baseUrl, session, user.id, route.play!, signal),
    enabled: !!route.play && playbackSeed?.item.id !== route.play,
    staleTime: 60_000,
    retry: false,
  })
  const playingItem =
    playbackSeed && playbackSeed.item.id === route.play
      ? playbackSeed.item
      : playingDetails.data?.item
  const playback =
    route.play && playingItem
      ? {
          ...(playbackSeed?.item.id === route.play ? playbackSeed : {}),
          item: {
            ...playingItem,
            playbackPosition: route.time ?? playingItem.playbackPosition,
          },
          resume: true,
          options: {
            ...(playbackSeed?.item.id === route.play
              ? playbackSeed.options
              : {}),
            sourceId: route.source,
            audio: route.audio,
            subtitle: route.subtitle,
          },
        }
      : null
  const selected = route.media
    ? selectedSeed?.id === route.media
      ? selectedSeed
      : (selectedDetails.data?.item ?? null)
    : null
  const selectItem = useCallback((item: MediaItem | null) => {
    setSelectedSeed(item)
    navigateApp({ media: item?.id })
  }, [])
  const [remoteCommand, setRemoteCommand] = useState<RemoteControlMessage>()
  useRemoteCommands(session, user.id, {
    control: setRemoteCommand,
    play(items, request) {
      const selected = items[request.StartIndex ?? 0] ?? items[0]
      const item = {
        ...selected,
        playbackPosition: (request.StartPositionTicks ?? 0) / 10_000_000,
      }
      const queue = items.map(toTarget)
      setRemoteCommand(undefined)
      if (playback && request.PlayCommand === 'PlayNext') {
        setPlayback({
          ...playback,
          queuedNext: [...queue, ...(playback.queuedNext ?? [])],
        })
        return
      }
      if (playback && request.PlayCommand === 'PlayLast') {
        setPlayback({
          ...playback,
          queuedLast: [...(playback.queuedLast ?? []), ...queue],
        })
        return
      }
      setPlayback(() => ({
        item,
        resume: true,
        openedAt: Date.now(),
        queue,
        options: {
          sourceId: request.MediaSourceId ?? undefined,
          audio: request.AudioStreamIndex ?? undefined,
          subtitle: request.SubtitleStreamIndex ?? undefined,
          forceTranscode: request.AudioStreamIndex != null,
        },
      }))
      navigateApp({
        play: item.id,
        time: item.playbackPosition,
        source: request.MediaSourceId ?? undefined,
        audio: request.AudioStreamIndex ?? undefined,
        subtitle: request.SubtitleStreamIndex ?? undefined,
        paused: false,
      })
    },
  })
  const { filter, search } = route
  const collectionsIndex = filter === 'collections' && !route.collection
  const sort = route.sort ?? 'recent'
  const collection = useQuery({
    queryKey: ['collection', session.deviceId, user.id, route.collection],
    queryFn: ({ signal }) =>
      getCollection(baseUrl, session, user.id, route.collection!, signal),
    enabled: libraryMounted && filter === 'collections' && !!route.collection,
    staleTime: 300_000,
    retry: false,
  })
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim())
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(timeout)
  }, [search])
  const collections = useInfiniteQuery({
    queryKey: ['collections', session.deviceId, user.id, debouncedSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getCollectionsPage(
        baseUrl,
        session,
        user.id,
        pageParam,
        debouncedSearch,
        signal,
      ),
    getNextPageParam: (page, pages) =>
      pages.length * 24 < page.total ? pages.length * 24 : undefined,
    enabled: libraryMounted && collectionsIndex,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const library = useInfiniteQuery({
    queryKey: [
      'library',
      session.deviceId,
      user.id,
      filter,
      '',
      sort,
      route.collection,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getLibraryPage(baseUrl, session, user.id, filter, '', pageParam, signal, {
        sort,
        collectionId: route.collection,
      }),
    getNextPageParam: (page, pages) =>
      pages.length * 36 < page.total ? pages.length * 36 : undefined,
    retry: false,
    gcTime: 300_000,
    enabled:
      libraryMounted &&
      !collectionsIndex &&
      (!route.collection || collection.isSuccess),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const searchLibrary = useInfiniteQuery({
    queryKey: [
      'library',
      session.deviceId,
      user.id,
      filter,
      debouncedSearch,
      sort,
      route.collection,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getLibraryPage(
        baseUrl,
        session,
        user.id,
        filter,
        debouncedSearch,
        pageParam,
        signal,
        { sort, collectionId: route.collection },
      ),
    getNextPageParam: (page, pages) =>
      pages.length * 36 < page.total ? pages.length * 36 : undefined,
    enabled:
      libraryMounted &&
      !collectionsIndex &&
      Boolean(search.trim() && debouncedSearch) &&
      (!route.collection || collection.isSuccess),
    retry: false,
    gcTime: 60_000,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const resume = useQuery({
    queryKey: [
      'library-resume',
      session.deviceId,
      user.id,
      filter === 'series' ? 'episodes' : 'all',
    ],
    queryFn: ({ signal }) =>
      getResumeItems(baseUrl, session, user.id, signal, {
        episodesOnly: filter === 'series',
      }),
    retry: false,
    gcTime: 300_000,
    enabled: libraryMounted && (filter === 'all' || filter === 'series'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const items = [
    ...new Map(
      library.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    ).values(),
  ].filter((item) => filter !== 'favorites' || item.favorite)
  function patchItem(
    id: string,
    patch: Partial<MediaItem>,
    removeResume = false,
  ) {
    client.setQueriesData<InfiniteData<LibraryPage>>(
      { queryKey: ['library', session.deviceId, user.id] },
      (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.id === id ? { ...item, ...patch } : item,
                ),
              })),
            }
          : data,
    )
    client.setQueriesData<MediaItem[]>(
      { queryKey: ['library-resume', session.deviceId, user.id] },
      (data) =>
        data?.flatMap((item) =>
          item.id === id
            ? removeResume
              ? []
              : [{ ...item, ...patch }]
            : [item],
        ),
    )
  }
  const searching = search.trim() !== debouncedSearch
  const pageData = collectionsIndex ? collections : library
  const pageState =
    route.collection && collection.isError
      ? 'error'
      : (collectionsIndex && searching) ||
          pageData.isPending ||
          (route.collection && collection.isPending)
        ? 'loading'
        : pageData.isError && !pageData.data
          ? 'error'
          : 'ready'
  const player = playback ? (
    <PlaybackPlayer
      key={JSON.stringify([
        route.play,
        route.time,
        route.source,
        route.audio,
        route.subtitle,
        route.secondarySubtitle,
        route.paused,
        playback.openedAt,
      ])}
      item={playback.item}
      userId={user.id}
      resume={playback.resume}
      initialPaused={route.paused}
      initialSecondarySubtitle={route.secondarySubtitle}
      onLocationChange={savePlaybackLocation}
      session={session}
      initialOptions={playback.options}
      initialQueue={playback.queue}
      queuedNext={playback.queuedNext}
      queuedLast={playback.queuedLast}
      remoteCommand={remoteCommand}
      onClose={() => {
        setRemoteCommand(undefined)
        setPlayback(null)
        navigateApp({ play: undefined })
        void client.invalidateQueries({ queryKey: ['library'] })
        void client.invalidateQueries({ queryKey: ['library-resume'] })
        void client.invalidateQueries({
          queryKey: ['jellyfin', 'current-user'],
        })
      }}
    />
  ) : route.play ? (
    <PlaybackRouteStatus
      onClose={() => navigateApp({ play: undefined })}
      failure={
        playingDetails.isError
          ? {
              message: t('Ce média est indisponible ou tu n’y as pas accès.'),
              retry: () => void playingDetails.refetch(),
            }
          : undefined
      }
    />
  ) : null

  if (!libraryMounted) return player
  return (
    <>
      <HomePage
        avatarUrl={profile.avatarUrl}
        collectionId={route.collection}
        collection={collection.data}
        collections={
          collections.data?.pages.flatMap((page) => page.items) ?? []
        }
        sort={sort}
        onSort={(sort) => navigateApp({ sort }, 'replace')}
        onCollection={(id) =>
          navigateApp({
            filter: 'collections',
            collection: id,
            search: '',
            sort: undefined,
          })
        }
        onPlay={(item, resume, queue) => {
          setRemoteCommand(undefined)
          setPlayback({
            item,
            resume,
            openedAt: Date.now(),
            queue: queue?.map(toTarget),
          })
          navigateApp({
            play: item.id,
            time: resume ? (item.playbackPosition ?? 0) : 0,
            source: undefined,
            audio: undefined,
            subtitle: undefined,
            paused: false,
          })
        }}
        username={user.name}
        isAdmin={user.isAdministrator}
        session={session}
        userId={user.id}
        playbackOpen={Boolean(route.play)}
        selectedItem={route.play ? null : selected}
        onSelectItem={selectItem}
        onFavorite={async (item, favorite) => {
          const saved = await setMediaFavorite(
            baseUrl,
            session,
            user.id,
            item.id,
            favorite,
          )
          patchItem(item.id, { favorite: saved })
          void client.invalidateQueries({
            queryKey: ['library', session.deviceId, user.id, 'favorites'],
          })
          return saved
        }}
        onWatched={async (item, watched) => {
          const saved = await setMediaWatched(
            baseUrl,
            session,
            user.id,
            item.id,
            watched,
          )
          patchItem(
            item.id,
            {
              watched: saved,
              progress: saved ? 1 : 0,
              playbackPosition: 0,
              remainingMinutes: undefined,
            },
            true,
          )
          void client.invalidateQueries({
            queryKey: ['library', session.deviceId, user.id],
          })
          void client.invalidateQueries({
            queryKey: ['library-resume', session.deviceId, user.id],
          })
          return saved
        }}
        items={items}
        searchResults={{
          items: searching
            ? []
            : [
                ...new Map(
                  searchLibrary.data?.pages
                    .flatMap((page) => page.items)
                    .map((item) => [item.id, item]),
                ).values(),
              ].filter((item) => filter !== 'favorites' || item.favorite),
          total: searching ? 0 : (searchLibrary.data?.pages[0].total ?? 0),
          state:
            searching || searchLibrary.isPending
              ? 'loading'
              : searchLibrary.isError && !searchLibrary.data
                ? 'error'
                : 'ready',
          hasMore: searchLibrary.hasNextPage,
          loadingMore: searchLibrary.isFetchingNextPage,
          loadMoreError: searchLibrary.isFetchNextPageError,
          onLoadMore: () => {
            if (!searching)
              void searchLibrary.fetchNextPage({ cancelRefetch: false })
          },
          onRetry: () => void searchLibrary.refetch(),
        }}
        discovery={
          <DiscoveryResults
            userId={user.id}
            session={session}
            query={search}
            administrator={user.isAdministrator}
            type={
              filter === 'movies'
                ? 'movie'
                : filter === 'series'
                  ? 'tv'
                  : undefined
            }
          />
        }
        resumeItems={resume.data ?? []}
        resumeError={resume.isError}
        state={pageState}
        total={pageData.data?.pages[0].total ?? 0}
        filter={filter}
        search={search}
        hasMore={pageData.hasNextPage}
        loadingMore={pageData.isFetchingNextPage}
        loadMoreError={pageData.isFetchNextPageError}
        onFilter={(filter) =>
          navigateApp({
            filter,
            search: '',
            collection: undefined,
            sort: undefined,
          })
        }
        onSearch={(search) => navigateApp({ search }, 'replace')}
        onLoadMore={() => void pageData.fetchNextPage({ cancelRefetch: false })}
        onRetry={() => {
          void pageData.refetch()
          if (route.collection) void collection.refetch()
          if (filter === 'all' || filter === 'series') void resume.refetch()
        }}
        onSignOut={onSignOut}
        signingOut={signingOut}
      />
      {!route.play && route.media && !selected && (
        <div className="glass-panel fixed inset-x-4 bottom-6 z-50 mx-auto max-w-lg rounded-2xl p-5">
          <p role={selectedDetails.isError ? 'alert' : 'status'}>
            {selectedDetails.isError
              ? t('Ce média est indisponible ou tu n’y as pas accès.')
              : t('Ouverture du média…')}
          </p>
          <div className="mt-4 flex gap-4">
            {selectedDetails.isError && (
              <button
                className="detail-text-button"
                onClick={() => void selectedDetails.refetch()}
              >
                {t('Réessayer')}
              </button>
            )}
            <button
              className="detail-text-button"
              onClick={() => navigateApp({ media: undefined })}
            >
              {t('Fermer')}
            </button>
          </div>
        </div>
      )}
      {player}
    </>
  )
}
