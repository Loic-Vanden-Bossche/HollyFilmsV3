export type PlaybackWait = {
  operation: 'opening' | 'preparing' | 'seeking' | 'buffering'
  since: number
  position: number
}

// Progress belongs to one requested position. Repeated browser events, lost
// readiness, and a buffer refilling to its previous level don't buy more time.
export class PlaybackInactivity {
  private readiness = 0
  private ahead = 0
  private lastProgress: number

  constructor(now: number) {
    this.lastProgress = now
  }

  observe(now: number, readiness: number, ahead: number) {
    if (readiness > this.readiness || ahead > this.ahead) {
      this.lastProgress = now
      this.readiness = Math.max(readiness, this.readiness)
      this.ahead = Math.max(ahead, this.ahead)
    }
  }

  remaining(now: number) {
    return Math.max(0, this.lastProgress + 30_000 - now)
  }
}

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
