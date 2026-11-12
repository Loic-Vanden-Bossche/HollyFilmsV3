import assert from 'node:assert/strict'
import test from 'node:test'
import { bufferedAhead } from '../src/playback/loading-progress.ts'

const ranges = (values: [number, number][]) => ({
  length: values.length,
  start: (index: number) => values[index][0],
  end: (index: number) => values[index][1],
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
