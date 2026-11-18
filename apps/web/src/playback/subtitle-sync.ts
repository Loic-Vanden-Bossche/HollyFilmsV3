import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type {
  Correction,
  SyncJob,
  SyncSnapshot,
} from '@hollyfilms/shared/subtitle-sync'
import { accountHeaders } from '../account-api.ts'
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/index.js'

export function subtitleCapabilities(
  track: MediaStream | undefined,
  remote: boolean,
  burned: boolean,
  group: boolean,
) {
  const local =
    !!track && !remote && !burned && track.DeliveryMethod !== 'Encode'
  return {
    adjust: local,
    replay: local && !group,
    analyze: local && !/^(ass|ssa)$|pgs|dvd|vobsub/i.test(track?.Codec ?? ''),
  }
}

export function useSubtitleTiming(
  session: JellyfinSession,
  userId: string,
  path: string | undefined,
  trackRevision: string,
) {
  const client = useQueryClient()
  const key = ['subtitle-timing', userId, path, trackRevision]
  async function request<T>(
    suffix: string,
    method: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    if (!path) throw Error('context')
    const response = await fetch('/api/subtitle-sync/' + path + suffix, {
      method,
      signal,
      headers: {
        ...accountHeaders(session),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) throw Error(String(response.status))
    return response.json()
  }
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      request<SyncSnapshot>('', 'GET', undefined, signal),
    enabled: !!path,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
  return {
    snapshot: query.data,
    loading: query.isLoading,
    retry: query.refetch,
    save: async (snapshot: SyncSnapshot, correction: Correction) => {
      const result = await request<{ revision: number }>('', 'PUT', {
        fingerprint: snapshot.fingerprint,
        revision: snapshot.revision,
        correction,
      }).catch(async (error) => {
        // A dropped response can arrive after the database transaction committed.
        const latest = await request<SyncSnapshot>('', 'GET').catch(
          () => undefined,
        )
        if (
          latest?.fingerprint === snapshot.fingerprint &&
          latest.revision === snapshot.revision + 1 &&
          latest.correction.manualMs === correction.manualMs &&
          latest.correction.automatic?.scale === correction.automatic?.scale &&
          latest.correction.automatic?.shiftMs === correction.automatic?.shiftMs
        )
          return latest
        throw error
      })
      client.setQueryData<SyncSnapshot>(key, (current) =>
        current &&
        current.fingerprint === snapshot.fingerprint &&
        current.revision <= result.revision
          ? { ...current, correction, revision: result.revision }
          : current,
      )
    },
    job: (
      fingerprint: string,
      signal: AbortSignal,
      reanalyze = false,
      draftRevision = 0,
    ): Promise<SyncJob> => {
      const requestId = crypto.randomUUID()
      return request<SyncJob & { requestId: string; draftRevision: number }>(
        '/jobs',
        'POST',
        { fingerprint, reanalyze, draftRevision, requestId },
        signal,
      ).then((job) => {
        if (
          job.requestId !== requestId ||
          job.draftRevision !== draftRevision ||
          signal.aborted
        )
          throw Error('stale analysis')
        client.setQueryData<SyncSnapshot>(key, (current) =>
          current?.fingerprint === fingerprint ? { ...current, job } : current,
        )
        return job
      })
    },
    status: (id: string, signal: AbortSignal) =>
      request<SyncJob>('/jobs/' + id, 'GET', undefined, signal),
    cancel: (id: string) => request<SyncJob>('/jobs/' + id, 'DELETE'),
  }
}
export type TimingService = ReturnType<typeof useSubtitleTiming>
