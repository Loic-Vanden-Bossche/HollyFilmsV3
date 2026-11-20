import { cueInterval } from '/shared.mjs'
import { openCalculator } from './calculator.mjs'

const mode = new URL(location.href).searchParams.get('mode')
const video = document.querySelector('video')
const track = video.addTextTrack('subtitles', 'Français', 'fr')
track.mode = 'hidden'
const source = Array.from({ length: 1800 }, (_, id) => {
  const start = id * 4000
  const end = start + 3000
  const cue = new VTTCue(start / 1000, end / 1000, 'Dialogue ' + id)
  track.addCue(cue)
  return { start, end, cue, attached: true }
})
const button = document.querySelector('button')
const caption = document.querySelector('output')
let manual = 0
let calculator
let worker

function packSource() {
  const values = new Float64Array(source.length * 2)
  source.forEach(({ start, end }, index) => {
    values[2 * index] = start
    values[2 * index + 1] = end
  })
  return values
}

function apply(entry, start, end) {
  if (start < 0) {
    if (entry.attached) track.removeCue(entry.cue)
    entry.attached = false
    return
  }
  if (entry.cue.endTime !== end) entry.cue.endTime = end
  if (entry.cue.startTime !== start) entry.cue.startTime = start
  if (!entry.attached) track.addCue(entry.cue)
  entry.attached = true
}

async function intervalsInWorker(params) {
  const input = worker ? undefined : packSource()
  worker ??= new Worker('./calculator.mjs?worker', { type: 'module' })
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) =>
      data.error ? reject(new Error(data.error)) : resolve(data)
    worker.onerror = reject
    worker.postMessage({ input, params }, input ? [input.buffer] : [])
  })
}

function display() {
  const time = video.currentTime
  caption.textContent = Array.from(track.cues)
    .filter((cue) => cue.startTime <= time && cue.endTime > time)
    .map((cue) => cue.text)
    .join('\n')
}

async function run() {
  const started = performance.now()
  manual += 4000
  const params = {
    scale: 1,
    shift: 0,
    manual,
    origin: 0,
    duration: video.duration,
  }
  const correction = { automatic: null, manualMs: manual }
  let downloadMs = 0
  let compileMs = 0
  let computeAndMessagesMs = 0
  if (mode === 'js') {
    // Same single pass as the production useTrack adjust handler.
    for (const item of source) {
      const result = cueInterval(
        item.start,
        item.end,
        correction,
        params.origin,
        params.duration,
      )
      apply(item, result?.start ?? -1, result?.end ?? -1)
    }
  } else {
    let values
    if (mode === 'worker') {
      const answer = await intervalsInWorker(params)
      downloadMs = answer.downloadMs
      compileMs = answer.compileMs
      values = answer.times
    } else {
      if (!calculator) {
        calculator = await openCalculator(packSource())
        downloadMs = calculator.downloadMs
        compileMs = calculator.compileMs
      }
      values = calculator.calculate(params)
    }
    computeAndMessagesMs = performance.now() - started
    source.forEach((item, i) => apply(item, values[2 * i], values[2 * i + 1]))
  }
  display()
  const workMs = performance.now() - started
  // One opportunity for the updated caption to be painted before the second callback.
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  )
  const readyMs = performance.now() - started
  for (const item of source) {
    const expected = cueInterval(
      item.start,
      item.end,
      correction,
      params.origin,
      params.duration,
    )
    if (
      item.attached !== Boolean(expected) ||
      (expected &&
        (item.cue.startTime !== expected.start ||
          item.cue.endTime !== expected.end))
    )
      throw new Error('Different native cue interval')
  }
  const expectedCaption = 'Dialogue ' + (10 - manual / 4000)
  if (caption.textContent !== expectedCaption)
    throw new Error('Incorrect displayed caption')
  return {
    readyMs,
    workMs,
    downloadMs,
    compileMs,
    computeAndMessagesMs,
    caption: caption.textContent,
  }
}

button.onclick = () => {
  window.timingResult = run()
}
video.addEventListener('loadedmetadata', () => {
  video.currentTime = 40.5
})
video.addEventListener('seeked', () => {
  if (video.duration !== 7200) throw new Error('Wrong comparison fixture')
  display()
  button.disabled = false
})
video.src = '/film.webm'
