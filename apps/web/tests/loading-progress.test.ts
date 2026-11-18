import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bufferedAhead,
  PlaybackInactivity,
} from '../src/playback/loading-progress.ts'

const ranges = (values: [number, number][]) => ({
  length: values.length,
  start: (index: number) => values[index][0],
  end: (index: number) => values[index][1],
})

test('the inactivity window follows readiness and new playable data at the target', () => {
  const clock = new PlaybackInactivity(1000)
  const target = 40
  const observe = (
    now: number,
    readiness: number,
    values: [number, number][],
  ) => clock.observe(now, readiness, bufferedAhead(ranges(values), target))
  observe(20_000, 1, [])
  observe(45_000, 2, [[40, 42]])
  observe(70_000, 2, [[39, 45]])
  assert.equal(clock.remaining(70_000), 30_000)
  // Data beyond the gap, stale notifications and a fluctuating readyState
  // provide no further playable media at the requested time.
  observe(85_000, 1, [
    [40, 41],
    [90, 130],
  ])
  observe(99_000, 2, [
    [40, 45],
    [90, 145],
  ])
  assert.equal(clock.remaining(99_000), 1000)
  assert.equal(clock.remaining(100_000), 0)
})
test('loading status counts only buffered video at the requested position', () => {
  assert.equal(
    bufferedAhead(
      ranges([
        [0, 12],
        [60, 90],
      ]),
      5,
    ),
    7,
  )
  assert.equal(
    bufferedAhead(
      ranges([
        [0, 12],
        [60, 90],
      ]),
      30,
    ),
    0,
  )
  assert.equal(
    bufferedAhead(
      ranges([
        [0, 12],
        [60, 90],
      ]),
      75,
    ),
    15,
  )
  assert.equal(bufferedAhead(ranges([[0, 12]]), 12), 0)
  assert.equal(bufferedAhead(ranges([]), 0), 0)
  assert.equal(bufferedAhead(ranges([[0, 12]]), Number.NaN), 0)
})
