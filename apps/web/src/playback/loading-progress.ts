export type LoadingPhase = 'source' | 'stream' | 'buffer' | 'image'

// Only count the contiguous range containing the requested position. A range
// further ahead (e.g. after seeking backwards) is not playable buffer here.
export function bufferedAhead(
  ranges: {
    length: number
    start: (index: number) => number
    end: (index: number) => number
  },
  position: number,
) {
  if (!Number.isFinite(position)) return 0
  for (let index = 0; index < ranges.length; index++) {
    if (ranges.start(index) <= position && ranges.end(index) >= position)
      return Math.max(0, ranges.end(index) - position)
  }
  return 0
}
