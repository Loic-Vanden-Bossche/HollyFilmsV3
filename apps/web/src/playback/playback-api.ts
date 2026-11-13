import type { Translate } from '../i18n/messages.ts'
import { createJellyfinApi } from '@hollyfilms/shared/jellyfin'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type { MediaItem } from '@hollyfilms/shared/library'
import type {
  BaseItemDto,
  DeviceProfile,
  DirectPlayProfile,
  MediaSourceInfo,
  MediaStream,
  PlaybackProgressInfo,
  PlaybackStopInfo,
  PlayMethod,
} from '@jellyfin/sdk/lib/generated-client/index.js'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js'
import { getLyricApi } from '@jellyfin/sdk/lib/utils/api/lyric-api.js'
import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api.js'
import { getMediaSegmentApi } from '@jellyfin/sdk/lib/utils/api/media-segment-api.js'
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api.js'
import { getShowApi } from '@jellyfin/sdk/lib/utils/api/show-api.js'
import { getVideoApi } from '@jellyfin/sdk/lib/utils/api/video-api.js'

export const ticksPerSecond = 10_000_000
export const defaultBitrate = 120_000_000

export type PlaybackTarget = {
  id: string
  title: string
  seriesId?: string
  kind: MediaItem['kind']
  start: number
}

export type StreamOptions = {
  sourceId?: string
  audio?: number
  subtitle?: number
  bitrate?: number
  forceTranscode?: boolean
  burnSubtitle?: boolean
}

export type PlaybackStream = {
  url: string
  hls: boolean
  method: PlayMethod
  source: MediaSourceInfo & { Id: string }
  sources: MediaSourceInfo[]
  sessionId: string
  offset: number
}

export function itemTarget(item: BaseItemDto): PlaybackTarget | undefined {
  if (!item.Id) return
  return {
    id: item.Id,
    title: [item.SeriesName, item.Name].filter(Boolean).join(' · '),
    seriesId: item.SeriesId ?? undefined,
    kind:
      item.Type === 'Episode'
        ? 'Épisode'
        : item.Type === 'Series'
          ? 'Série'
          : 'Film',
    start: (item.UserData?.PlaybackPositionTicks ?? 0) / ticksPerSecond,
  }
}

function browserProfile(
  video: HTMLVideoElement,
  bitrate: number,
): DeviceProfile {
  const formats = [
    ['mp4,m4v,mov', 'video/mp4', 'h264', 'avc1.640028', 'aac', 'mp4a.40.2'],
    [
      'mp4,m4v,mov',
      'video/mp4',
      'hevc',
      'hvc1.1.6.L120.B0',
      'aac',
      'mp4a.40.2',
    ],
    ['mp4,m4v,mov', 'video/mp4', 'av1', 'av01.0.08M.08', 'aac', 'mp4a.40.2'],
    ['webm', 'video/webm', 'vp9', 'vp9', 'opus', 'opus'],
    ['webm', 'video/webm', 'vp8', 'vp8', 'vorbis', 'vorbis'],
    ['webm', 'video/webm', 'av1', 'av01.0.08M.08', 'opus', 'opus'],
  ]
  const direct: DirectPlayProfile[] = formats.flatMap(
    ([container, mime, codec, videoCodec, audio, audioCodec]) =>
      video.canPlayType(
        mime + '; codecs="' + videoCodec + ',' + audioCodec + '"',
      )
        ? [
            {
              Container: container,
              Type: 'Video',
              VideoCodec: codec,
              AudioCodec: audio,
            },
          ]
        : [],
  )
  for (const [container, mime] of [
    ['mp3', 'audio/mpeg'],
    ['flac', 'audio/flac'],
    ['aac', 'audio/aac'],
    ['opus,ogg,oga', 'audio/ogg; codecs="opus"'],
    ['m4a,m4b,mp4', 'audio/mp4'],
    ['wav', 'audio/wav'],
  ]) {
    if (video.canPlayType(mime))
      direct.push({ Container: container, Type: 'Audio' })
  }
  return {
    Name: 'HollyFilms',
    MaxStaticBitrate: bitrate,
    MaxStreamingBitrate: bitrate,
    DirectPlayProfiles: direct,
    TranscodingProfiles: [
      {
        Container: 'mp4',
        Type: 'Video',
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        Protocol: 'hls',
        Context: 'Streaming',
        MaxAudioChannels: '2',
        MinSegments: 1,
      },
      {
        Container: 'ts',
        Type: 'Video',
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        Protocol: 'hls',
        Context: 'Streaming',
        MaxAudioChannels: '2',
        MinSegments: 1,
      },
      {
        Container: 'mp3',
        Type: 'Audio',
        AudioCodec: 'mp3',
        Protocol: 'http',
        Context: 'Streaming',
      },
    ],
    SubtitleProfiles: [
      ...[
        'vtt',
        'srt',
        'subrip',
        'ass',
        'ssa',
        'ttml',
        'pgssub',
        'hdmv_pgs_subtitle',
        'dvdsub',
        'dvd_subtitle',
      ].map((Format) => ({ Format, Method: 'External' as const })),
    ],
  }
}

