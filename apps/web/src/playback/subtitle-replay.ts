import { replayWindow } from '@hollyfilms/shared/subtitle-sync'

export type ReplayState =
  'idle' | 'seeking' | 'listening' | 'ended' | 'moved' | 'failed'
/** Controls a single bounded passage. All positions are media time, including at 2×. */
export class SubtitleReplay {
  private video: HTMLVideoElement
  private origin: number
  private anchor: number
  private end = 0
  private expected: number | null = null
  private cycle = 0
  private sourceAtOpen: string
  private waitingTimer?: ReturnType<typeof setTimeout>
  private internalPauses = 0
  private internalPlays = 0
  private playingIntent: boolean
  private ownsPlayback = false
  private changed: (state: ReplayState) => void
  private events = new AbortController()
  state: ReplayState = 'idle'
  constructor(
    video: HTMLVideoElement,
    origin: number,
    changed: (state: ReplayState) => void,
  ) {
    this.video = video
    this.sourceAtOpen = video.currentSrc
    this.origin = origin
    this.changed = changed
    this.anchor = this.now()
    this.playingIntent = !video.paused && !video.ended
    const listen = (name: string, handler: (event: Event) => void) =>
      video.addEventListener(name, handler, { signal: this.events.signal })
    listen('seeking', () => {
      if (this.expected === null || Math.abs(this.now() - this.expected) > 350)
        this.moved()
    })
    listen('seeked', () => {
      if (this.expected !== null) {
        this.expected = null
        this.resume(this.cycle)
      }
    })
    listen('playing', () => this.ready())
    listen('canplay', () => this.ready())
    listen('waiting', () => {
      if (this.state === 'listening') this.set('seeking')
    })
    listen('pause', () => {
      if (this.internalPauses) {
        this.internalPauses--
        return
      }
      this.playingIntent = false
      this.ownsPlayback = false
      if (this.state === 'listening' || this.state === 'seeking') this.disarm()
    })
    listen('play', () => {
      if (this.internalPlays) {
        this.internalPlays--
        return
      }
      this.playingIntent = true
      this.ownsPlayback = false
    })
    listen('timeupdate', () => {
      if (this.state === 'listening' && this.now() >= this.end) this.finish()
    })
    listen('ended', () => this.finish())
    listen('emptied', () => {
      this.ownsPlayback = false
      this.moved()
    })
    listen('error', () => {
      this.disarm()
      this.set('failed')
    })
    listen('subtitle-user-seek', () => this.moved())
    listen('subtitle-user-playback', (event) => {
      this.playingIntent = !(event as CustomEvent<{ paused: boolean }>).detail
        .paused
      this.ownsPlayback = false
      this.disarm()
    })
  }
  private set(state: ReplayState) {
    if (state !== this.state) {
      clearTimeout(this.waitingTimer)
      if (state === 'seeking')
        this.waitingTimer = setTimeout(() => {
          this.disarm()
          this.pauseVideo()
          this.set('failed')
        }, 15000)
      this.state = state
      this.changed(state)
    }
  }
  now() {
    return Math.round((this.video.currentTime + this.origin) * 1000)
  }
  reference() {
    return this.anchor
  }
  disarm() {
    this.cycle++
    this.expected = null
    this.set('idle')
  }
  private moved() {
    this.disarm()
    this.set('moved')
  }
  newReference() {
    this.anchor = this.now()
    this.disarm()
  }
  pause() {
    this.disarm()
    this.ownsPlayback = true
    this.pauseVideo()
  }
  private pauseVideo() {
    if (!this.video.paused) {
      this.internalPauses++
      this.video.pause()
    }
  }
  private finish() {
    if (this.state === 'ended') return
    this.disarm()
    this.set('ended')
    this.pauseVideo()
  }
  private ready() {
    if (this.state === 'seeking' && this.canHear() && this.expected === null)
      this.set('listening')
  }
  private canHear() {
    const v = this.video
    return !v.paused && !v.ended && !v.seeking && v.readyState >= 3
  }
  private resume(cycle: number) {
    if (cycle !== this.cycle || this.state !== 'seeking') return
    if (this.video.paused) this.internalPlays++
    void this.video.play().then(
      () => {
        if (cycle === this.cycle) this.ready()
      },
      () => {
        this.internalPlays = Math.max(0, this.internalPlays - 1)
        if (cycle === this.cycle) this.set('failed')
      },
    )
  }
  replay() {
    this.disarm()
    const v = this.video
    const ranges = v.seekable
    const local = this.anchor / 1000 - this.origin
    let index = 0
    while (
      index < ranges.length &&
      !(
        ranges.start(index) <= local + 0.001 &&
        local <= ranges.end(index) + 0.001
      )
    )
      index++
    if (index === ranges.length) {
      this.set('failed')
      return
    }
    const clip = replayWindow(
      this.anchor,
      Math.round((ranges.start(index) + this.origin) * 1000),
      Math.round((ranges.end(index) + this.origin) * 1000),
    )
    if (clip.end <= clip.start) {
      this.set('failed')
      return
    }
    this.end = clip.end
    this.ownsPlayback = true
    this.pauseVideo()
    this.set('seeking')
    if (Math.abs(this.now() - clip.start) < 20 && !v.seeking) {
      this.resume(this.cycle)
      return
    }
    this.expected = clip.start
    try {
      v.currentTime = clip.start / 1000 - this.origin
    } catch {
      this.expected = null
      this.set('failed')
    }
  }
  capture() {
    const heard = this.now()
    if (this.state !== 'listening' || !this.canHear() || heard >= this.end)
      return
    this.pause()
    return heard
  }
  dispose() {
    if (this.events.signal.aborted) return
    clearTimeout(this.waitingTimer)
    this.events.abort()
    this.cycle++
    if (
      this.ownsPlayback &&
      !this.video.ended &&
      this.video.currentSrc === this.sourceAtOpen
    ) {
      if (this.playingIntent) void this.video.play().catch(() => {})
      else this.video.pause()
    }
  }
}
