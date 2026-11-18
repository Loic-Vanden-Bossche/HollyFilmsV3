import type {
  MediaStream,
  MediaSourceInfo,
} from '@jellyfin/sdk/lib/generated-client/index.js'
export function matchingSubtitle(
  previous: MediaStream,
  candidates: MediaStream[],
) {
  const subtitles = candidates.filter((track) => track.Type === 'Subtitle')
  const exact = previous.Path
    ? subtitles.find((track) => track.Path === previous.Path)
    : undefined
  if (exact) return exact
  const matching = subtitles.filter(
    (track) =>
      track.Language === previous.Language &&
      track.Codec === previous.Codec &&
      track.IsExternal === previous.IsExternal &&
      !!track.IsForced === !!previous.IsForced &&
      !!track.IsHearingImpaired === !!previous.IsHearingImpaired,
  )
  return (
    matching.find(
      (track) =>
        (track.Title ?? track.DisplayTitle) ===
        (previous.Title ?? previous.DisplayTitle),
    ) ??
    matching.find((track) => track.Index === previous.Index) ??
    (matching.length === 1 ? matching[0] : undefined)
  )
}
export function subtitleRevision(tracks: MediaStream[] = []) {
  const value = JSON.stringify(
    tracks
      .filter((track) => track.Type === 'Subtitle')
      .map((track) => [
        track.Index,
        track.Path ?? track.Title ?? track.DisplayTitle,
        track.Language,
        track.Codec,
      ]),
  )
  let hash = 2166136261
  for (let index = 0; index < value.length; index++)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return (hash >>> 0).toString(16)
}
export function refreshSubtitleSource<T extends MediaSourceInfo>(
  previous: T,
  fresh: MediaSourceInfo,
): T {
  return {
    ...previous,
    MediaStreams: [
      ...(previous.MediaStreams ?? []).filter(
        (track) => track.Type !== 'Subtitle',
      ),
      ...(fresh.MediaStreams ?? [])
        .filter((track) => track.Type === 'Subtitle')
        .map((track) => ({
          ...matchingSubtitle(track, previous.MediaStreams ?? []),
          ...track,
          DeliveryMethod: track.IsExternal
            ? ('External' as const)
            : matchingSubtitle(track, previous.MediaStreams ?? [])
                ?.DeliveryMethod,
        })),
    ],
  }
}
export function remapSubtitleIndex(
  previous: MediaStream[],
  fresh: MediaStream[],
  index: number,
) {
  if (index < 0) return index
  const old = previous.find(
    (track) => track.Type === 'Subtitle' && track.Index === index,
  )
  return old ? (matchingSubtitle(old, fresh)?.Index ?? -1) : -1
}
