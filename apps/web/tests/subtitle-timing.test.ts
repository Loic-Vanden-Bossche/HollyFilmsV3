import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cueInterval,
  correctedTime,
  nudge,
  matchCue,
  originalTiming,
  quickStepMs,
  replayWindow,
} from '@hollyfilms/shared/subtitle-sync'
import { SubtitleReplay } from '../src/playback/subtitle-replay.ts'
test('absolute alignment, signed integer residuals and immutable source times', () => {
  const prior = { automatic: { scale: 1, shiftMs: 2000 }, manualMs: -500 }
  assert.equal(correctedTime(100000, prior), 101500)
  const result = matchCue(prior, 100000, 103000)
  assert.equal(result.manualMs, 1000)
  assert.equal(correctedTime(100000, result), 103000)
  let draft = nudge(originalTiming, quickStepMs)
  assert.equal(draft.manualMs, 200)
  for (let i = 0; i < 1000; i++) draft = nudge(nudge(draft, -200), 200)
  assert.equal(nudge(draft, -200).manualMs, 0)
  const affine = { automatic: { scale: 25 / 24, shiftMs: -200 }, manualMs: 0 }
  assert.equal(correctedTime(24000, nudge(affine, 100)), 24900)
  assert.deepEqual(cueInterval(99000, 103000, originalTiming, 100, 2), {
    start: 0,
    end: 2,
  })
  assert.equal(cueInterval(20000, 99000, originalTiming, 100, 2), null)
  assert.equal(cueInterval(104000, 105000, originalTiming, 100, 2), null)
  assert.deepEqual(cueInterval(101000, 103000, originalTiming, 100, 2), {
    start: 1,
    end: 2,
  })
  assert.deepEqual(replayWindow(1000, 0, 1750), { start: 0, end: 1750 })
  assert.deepEqual(replayWindow(80000, 76000, 81000), {
    start: 76000,
    end: 81000,
  })
})
test('replay holds a canonical anchor, reads live time once, disarms on seek and restores intent', async () => {
  class Media extends EventTarget {
    currentTime = 20
    paused = false
    ended = false
    seeking = false
    readyState = 4
    playbackRate = 2
    seekable = { length: 1, start: () => 0, end: () => 90 }
    pause() {
      this.paused = true
      this.dispatchEvent(new Event('pause'))
    }
    async play() {
      this.paused = false
      this.dispatchEvent(new Event('playing'))
    }
  }
  const v = new Media()
  const replay = new SubtitleReplay(
    v as unknown as HTMLVideoElement,
    100,
    () => {},
  )
  assert.equal(v.paused, false)
  replay.replay()
  assert.equal(v.currentTime, 12)
  assert.equal(replay.capture(), undefined)
  v.dispatchEvent(new Event('seeked'))
  v.readyState = 2
  assert.equal(replay.capture(), undefined)
  v.readyState = 4
  v.currentTime = 19.875
  assert.equal(replay.capture(), 119875)
  assert.equal(replay.capture(), undefined)
  replay.replay()
  assert.equal(v.currentTime, 12)
  v.dispatchEvent(new Event('seeked'))
  v.currentTime = 22.1
  v.dispatchEvent(new Event('timeupdate'))
  assert.equal(v.paused, true)
  v.currentTime = 40
  v.dispatchEvent(new Event('seeking'))
  assert.equal(replay.state, 'moved')
  replay.newReference()
  replay.replay()
  assert.equal(v.currentTime, 32)
  replay.dispose()
  assert.equal(v.paused, false)
})
