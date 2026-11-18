import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PerformanceController,
  performanceProfiles,
  type PerformanceSample,
} from '../src/performance/profiles.ts'

function sample(
  time: number,
  values: Partial<PerformanceSample> = {},
): PerformanceSample {
  return {
    time,
    fps: 60,
    frameP95: 17,
    slowFrames: 0,
    blocking: 0,
    interaction: null,
    state: 'active',
    profile: 'balanced',
    ...values,
  }
}

test('five profiles remove expensive work progressively, with automatic mode for members', () => {
  assert.equal(performanceProfiles.length, 5)
  const controller = new PerformanceController()
  controller.select('ultra', 0)
  assert.equal(controller.getSettings().selection, 'auto')
  assert.equal(controller.getSettings().profile.id, 'balanced')
  const slow = { frameP95: 40, slowFrames: 0.25 }
  controller.ingest(sample(2000, slow))
  assert.equal(controller.getSettings().profile.id, 'balanced')
  controller.ingest(sample(4000, slow))
  assert.equal(controller.getSettings().profile.id, 'light')
  assert.equal(controller.getTrace().events[0].reason, 'slow')
})

test('severe blocking and slow interactions lower quality even when average FPS looks good', () => {
  for (const measurements of [{ blocking: 0.5 }, { interaction: 450 }]) {
    const controller = new PerformanceController()
    controller.ingest(sample(2000, measurements))
    controller.ingest(sample(4000, measurements))
    assert.equal(controller.getSettings().profile.id, 'essential')
  }
})

test('recovery needs sustained active work and cannot oscillate after a switch', () => {
  const controller = new PerformanceController()
  controller.ingest(sample(2000, { frameP95: 60 }))
  controller.ingest(sample(4000, { frameP95: 60 }))
  assert.equal(controller.getSettings().profile.id, 'essential')
  for (let time = 6000; time <= 32000; time += 2000)
    controller.ingest(sample(time))
  assert.equal(controller.getSettings().profile.id, 'essential')
  controller.ingest(sample(34000))
  assert.equal(controller.getSettings().profile.id, 'light')
  controller.ingest(sample(36000, { frameP95: 60 }))
  assert.equal(controller.getSettings().profile.id, 'light')
  controller.ingest(sample(38000, { frameP95: 60 }))
  assert.equal(controller.getSettings().profile.id, 'essential')
})

test('warmup, idle and playback are excluded and visibility resets incomplete evidence', () => {
  for (const state of ['warmup', 'idle', 'playback'] as const) {
    const controller = new PerformanceController()
    for (let time = 2000; time <= 60000; time += 2000)
      controller.ingest(sample(time, { state, frameP95: 80 }))
    assert.equal(controller.getSettings().profile.id, 'balanced')
    assert.equal(controller.getTrace().events.length, 0)
  }
  const controller = new PerformanceController()
  controller.ingest(sample(2000, { frameP95: 80 }))
  controller.resetEvidence()
  controller.ingest(sample(200000, { frameP95: 80 }))
  assert.equal(controller.getSettings().profile.id, 'balanced')
})

test('admin manual overrides suspend adaptation, and role loss restores automatic selection', () => {
  const controller = new PerformanceController()
  controller.setAdmin(true)
  for (const profile of performanceProfiles) {
    controller.select(profile.id, 0)
    assert.equal(controller.getSettings().profile.id, profile.id)
    controller.ingest(sample(2000, { frameP95: 80 }))
    controller.ingest(sample(4000, { frameP95: 80 }))
    assert.equal(controller.getSettings().profile.id, profile.id)
  }
  controller.select('auto', 6000)
  assert.equal(controller.getTrace().events.at(-1)?.reason, 'auto')
  controller.select('ultra', 8000)
  controller.setAdmin(false)
  controller.select('light', 9000)
  assert.equal(controller.getSettings().selection, 'auto')
  controller.ingest(sample(10000, { frameP95: 80 }))
  controller.ingest(sample(12000, { frameP95: 80 }))
  assert.equal(controller.getSettings().profile.id, 'balanced')
})

test('optional measurements can be absent, and histories remain bounded', () => {
  const controller = new PerformanceController()
  for (let time = 2000; time <= 400000; time += 2000)
    controller.ingest(sample(time, { blocking: null, interaction: null }))
  assert.equal(controller.getTrace().samples.length, 120)
  assert.equal(controller.getSettings().profile.id, 'ultra')
  controller.setAdmin(true)
  for (let i = 0; i < 100; i++) controller.select(i % 2 ? 'light' : 'ultra', i)
  assert.equal(controller.getTrace().events.length, 60)
})