export function createPlaybackApi(session: JellyfinSession, userId: string) {
  const origin = window.location.origin
  const base = new URL('/jellyfin/', origin)
  const sdk = createJellyfinApi(
    base.href.replace(/\/$/, ''),
    session.deviceId,
    session.accessToken,
  )
  const library = getLibraryApi(sdk)
  const shows = getShowApi(sdk)
  const sessions = getSessionApi(sdk)

  function mediaUrl(path: string, params: Record<string, string> = {}) {
    const supplied = new URL(path.replace(/^\/+/, ''), base)
    // Streaming endpoints are served by the configured proxy, including URLs
    // returned with the server's internal host or base path.
    const relative = supplied.pathname
      .replace(/^\/jellyfin\//i, '')
      .replace(/^\//, '')
    const url = new URL(relative + supplied.search, base)
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value)
    if (
      ![...url.searchParams.keys()].some(
        (key) => key.toLowerCase() === 'api_key',
      )
    ) {
      url.searchParams.set('api_key', session.accessToken)
    }
    return url.href
  }

  const details = (itemId: string, signal?: AbortSignal) =>
    library
      .getItem({ itemId, userId }, { signal, timeout: 7000 })
      .then(({ data }) => data)

  return {
    sdk,
    userId,
    session,
    mediaUrl,
    previewUrl: (path: string, params: Record<string, string> = {}) =>
      sdk.getUri('/' + path, params),
    previewImage: (url: string, signal: AbortSignal) =>
      sdk.axiosInstance
        .get<Blob>(url, {
          headers: { Authorization: sdk.authorizationHeader },
          responseType: 'blob',
          signal,
          timeout: 7000,
        })
        .then(({ data }) => data),
    details,
    async resolve(target: PlaybackTarget, signal: AbortSignal) {
      if (target.kind !== 'Série') return target
      const { data } = await shows.getNextUp(
        {
          seriesId: target.id,
          userId,
          limit: 1,
          enableResumable: true,
          enableRewatching: true,
        },
        { signal, timeout: 7000 },
      )
      const next =
        data.Items?.[0] ??
        (
          await shows.getEpisodes(
            { seriesId: target.id, userId, limit: 1 },
            { signal, timeout: 7000 },
          )
        ).data.Items?.[0]
      const playable = next && itemTarget(next)
      if (!playable) throw new Error('Aucun épisode disponible.')
      return { ...playable, seriesId: target.id }
    },
    async queue(target: PlaybackTarget, signal: AbortSignal) {
      if (target.seriesId) {
        const { data } = await shows.getEpisodes(
          { seriesId: target.seriesId, userId, isMissing: false },
          { signal, timeout: 7000 },
        )
        return (data.Items ?? [])
          .map(itemTarget)
          .filter((item) => item !== undefined)
      }
      const { data } = await getVideoApi(sdk).getAdditionalPart(
        { itemId: target.id, userId },
        { signal, timeout: 7000 },
      )
      return [
        target,
        ...(data.Items ?? [])
          .map(itemTarget)
          .filter((item) => item !== undefined),
      ]
    },
    async stream(
      video: HTMLVideoElement,
      target: PlaybackTarget,
      options: StreamOptions,
      signal: AbortSignal,
    ): Promise<PlaybackStream> {
      const bitrate = options.bitrate ?? defaultBitrate
      const media = getMediaInfoApi(sdk)
      const { data } = await media.getPostedPlaybackInfo(
        {
          itemId: target.id,
          playbackInfoDto: {
            UserId: userId,
            DeviceProfile: browserProfile(video, bitrate),
            StartTimeTicks: Math.round(target.start * ticksPerSecond),
            MaxStreamingBitrate: bitrate,
            MediaSourceId: options.sourceId,
            AudioStreamIndex: options.audio,
            SubtitleStreamIndex: options.subtitle,
            EnableDirectPlay: !options.forceTranscode,
            EnableDirectStream: !options.forceTranscode,
            EnableTranscoding: true,
            AllowVideoStreamCopy: !options.burnSubtitle,
            AlwaysBurnInSubtitleWhenTranscoding: options.burnSubtitle,
            AutoOpenLiveStream: true,
          },
        },
        { signal, timeout: 15_000 },
      )
      const sources = data.MediaSources ?? []
      const source =
        (options.sourceId
          ? sources.find((entry) => entry.Id === options.sourceId)
          : undefined) ??
        sources.find((entry) => entry.SupportsDirectPlay) ??
        sources.find(
          (entry) => entry.SupportsDirectStream || entry.SupportsTranscoding,
        )
      if (!source?.Id || !data.PlaySessionId)
        throw new Error('Aucune source compatible avec ce navigateur.')
      const sessionId = data.PlaySessionId
      const audioOnly = !source.MediaStreams?.some(
        (track) => track.Type === 'Video',
      )
      const direct =
        !options.forceTranscode &&
        (source.SupportsDirectPlay || source.SupportsDirectStream)
      const firstAudio = source.MediaStreams?.find(
        (track) => track.Type === 'Audio',
      )?.Index
      const selectedAudio = options.audio ?? source.DefaultAudioStreamIndex
      if (
        direct &&
        selectedAudio != null &&
        firstAudio != null &&
        selectedAudio !== firstAudio
      ) {
        const selected = await this.stream(
          video,
          target,
          {
            ...options,
            sourceId: source.Id,
            audio: selectedAudio,
            forceTranscode: true,
          },
          signal,
        )
        return { ...selected, sources }
      }
      const container = source.Container?.split(',')[0] ?? 'mp4'
      const path = direct
        ? (audioOnly ? 'Audio/' : 'Videos/') +
          encodeURIComponent(target.id) +
          '/stream.' +
          encodeURIComponent(container)
        : source.TranscodingUrl
      if (!path)
        throw new Error('Le serveur ne propose pas de flux compatible.')
      const url = mediaUrl(
        path,
        direct
          ? {
              Static: 'true',
              MediaSourceId: source.Id,
              DeviceId: session.deviceId,
              ...(source.ETag ? { Tag: source.ETag } : {}),
            }
          : {},
      )
      const hls =
        !direct &&
        (source.TranscodingSubProtocol === 'hls' ||
          new URL(url).pathname.endsWith('.m3u8'))
      return {
        url,
        hls,
        sessionId,
        source: { ...source, Id: source.Id },
        sources,
        method: direct
          ? source.SupportsDirectPlay
            ? 'DirectPlay'
            : 'DirectStream'
          : 'Transcode',
        offset:
          !direct && !hls && !/CopyTimestamps=true/i.test(url)
            ? target.start
            : 0,
      }
    },
    segments: (itemId: string, signal: AbortSignal) =>
      getMediaSegmentApi(sdk)
        .getItemSegments({ itemId }, { signal, timeout: 5000 })
        .then(({ data }) => data.Items ?? []),
    trailers: (itemId: string) =>
      library
        .getLocalTrailers({ itemId, userId }, { timeout: 5000 })
        .then(({ data }) => data),
    lyrics: (itemId: string, signal: AbortSignal) =>
      getLyricApi(sdk)
        .getLyrics({ itemId }, { signal, timeout: 5000 })
        .then(({ data }) => data.Lyrics ?? []),
    start: (info: PlaybackProgressInfo) =>
      sessions.reportPlaybackStart(
        { playbackStartInfo: info },
        { timeout: 5000 },
      ),
    progress: (info: PlaybackProgressInfo) =>
      sessions.reportPlaybackProgress(
        { playbackProgressInfo: info },
        { timeout: 5000 },
      ),
    stop: (info: PlaybackStopInfo) =>
      sessions.reportPlaybackStopped(
        { playbackStopInfo: info },
        { timeout: 5000 },
      ),
    async release(stream: PlaybackStream) {
      await Promise.all([
        stream.method === 'Transcode' &&
          sdk.axiosInstance.delete(
            sdk.getUri('/Videos/ActiveEncodings', {
              deviceId: session.deviceId,
              playSessionId: stream.sessionId,
            }),
            { timeout: 5000 },
          ),
        stream.source.RequiresClosing &&
          stream.source.LiveStreamId &&
          getMediaInfoApi(sdk).closeLiveStream(
            { liveStreamId: stream.source.LiveStreamId },
            { timeout: 5000 },
          ),
      ])
    },
  }
}

export type PlaybackApi = ReturnType<typeof createPlaybackApi>

export function trackName(track: MediaStream, t: Translate) {
  return (
    track.DisplayTitle ??
    track.Title ??
    ([track.Language, track.Codec?.toUpperCase()].filter(Boolean).join(' ') ||
      t('Piste {number}', { number: track.Index ?? 0 }))
  )
}
