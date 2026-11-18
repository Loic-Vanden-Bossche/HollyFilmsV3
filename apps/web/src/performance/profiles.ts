export const performanceProfiles = [
  {
    id: 'essential',
    depth: 0,
    label: 'Essentiel',
    ambient: false,
    shaders: false,
    pointer: false,
    trailers: false,
    blur: 0,
    dpr: 0.5,
    overscan: 1,
  },
  {
    id: 'light',
    depth: 0,
    label: 'Léger',
    ambient: false,
    shaders: false,
    pointer: false,
    trailers: false,
    blur: 4,
    dpr: 0.6,
    overscan: 1,
  },
  {
    id: 'balanced',
    depth: 0.5,
    label: 'Équilibré',
    ambient: true,
    shaders: false,
    pointer: true,
    trailers: false,
    blur: 8,
    dpr: 0.75,
    overscan: 2,
  },
  {
    id: 'high',
    depth: 0.8,
    label: 'Élevé',
    ambient: true,
    shaders: true,
    pointer: true,
    trailers: true,
    blur: 16,
    dpr: 0.85,
    overscan: 2,
  },
  {
    id: 'ultra',
    depth: 1,
    label: 'Ultra',
    ambient: true,
    shaders: true,
    pointer: true,
    trailers: true,
    blur: 24,
    dpr: 1,
    overscan: 3,
  },
] as const

export type PerformanceProfile = (typeof performanceProfiles)[number]
export type ProfileId = PerformanceProfile['id']
export type PerformanceSelection = 'auto' | ProfileId
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
export type SwitchReason = 'slow' | 'stable' | 'manual' | 'auto'
export type PerformanceSwitch = {
  time: number
  from: ProfileId
  to: ProfileId
  reason: SwitchReason
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

/** Decisions use measured work, with fast degradation and cautious recovery. */
export class PerformanceController {
  private settings: PerformanceSettings = {
    profile: performanceProfiles[2],
    selection: 'auto',
    admin: false,
  }
  private trace: PerformanceTrace = { samples: [], events: [] }
  private settingsListeners = new Set<() => void>()
  private traceListeners = new Set<() => void>()
  private bad = 0
  private healthy = 0
  private lastSwitch = -Infinity

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
  resetEvidence() {
    this.bad = 0
    this.healthy = 0
  }
  setAdmin(admin: boolean) {
    if (admin === this.settings.admin) return
    this.settings = { ...this.settings, admin, selection: 'auto' }
    this.resetEvidence()
    this.publishSettings()
  }
  select(selection: PerformanceSelection, time: number) {
    if (!this.settings.admin || selection === this.settings.selection) return
    const profile =
      selection === 'auto'
        ? this.settings.profile
        : performanceProfiles.find((entry) => entry.id === selection)
    if (!profile) return
    this.settings = { ...this.settings, selection }
    this.recordSwitch(profile, selection === 'auto' ? 'auto' : 'manual', time)
  }
  private recordSwitch(
    profile: PerformanceProfile,
    reason: SwitchReason,
    time: number,
  ) {
    const event = {
      time,
      from: this.settings.profile.id,
      to: profile.id,
      reason,
    }
    this.settings = { ...this.settings, profile }
    this.lastSwitch = time
    this.resetEvidence()
    this.trace = {
      ...this.trace,
      events: [...this.trace.events, event].slice(-60),
    }
    this.publishSettings()
    this.publishTrace()
  }
  ingest(sample: PerformanceSample) {
    if (!Number.isFinite(sample.fps) || !Number.isFinite(sample.frameP95))
      return
    this.trace = {
      ...this.trace,
      samples: [...this.trace.samples, sample].slice(-120),
    }
    this.publishTrace()
    if (this.settings.selection !== 'auto' || sample.state !== 'active') {
      this.resetEvidence()
      return
    }
    const slow =
      sample.frameP95 > 28 ||
      sample.slowFrames > 0.16 ||
      (sample.blocking ?? 0) > 0.15 ||
      (sample.interaction ?? 0) > 200
    const severe =
      sample.frameP95 > 55 ||
      sample.slowFrames > 0.4 ||
      (sample.blocking ?? 0) > 0.35 ||
      (sample.interaction ?? 0) > 400
    const healthy =
      sample.frameP95 < 21 &&
      sample.slowFrames < 0.04 &&
      (sample.blocking ?? 0) < 0.04 &&
      (sample.interaction ?? 0) < 100
    this.bad = slow ? this.bad + 1 : 0
    this.healthy = healthy ? this.healthy + 1 : 0
    const index = performanceProfiles.indexOf(this.settings.profile)
    if (this.bad >= 2 && sample.time - this.lastSwitch >= 4000 && index > 0) {
      this.recordSwitch(
        performanceProfiles[Math.max(0, index - (severe ? 2 : 1))],
        'slow',
        sample.time,
      )
    } else if (
      this.healthy >= 15 &&
      sample.time - this.lastSwitch >= 30000 &&
      index < 4
    ) {
      this.recordSwitch(performanceProfiles[index + 1], 'stable', sample.time)
    }
  }
}

export const performanceController = new PerformanceController()
