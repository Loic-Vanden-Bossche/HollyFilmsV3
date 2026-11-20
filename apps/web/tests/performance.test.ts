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
    blocking: null,
    interaction: null,
    state: 'active',
    profile: 'cinema',
    ...values,
  }
}

test('members can switch immediately between the cinematic and lightweight interfaces', () => {
  const controller = new PerformanceController()
  assert.deepEqual(
    performanceProfiles.map((profile) => profile.id),
    ['cinema', 'light'],
  )
  assert.equal(controller.getSettings().profile.id, 'cinema')
  controller.select('light', 1)
  const light = controller.getSettings().profile
  assert.equal(light.id, 'light')
  assert.equal(light.trailers, false)
  assert.equal(light.shaders, false)
  assert.equal(light.ambient, false)
  controller.select('cinema', 2)
  const cinema = controller.getSettings().profile
  assert.equal(cinema.trailers, true)
  assert.equal(cinema.shaders, true)
  assert.equal(cinema.ambient, true)
  assert.equal(controller.getSettings().admin, false)
  assert.deepEqual(controller.getTrace(), { samples: [], events: [] })
})

test('diagnostic samples cannot override the chosen mode', () => {
  const controller = new PerformanceController()
  controller.setAdmin(true)
  for (const profile of performanceProfiles) {
    controller.select(profile.id, 0)
    for (let i = 0; i < 100; i++) {
      controller.ingest(
        sample(i * 2000, {
          profile: profile.id,
          frameP95: i < 50 ? 70 : 16,
        }),
      )
      assert.equal(controller.getSettings().profile.id, profile.id)
    }
  }
  assert.deepEqual(controller.getTrace().events, [
    { time: 0, from: 'cinema', to: 'light' },
  ])
})

test('diagnostics are bounded and cleared when account or privileges change', () => {
  const controller = new PerformanceController()
  controller.ingest(sample(0))
  assert.equal(controller.getTrace().samples.length, 0)
  controller.setAdmin(true)
  for (let i = 0; i < 150; i++) {
    controller.select(i % 2 ? 'light' : 'cinema', i)
    controller.ingest(
      sample(i * 2000, { profile: controller.getSettings().profile.id }),
    )
  }
  assert.equal(controller.getTrace().samples.length, 120)
  assert.equal(controller.getTrace().events.length, 60)
  const before = controller.getTrace()
  controller.ingest(sample(1, { fps: NaN }))
  assert.equal(controller.getTrace(), before)
  controller.startSession('light', true)
  assert.deepEqual(controller.getTrace(), { samples: [], events: [] })
  controller.ingest(sample(0))
  controller.setAdmin(false)
  controller.ingest(sample(1))
  assert.equal(controller.getSettings().selection, 'light')
  assert.deepEqual(controller.getTrace(), { samples: [], events: [] })
})
