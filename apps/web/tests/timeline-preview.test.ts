import assert from 'node:assert/strict'
import test from 'node:test'
import { timelinePreview } from '../src/playback/timeline-preview.ts'

const mediaUrl = (path: string, params: Record<string, string> = {}) =>
  '/jellyfin/' + path + '?' + new URLSearchParams(params)
const details = {
  Id: 'abcd',
  Trickplay: {
    'AB-CD': {
      '320': {
        Width: 320,
        Height: 180,
        TileWidth: 2,
        TileHeight: 2,
        Interval: 1000,
        ThumbnailCount: 7,
      },
    },
  },
}

test('preview crops and scales the correct frame across sprite sheets', () => {
  const frame = timelinePreview(details, 'abcd', 5, mediaUrl)!
  assert.match(frame.url, /Trickplay\/320\/1.jpg\?MediaSourceId=abcd/)
  assert.equal(frame.width, 224)
  assert.equal(frame.sheetWidth, 448)
  assert.equal(frame.x, 224)
  assert.equal(frame.y, 0)
  assert(
    Math.abs(timelinePreview(details, 'abcd', 1000, mediaUrl)!.y - 126) < 0.001,
  )
  assert.equal(timelinePreview(details, 'abcd', -10, mediaUrl)?.x, 0)
})

test('never uses previews from a different media version', () => {
  assert.equal(
    timelinePreview(details, 'other-version', 3, mediaUrl),
    undefined,
  )
})

test('uses the preceding available chapter image when tiles are missing', () => {
  const chapters = {
    Id: 'abcd',
    Chapters: [
      { StartPositionTicks: 0, Name: 'Ouverture', ImageTag: 'tag0' },
      { StartPositionTicks: 100_000_000, Name: 'Suite', ImageTag: 'tag1' },
    ],
  }
  const frame = timelinePreview(chapters, 'abcd', 15, mediaUrl)!
  assert.match(frame.url, /Images\/Chapter\/1\?tag=tag1/)
  assert.equal(frame.label, 'Suite')
  assert.equal(
    timelinePreview(chapters, 'other-version', 15, mediaUrl),
    undefined,
  )
})

test('missing or invalid preview data has no image URL', () => {
  assert.equal(timelinePreview(undefined, 'abcd', 0, mediaUrl), undefined)
  assert.equal(timelinePreview({ Id: 'abcd' }, 'abcd', 0, mediaUrl), undefined)
  assert.equal(timelinePreview(details, 'abcd', NaN, mediaUrl), undefined)
})
