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
  setMediaFavorite,
  setMediaWatched,
} from '@hollyfilms/shared/library'
import type {
  LibraryPage,
  LibrarySort,
  MediaItem,
} from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { getMediaDetails } from '@hollyfilms/shared/media-details'
import { PlaybackRouteStatus } from './ui/PlaybackRouteStatus.tsx'
import { HomePage } from './HomePage.tsx'
import { homeShelfQuery, resumeQuery } from './home-queries.ts'
import { ArtworkRoutes } from './ui/artwork-hero-context.ts'
import { useProfile } from './use-profile.ts'
import { useNotificationInbox } from './notification-inbox.ts'
import { useRemoteCommands } from './playback/remote-commands.ts'
import type { RemoteControlMessage } from './playback/remote-commands.ts'
import type { PlaybackTarget, StreamOptions } from './playback/playback-api.ts'
import { navigateApp, onRouteRender, useAppRoute } from './use-app-route.ts'
import type { AppRoute } from './app-route.ts'

const playerModuleQuery = {
  queryKey: ['player-module'],
  queryFn: () => import('./PlaybackPlayer.tsx'),
  staleTime: Infinity,
  retry: false,
}

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

function useHomeShelfPage(
  baseUrl: string,
  session: JellyfinSession,
  userId: string,
  filter: 'all' | 'movies' | 'series',
  sort: LibrarySort,
  enabled: boolean,
) {
  return useQuery({
    ...homeShelfQuery(baseUrl, session, userId, filter, sort),
    enabled,
  })
}

