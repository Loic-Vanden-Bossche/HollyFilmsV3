import type { InfiniteData } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  getLibraryPage,
  getResumeItems,
  setMediaFavorite,
  setMediaWatched,
} from '@hollyfilms/shared/library'
import type {
  LibraryFilter,
  LibraryPage,
  MediaItem,
} from '@hollyfilms/shared/library'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import { PlaybackPlayer } from './PlaybackPlayer.tsx'
import { HomePage } from './HomePage.tsx'
import { useRemoteCommands } from './playback/remote-commands.ts'
import type { RemoteControlMessage } from './playback/remote-commands.ts'
import type { PlaybackTarget, StreamOptions } from './playback/playback-api.ts'

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
  const client = useQueryClient()
  const [playback, setPlayback] = useState<{
    item: MediaItem
    resume: boolean
    openedAt?: number
    options?: StreamOptions
    queue?: PlaybackTarget[]
    queuedNext?: PlaybackTarget[]
    queuedLast?: PlaybackTarget[]
  } | null>(null)
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
      setPlayback((current) => {
        if (current && request.PlayCommand === 'PlayNext')
          return {
            ...current,
            queuedNext: [...queue, ...(current.queuedNext ?? [])],
          }
        if (current && request.PlayCommand === 'PlayLast')
          return {
            ...current,
            queuedLast: [...(current.queuedLast ?? []), ...queue],
          }
        return {
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
        }
      })
    },
  })
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(timeout)
  }, [search])
  const baseUrl = new URL('/jellyfin', window.location.origin).href
  const library = useInfiniteQuery({
    queryKey: ['library', session.deviceId, user.id, filter, debouncedSearch],
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
      ),
    getNextPageParam: (page, pages) =>
      pages.length * 36 < page.total ? pages.length * 36 : undefined,
    retry: false,
    gcTime: 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const resume = useQuery({
    queryKey: ['library-resume', session.deviceId, user.id],
    queryFn: ({ signal }) => getResumeItems(baseUrl, session, user.id, signal),
    retry: false,
    gcTime: 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const items = [
    ...new Map(
      library.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    ).values(),
  ]
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
    client.setQueryData<MediaItem[]>(
      ['library-resume', session.deviceId, user.id],
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
  return (
    <>
      <HomePage
        onPlay={(item, resume) => {
          setRemoteCommand(undefined)
          setPlayback({ item, resume, openedAt: Date.now() })
        }}
        username={user.name}
        isAdmin={user.isAdministrator}
        session={session}
        userId={user.id}
        playbackOpen={Boolean(playback)}
        onFavorite={async (item, favorite) => {
          const saved = await setMediaFavorite(
            baseUrl,
            session,
            user.id,
            item.id,
            favorite,
          )
          patchItem(item.id, { favorite: saved })
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
        items={searching ? [] : items}
        resumeItems={resume.data ?? []}
        resumeError={resume.isError}
        state={
          searching || library.isPending
            ? 'loading'
            : library.isError && !library.data
              ? 'error'
              : 'ready'
        }
        total={library.data?.pages[0].total ?? 0}
        filter={filter}
        search={search}
        hasMore={library.hasNextPage}
        loadingMore={library.isFetchingNextPage}
        loadMoreError={library.isFetchNextPageError}
        onFilter={setFilter}
        onSearch={setSearch}
        onLoadMore={() => void library.fetchNextPage()}
        onRetry={() => {
          void library.refetch()
          void resume.refetch()
        }}
        onSignOut={onSignOut}
        signingOut={signingOut}
      />
      {playback && (
        <PlaybackPlayer
          key={playback.item.id + (playback.openedAt ?? '')}
          item={playback.item}
          userId={user.id}
          resume={playback.resume}
          session={session}
          initialOptions={playback.options}
          initialQueue={playback.queue}
          queuedNext={playback.queuedNext}
          queuedLast={playback.queuedLast}
          remoteCommand={remoteCommand}
          onClose={() => {
            setRemoteCommand(undefined)
            setPlayback((current) =>
              current?.openedAt === playback.openedAt ? null : current,
            )
            void client.invalidateQueries({ queryKey: ['library'] })
            void client.invalidateQueries({ queryKey: ['library-resume'] })
            void client.invalidateQueries({
              queryKey: ['jellyfin', 'current-user'],
            })
          }}
        />
      )}
    </>
  )
}
