import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto'
import type { PlaybackApi } from './playback-api.ts'

export type TimelinePreview = {
  url: string
  width: number
  height: number
  x: number
  y: number
  sheetWidth: number
  sheetHeight: number
  label?: string
}

export function timelinePreview(
  details: BaseItemDto | undefined,
  sourceId: string | undefined,
  position: number,
  mediaUrl: PlaybackApi['mediaUrl'],
): TimelinePreview | undefined {
  if (!details?.Id || !sourceId || !Number.isFinite(position)) return
  const normalize = (id: string) => id.replaceAll('-', '').toLowerCase()
  const tiles = Object.entries(details.Trickplay ?? {}).find(
    ([id]) => normalize(id) === normalize(sourceId),
  )?.[1]
  const tile = Object.values(tiles ?? {})
    .filter((entry) =>
      [
        entry.Width,
        entry.Height,
        entry.Interval,
        entry.TileWidth,
        entry.TileHeight,
        entry.ThumbnailCount,
      ].every((value) => value != null && value > 0),
    )
    .sort((a, b) => a.Width! - b.Width!)[0]
  if (tile) {
    const index = Math.min(
      tile.ThumbnailCount! - 1,
      Math.floor((Math.max(0, position) * 1000) / tile.Interval!),
    )
    const count = tile.TileWidth! * tile.TileHeight!
    const slot = index % count
    const scale = Math.min(1, 224 / tile.Width!)
    return {
      url: mediaUrl(
        `Videos/${details.Id}/Trickplay/${tile.Width}/${Math.floor(index / count)}.jpg`,
        { MediaSourceId: sourceId },
      ),
      width: tile.Width! * scale,
      height: tile.Height! * scale,
      x: (slot % tile.TileWidth!) * tile.Width! * scale,
      y: Math.floor(slot / tile.TileWidth!) * tile.Height! * scale,
      sheetWidth: tile.TileWidth! * tile.Width! * scale,
      sheetHeight: tile.TileHeight! * tile.Height! * scale,
    }
  }
  // A chapter is a useful approximation when no generated frame tiles exist.
  // Never borrow another version's images: its timings may differ.
  if (normalize(sourceId) !== normalize(details.Id)) return
  const chapterIndex =
    details.Chapters?.findLastIndex(
      (chapter) =>
        Boolean(chapter.ImageTag) &&
        (chapter.StartPositionTicks ?? 0) / 10_000_000 <= position,
    ) ?? -1
  const chapter = details.Chapters?.[chapterIndex]
  if (!chapter) return
  return {
    url: mediaUrl(`Items/${details.Id}/Images/Chapter/${chapterIndex}`, {
      tag: chapter.ImageTag!,
      maxWidth: '224',
      maxHeight: '126',
    }),
    width: 224,
    height: 126,
    x: 0,
    y: 0,
    sheetWidth: 224,
    sheetHeight: 126,
    label: chapter.Name ?? 'Chapitre',
  }
}