export function HomeScreen({
  session,
  routeOpenedAt,
  user,
  onSignOut,
  signingOut,
}: {
  session: JellyfinSession
  routeOpenedAt?: number
  user: { id: string; name: string; isAdministrator: boolean }
  onSignOut: () => void
  signingOut: boolean
}) {
  const { t } = useI18n()
  const client = useQueryClient()
  const route = useAppRoute(routeOpenedAt)
  // Mount at chunk readiness, including on touch where there is no hover lead.
  const playerModule = useQuery({ ...playerModuleQuery, enabled: !!route.play })
  const PlaybackPlayer = playerModule.data?.PlaybackPlayer
  useEffect(() => {
    if (route.play || PlaybackPlayer) return
    // Only the play controls express intent. Browsing artwork must stay cheap.
    const events = new AbortController()
    const onIntent = (event: Event) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('[data-artwork-open="player"]')) return
      void client.prefetchQuery(playerModuleQuery)
      events.abort()
    }
    for (const type of ['pointerover', 'pointerdown', 'focusin']) {
      document.addEventListener(type, onIntent, { signal: events.signal })
    }
    return () => events.abort()
  }, [client, route.play, PlaybackPlayer])
  // Keep an existing catalogue and its scroll position. A direct player link
  // only needs the catalogue after the viewer returns to it.
  const [libraryMounted, setLibraryMounted] = useState(!route.play)
  if (!route.play && !libraryMounted) setLibraryMounted(true)
  const profile = useProfile(session, libraryMounted)
  const inbox = useNotificationInbox(
    session,
    user.id,
    !route.play && !signingOut,
  )
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
  const selectItem = useCallback(
    (item: MediaItem | null) => {
      onRouteRender(() => setSelectedSeed(item))
      navigateApp({ media: item?.id })
      if (item)
        void client.prefetchQuery({
          queryKey: ['media-details', session.deviceId, user.id, item.id],
          queryFn: ({ signal }) =>
            getMediaDetails(baseUrl, session, user.id, item.id, signal),
          staleTime: 60_000,
          retry: false,
        })
    },
    [baseUrl, client, session, user.id],
  )
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
  const home = filter === 'all'
  const homeActive = home && libraryMounted && !route.play && !search.trim()
  const recent = useHomeShelfPage(
    baseUrl,
    session,
    user.id,
    'all',
    'recent',
    homeActive,
  )
  // A small library already fits in the first page. Larger libraries supply
  // two more first pages so older films and series can make the selection.
  const supplement = Boolean(
    recent.data && recent.data.total > recent.data.items.length,
  )
  const ratedMovies = useHomeShelfPage(
    baseUrl,
    session,
    user.id,
    'movies',
    'rating',
    homeActive && supplement,
  )
  const recentSeries = useHomeShelfPage(
    baseUrl,
    session,
    user.id,
    'series',
    'recent',
    homeActive && supplement,
  )
  const collection = useQuery({
    queryKey: ['collection', session.deviceId, user.id, route.collection],
    queryFn: ({ signal }) =>
      getCollection(baseUrl, session, user.id, route.collection!, signal),
    enabled: libraryMounted && filter === 'collections' && !!route.collection,
    staleTime: 300_000,
    retry: false,
  })
  const searchTerm = search.trim()
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm)
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchTerm), 120)
    return () => clearTimeout(timeout)
  }, [searchTerm])
  const searchSettled = searchTerm === debouncedSearch
  const collections = useInfiniteQuery({
    queryKey: ['collections', session.deviceId, user.id, searchTerm],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getCollectionsPage(
        baseUrl,
        session,
        user.id,
        pageParam,
        searchTerm,
        signal,
      ),
    getNextPageParam: (page, pages) =>
      pages.length * 24 < page.total ? pages.length * 24 : undefined,
    enabled: libraryMounted && collectionsIndex && searchSettled,
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
    placeholderData: (previous, query) =>
      query?.queryKey[1] === session.deviceId &&
      query.queryKey[2] === user.id &&
      query.queryKey[3] === filter &&
      query.queryKey[6] === route.collection
        ? previous
        : undefined,
    getNextPageParam: (page, pages) =>
      pages.length * 36 < page.total ? pages.length * 36 : undefined,
    retry: false,
    gcTime: 300_000,
    enabled:
      libraryMounted &&
      !home &&
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
      searchTerm,
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
        searchTerm,
        pageParam,
        signal,
        { sort, collectionId: route.collection },
      ),
    getNextPageParam: (page, pages) =>
      pages.length * 36 < page.total ? pages.length * 36 : undefined,
    enabled:
      libraryMounted &&
      !collectionsIndex &&
      Boolean(searchTerm) &&
      searchSettled &&
      (!route.collection || collection.isSuccess),
    retry: false,
    gcTime: 60_000,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const resume = useQuery({
    ...resumeQuery(baseUrl, session, user.id, filter === 'series'),
    enabled: libraryMounted && (filter === 'all' || filter === 'series'),
  })
  const items = home
    ? (recent.data?.items ?? [])
    : [
        ...new Map(
          library.data?.pages
            .flatMap((page) => page.items)
            .map((item) => [item.id, item]),
        ).values(),
      ].filter((item) => filter !== 'favorites' || item.favorite)
  const patchItem = useCallback(
    (id: string, patch: Partial<MediaItem>, removeResume = false) => {
      const patchPage = (page: LibraryPage) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      })
      client.setQueriesData<LibraryPage>(
        { queryKey: ['home-shelf', session.deviceId, user.id] },
        (data) => data && patchPage(data),
      )
      client.setQueriesData<InfiniteData<LibraryPage>>(
        { queryKey: ['library', session.deviceId, user.id] },
        (data) =>
          data
            ? {
                ...data,
                pages: data.pages.map(patchPage),
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
    },
    [client, session.deviceId, user.id],
  )
  const onPlay = useCallback(
    (item: MediaItem, resume: boolean, queue?: MediaItem[]) => {
      onRouteRender(() => {
        setRemoteCommand(undefined)
        setPlayback({
          item,
          resume,
          openedAt: Date.now(),
          queue: queue?.map(toTarget),
        })
      })
      navigateApp({
        play: item.id,
        time: resume ? (item.playbackPosition ?? 0) : 0,
        source: undefined,
        audio: undefined,
        subtitle: undefined,
        paused: false,
      })
    },
    [],
  )
  const onFavorite = useCallback(
    async (item: MediaItem, favorite: boolean) => {
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
    },
    [baseUrl, client, patchItem, session, user.id],
  )
  const onWatched = useCallback(
    async (item: MediaItem, watched: boolean) => {
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
    },
    [baseUrl, client, patchItem, session, user.id],
  )
  const pageData = collectionsIndex ? collections : library
  const visibleQuery = home ? recent : pageData
  const pageState =
    route.collection && collection.isError
      ? 'error'
      : visibleQuery.isPending || (route.collection && collection.isPending)
        ? 'loading'
        : visibleQuery.isError && !visibleQuery.data
          ? 'error'
          : 'ready'
  const openingPlayer = route.play ? (
    <PlaybackRouteStatus
      openedAt={route.openedAt}
      onRestartOpening={route.restartOpening}
      onRetry={() =>
        void client.resetQueries({
          queryKey: ['media-details', session.deviceId, user.id, route.play],
          exact: true,
        })
      }
      onClose={() => navigateApp({ play: undefined })}
      failure={
        playerModule.isError
          ? {
              message: t('Chargement indisponible'),
              retry: () => void playerModule.refetch(),
            }
          : playingDetails.isError
            ? {
                message: t('Ce média est indisponible ou tu n’y as pas accès.'),
                retry: () => void playingDetails.refetch(),
              }
            : undefined
      }
    />
  ) : null
  const player =
    playback && PlaybackPlayer ? (
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
        openedAt={playback.openedAt ?? route.openedAt}
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
            queryKey: ['home-shelf', session.deviceId, user.id],
          })
          void client.invalidateQueries({
            queryKey: ['jellyfin', 'current-user'],
          })
        }}
      />
    ) : (
      openingPlayer
    )

  if (!libraryMounted) return player
  return (
    <ArtworkRoutes value>
      <HomePage
        avatarUrl={profile.avatarUrl}
        collectionId={route.collection}
        collection={collection.data}
        collections={
          collections.data?.pages.flatMap((page) => page.items) ?? []
        }
        sort={sort}
        updatingOrder={!collectionsIndex && library.isPlaceholderData}
        onSort={(sort) => navigateApp({ sort }, 'replace')}
        onCollection={(id) =>
          navigateApp({
            filter: 'collections',
            collection: id,
            search: '',
            sort: undefined,
          })
        }
        onPlay={onPlay}
        username={profile.data?.name ?? user.name}
        unreadNotifications={inbox.data?.pages[0]?.unread}
        isAdmin={user.isAdministrator}
        session={session}
        userId={user.id}
        playbackOpen={Boolean(route.play)}
        selectedItem={route.play ? null : selected}
        onSelectItem={selectItem}
        onFavorite={onFavorite}
        onWatched={onWatched}
        items={items}
        ratedMovies={supplement ? ratedMovies.data?.items : undefined}
        loadingRatings={supplement && ratedMovies.isLoading}
        recentSeries={supplement ? recentSeries.data?.items : undefined}
        loadingSeries={supplement && recentSeries.isLoading}
        searchResults={{
          items: !searchTerm
            ? []
            : [
                ...new Map(
                  searchLibrary.data?.pages
                    .flatMap((page) => page.items)
                    .map((item) => [item.id, item]),
                ).values(),
              ].filter((item) => filter !== 'favorites' || item.favorite),
          total: searchTerm ? (searchLibrary.data?.pages[0].total ?? 0) : 0,
          state: searchLibrary.isPending
            ? 'loading'
            : searchLibrary.isError && !searchLibrary.data
              ? 'error'
              : 'ready',
          hasMore: searchLibrary.hasNextPage,
          loadingMore: searchLibrary.isFetchingNextPage,
          loadMoreError: searchLibrary.isFetchNextPageError,
          onLoadMore: () => {
            if (searchLibrary.hasNextPage)
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
        total={(home ? recent.data?.total : pageData.data?.pages[0].total) ?? 0}
        filter={filter}
        search={search}
        hasMore={!pageData.isPlaceholderData && pageData.hasNextPage}
        loadingMore={pageData.isFetchingNextPage}
        loadMoreError={pageData.isFetchNextPageError}
        onFilter={(filter, nextSort) =>
          navigateApp({
            filter,
            search: '',
            collection: undefined,
            sort: nextSort,
          })
        }
        onSearch={(search) => navigateApp({ search }, 'replace')}
        onLoadMore={() => void pageData.fetchNextPage({ cancelRefetch: false })}
        onRetry={() => {
          if (home) void recent.refetch()
          else void pageData.refetch()
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
    </ArtworkRoutes>
  )
}
