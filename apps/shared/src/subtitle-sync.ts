/** Source and corrected times are integer milliseconds on the full media clock.
 * Positive residuals delay presentation. Only the HTMLMediaElement uses seconds. */
export type Alignment = { scale: number; shiftMs: number }
export type Correction = { automatic: Alignment | null; manualMs: number }
export type SourceCue = {
  id: number
  startMs: number
  endMs: number
  text: string
}
export const originalTiming: Correction = { automatic: null, manualMs: 0 }
export const quickStepMs = 200
export const preciseStepMs = 100
export const maxResidualMs = 24 * 3600_000
export const replayLeadMs = 8000
export const replayTailMs = 2000

export function automaticTime(ms: number, alignment: Alignment | null) {
  return alignment ? Math.round(ms * alignment.scale + alignment.shiftMs) : ms
}
export function correctedTime(ms: number, correction: Correction) {
  return automaticTime(ms, correction.automatic) + correction.manualMs
}
export function cueInterval(
  startMs: number,
  endMs: number,
  correction: Correction,
  originSeconds: number,
  durationSeconds: number,
) {
  const start = Math.max(
    0,
    correctedTime(startMs, correction) / 1000 - originSeconds,
  )
  const end = Math.min(
    correctedTime(endMs, correction) / 1000 - originSeconds,
    Number.isFinite(durationSeconds) ? durationSeconds : Infinity,
  )
  return end > start ? { start, end } : null
}
export function nudge(correction: Correction, delta: number): Correction {
  return {
    ...correction,
    manualMs: Math.min(
      maxResidualMs,
      Math.max(-maxResidualMs, correction.manualMs + delta),
    ),
  }
}
export function matchCue(
  correction: Correction,
  sourceMs: number,
  heardMs: number,
): Correction {
  return {
    ...correction,
    manualMs: heardMs - automaticTime(sourceMs, correction.automatic),
  }
}
export function replayWindow(anchor: number, start: number, end: number) {
  return {
    start: Math.max(start, anchor - replayLeadMs),
    end: Math.min(end, anchor + replayTailMs),
  }
}
export type SyncStage =
  | 'queued'
  | 'preparing'
  | 'analyzing'
  | 'aligning'
  | 'validating'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'uncertain'
  | 'possible-cut'
export const syncFailures = [
  'source',
  'audio',
  'decode',
  'subtitle',
  'engine',
  'timeout',
  'interrupted',
  'internal',
] as const
export type SyncFailure = (typeof syncFailures)[number]
export type SyncJob = {
  failure?: SyncFailure
  id: string
  stage: SyncStage
  processedSeconds?: number
  alignment?: Alignment
}
export type SyncSnapshot = {
  fingerprint: string
  revision: number
  correction: Correction
  canAnalyze: boolean
  job: SyncJob | null
}
