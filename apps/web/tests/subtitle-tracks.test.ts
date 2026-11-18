import assert from 'node:assert/strict'
import test from 'node:test'
import {
  refreshSubtitleSource,
  remapSubtitleIndex,
} from '../src/playback/subtitle-tracks.ts'
import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/index.js'
test('refreshing subtitle metadata preserves the active media source and remaps both selected languages', () => {
  const previous: MediaSourceInfo = {
    Id: 'source',
    DirectStreamUrl: '/video.mp4',
    DefaultSubtitleStreamIndex: 2,
    MediaStreams: [
      { Type: 'Video', Index: 0, Codec: 'h264' },
      { Type: 'Audio', Index: 1, Codec: 'aac' },
      {
        Type: 'Subtitle',
        Index: 2,
        Language: 'fra',
        Codec: 'subrip',
        IsExternal: true,
        Path: '/movie.fr.srt',
        DeliveryMethod: 'External',
      },
      {
        Type: 'Subtitle',
        Index: 3,
        Language: 'zho',
        Codec: 'ass',
        IsExternal: true,
        Path: '/movie.zh.ass',
      },
    ],
  }
  const fresh: MediaSourceInfo = {
    Id: 'source',
    DirectStreamUrl: '/different-do-not-replace.mp4',
    MediaStreams: [
      {
        Type: 'Subtitle',
        Index: 4,
        Language: 'fra',
        Codec: 'subrip',
        IsExternal: true,
        Path: '/movie.fr.srt',
      },
      {
        Type: 'Subtitle',
        Index: 5,
        Language: 'zho',
        Codec: 'ass',
        IsExternal: true,
        Path: '/movie.zh.ass',
      },
      {
        Type: 'Subtitle',
        Index: 3,
        Language: 'deu',
        Codec: 'subrip',
        IsExternal: true,
        Path: '/movie.de.srt',
      },
    ],
  }
  const result = refreshSubtitleSource(previous, fresh)
  assert.equal(result.DirectStreamUrl, previous.DirectStreamUrl)
  assert.deepEqual(
    result.MediaStreams?.filter((track) => track.Type !== 'Subtitle'),
    previous.MediaStreams?.filter((track) => track.Type !== 'Subtitle'),
  )
  assert.equal(
    result.MediaStreams?.filter((track) => track.Type === 'Subtitle').length,
    3,
  )
  assert.equal(
    remapSubtitleIndex(previous.MediaStreams!, result.MediaStreams!, 2),
    4,
  )
  assert.equal(
    remapSubtitleIndex(previous.MediaStreams!, result.MediaStreams!, 3),
    5,
  )
  assert.equal(
    remapSubtitleIndex(previous.MediaStreams!, result.MediaStreams!, -1),
    -1,
  )
  assert.equal(
    previous.MediaStreams?.length,
    4,
    'The negotiated snapshot is never mutated',
  )
})
