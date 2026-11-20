const profiles = {
  light: {
    id: 'light',
    depth: 0,
    label: 'Léger',
    ambient: false,
    shaders: false,
    pointer: false,
    trailers: false,
    blur: 0,
    dpr: 0.5,
    overscan: 1,
  },
  cinema: {
    id: 'cinema',
    depth: 0.8,
    label: 'Cinéma',
    ambient: true,
    shaders: true,
    pointer: true,
    trailers: true,
    blur: 16,
    dpr: 0.85,
    overscan: 2,
  },
} as const

export const performanceProfiles = [profiles.cinema, profiles.light] as const
export type ProfileId = keyof typeof profiles
export type PerformanceProfile = (typeof profiles)[ProfileId]
export type PerformanceSelection = ProfileId
export type SampleState = 'active' | 'idle' | 'warmup' | 'playback'
export type PerformanceSample = {
  time: number
  fps: number
  frameP95: number
  slowFrames: number
  blocking: number | null
  interaction: number | null
  state: SampleState
  profile: ProfileId
}
export type PerformanceSwitch = {
  time: number
  from: ProfileId
  to: ProfileId
}
export type PerformanceSettings = {
  profile: PerformanceProfile
  selection: PerformanceSelection
  admin: boolean
}
export type PerformanceTrace = {
  samples: readonly PerformanceSample[]
  events: readonly PerformanceSwitch[]
}

export class PerformanceController {
  private settings: PerformanceSettings = {
    profile: profiles.cinema,
    selection: 'cinema',
    admin: false,
  }
  private trace: PerformanceTrace = { samples: [], events: [] }
  private settingsListeners = new Set<() => void>()
  private traceListeners = new Set<() => void>()

  getSettings = () => this.settings
  getTrace = () => this.trace
  subscribeSettings = (listener: () => void) => {
    this.settingsListeners.add(listener)
    return () => {
      this.settingsListeners.delete(listener)
    }
  }
  subscribeTrace = (listener: () => void) => {
    this.traceListeners.add(listener)
    return () => {
      this.traceListeners.delete(listener)
    }
  }
  private publishSettings() {
    this.settingsListeners.forEach((listener) => listener())
  }
  private publishTrace() {
    this.traceListeners.forEach((listener) => listener())
  }
  /** A new account starts with its own saved choice and an empty diagnostic trace. */
  startSession(selection: ProfileId, admin: boolean) {
    if (this.trace.samples.length || this.trace.events.length) {
      this.trace = { samples: [], events: [] }
      this.publishTrace()
    }
    if (this.settings.selection === selection && this.settings.admin === admin)
      return
    this.settings = { profile: profiles[selection], selection, admin }
    this.publishSettings()
  }
  setAdmin(admin: boolean) {
    if (admin === this.settings.admin) return
    this.startSession(this.settings.selection, admin)
  }
  select(selection: PerformanceSelection, time: number) {
    const previous = this.settings
    if (selection === previous.selection || !Object.hasOwn(profiles, selection))
      return
    this.settings = { ...previous, selection, profile: profiles[selection] }
    if (previous.admin) {
      const event: PerformanceSwitch = {
        time,
        from: previous.selection,
        to: selection,
      }
      this.trace = {
        ...this.trace,
        events: [...this.trace.events, event].slice(-60),
      }
      this.publishTrace()
    }
    this.publishSettings()
  }
  ingest(sample: PerformanceSample) {
    if (
      !this.settings.admin ||
      !Number.isFinite(sample.fps) ||
      !Number.isFinite(sample.frameP95)
    )
      return
    this.trace = {
      ...this.trace,
      samples: [...this.trace.samples, sample].slice(-120),
    }
    this.publishTrace()
  }
}

export const performanceController = new PerformanceController()
