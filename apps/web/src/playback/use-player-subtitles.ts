import { useEffect, useRef, useState } from 'react'
import {
  correctedTime,
  cueInterval,
  type Correction,
  type SourceCue,
} from '@hollyfilms/shared/subtitle-sync'
import { subtitleRevision } from './subtitle-tracks.ts'
import type { SubtitleStyles } from './preferences.ts'
import type { RefObject } from 'react'
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/index.js'
import type {
  PlaybackApi,
  PlaybackStream,
  PlaybackTarget,
} from './playback-api.ts'

type CaptionsInput = {
  api: PlaybackApi
  videoRef: RefObject<HTMLVideoElement | null>
  playback?: { target: PlaybackTarget; stream: PlaybackStream }
  corrections: Record<'primary' | 'secondary', Correction>
  split?: boolean
  styles: SubtitleStyles
  onError: (message: string) => void
}

function useTrack(
  {
    api,
    videoRef,
    playback,
    corrections,
    split,
    styles,
    onError,
  }: CaptionsInput,
  selected?: MediaStream,
  slot: 'primary' | 'secondary' = 'primary',
  plainText = false,
) {
  const [caption, setCaption] = useState<{
    track?: MediaStream
    playback?: CaptionsInput['playback']
    plainText?: boolean
    text: string
  }>({ text: '' })
  const timing = corrections[slot]
  const timingRef = useRef(timing)
  const [transcript, setTranscript] = useState<{
    selected: MediaStream
    playback: CaptionsInput['playback']
    plainText: boolean
    getCues: () => SourceCue[]
  }>()
  const updateOffset = useRef<(() => void) | undefined>(undefined)
  const scale = styles[slot].scale
  const bitmapScale = useRef(scale)
  const bitmapRenderer = useRef<
    { setDisplaySettings(settings: { scale: number }): void } | undefined
  >(undefined)
  useEffect(() => {
    bitmapScale.current = scale
    bitmapRenderer.current?.setDisplaySettings({ scale })
  }, [scale])
  useEffect(() => {
    timingRef.current = timing
    updateOffset.current?.()
  }, [timing])
  useEffect(() => {
    const video = videoRef.current
    if (
      !video ||
      !playback ||
      selected?.Index == null ||
      selected.DeliveryMethod === 'Encode'
    )
      return
    const { target, stream } = playback
    const revision = {
      SubtitleRevision: subtitleRevision(stream.source.MediaStreams ?? []),
    }
    const codec = selected.Codec?.toLowerCase() ?? ''
    const path =
      'Videos/' +
      encodeURIComponent(target.id) +
      '/' +
      encodeURIComponent(stream.source.Id)
    const subPath = path + '/Subtitles/' + selected.Index + '/0/Stream.'
    const offset = () =>
      stream.offset - correctedTime(0, timingRef.current) / 1000
    const fail = () =>
      onError('Cette piste de sous-titres ne peut pas être affichée.')
    let cancelled = false
    let dispose: (() => void) | undefined
    let canvas: HTMLCanvasElement | undefined
    const createCanvas = () => {
      canvas = document.createElement('canvas')
      canvas.className = 'player-subtitle-canvas'
      canvas.dataset.subtitleSlot = slot
      canvas.dataset.bitmap = String(/pgs|dvd|vobsub/.test(codec))
      canvas.dataset.split = String(Boolean(split))
      canvas.style.position = 'absolute'
      canvas.style.pointerEvents = 'none'
      canvas.style.zIndex = '1'
      video.insertAdjacentElement('afterend', canvas)
      return canvas
    }

    if (/^(ass|ssa)$/.test(codec) && !plainText) {
      void (async () => {
        const { default: AssRenderer } = await import('jassub')
        if (cancelled) return
        const fonts = (stream.source.MediaAttachments ?? [])
          .filter(
            (entry) =>
              entry.Index != null &&
              /\.(ttf|otf|woff2?)$/i.test(entry.FileName ?? ''),
          )
          .map((entry) => api.mediaUrl(path + '/Attachments/' + entry.Index))
        const renderer = new AssRenderer({
          video,
          canvas: createCanvas(),
          subUrl: api.mediaUrl(subPath + 'ass', revision),
          timeOffset: offset(),
          fonts,
          queryFonts: false,
        })
        dispose = () => {
          void renderer.destroy().catch(() => {})
        }
        await renderer.ready
        if (cancelled) return
        updateOffset.current = () => {
          renderer.timeOffset = offset()
          if (video.videoWidth)
            void renderer
              .manualRender(
                {
                  mediaTime: video.currentTime,
                  width: video.videoWidth,
                  height: video.videoHeight,
                  expectedDisplayTime: performance.now(),
                },
                true,
              )
              .catch(() => {
                if (!cancelled) fail()
              })
        }
        updateOffset.current()
        if (video.videoWidth) await renderer.resize(true)
      })().catch((error) => {
        if (!cancelled) {
          console.warn(
            'ASS subtitle renderer:',
            error instanceof Error
              ? error.name + ': ' + error.message.split('?')[0]
              : 'initialization failed',
          )
          fail()
        }
      })
    } else if (/pgs|dvd|vobsub/.test(codec)) {
      void (async () => {
        const { PgsRenderer, VobSubRenderer } = await import('libbitsub')
        if (cancelled) return
        const pgs = codec.includes('pgs')
        const extension = pgs ? 'sup' : 'mks'
        const options = {
          video,
          canvas: createCanvas(),
          subUrl: api.mediaUrl(subPath + extension, revision),
          timeOffset: offset(),
          onError: () => {
            if (!cancelled) fail()
          },
          displaySettings: { scale: bitmapScale.current },
        }
        const renderer = pgs
          ? new PgsRenderer(options)
          : new VobSubRenderer({ ...options, fileName: 'subtitles.mks' })
        updateOffset.current = () => {
          renderer.timeOffset = offset()
        }
        updateOffset.current()
        bitmapRenderer.current = renderer
        dispose = () => {
          bitmapRenderer.current = undefined
          renderer.dispose()
        }
      })().catch(() => {
        if (!cancelled) fail()
      })
    } else {
      const element = document.createElement('track')
      element.kind = 'subtitles'
      element.label =
        selected.DisplayTitle ?? selected.Language ?? 'Sous-titres'
      element.srclang = selected.Language ?? 'und'
      element.src = api.mediaUrl(subPath + 'vtt', revision)
      const cueText = new WeakMap<TextTrackCue, string>()
      const textOf = (cue: TextTrackCue) => {
        let text = cueText.get(cue)
        if (text === undefined) {
          text =
            cue instanceof VTTCue ? (cue.getCueAsHTML().textContent ?? '') : ''
          cueText.set(cue, text)
        }
        return text
      }
      let lastText: string | undefined
      const display = (cues: TextTrackCue[]) => {
        const text = cues.map(textOf).filter(Boolean).join('\n')
        if (text !== lastText) {
          lastText = text
          setCaption({ track: selected, playback, plainText, text })
        }
      }
      const read = () => display(Array.from(element.track.activeCues ?? []))
      // A seek or timing edit can run before the browser updates activeCues,
      // especially on a paused frame. Reflect that change synchronously.
      const readAtPosition = () => {
        const time = video.currentTime
        display(
          Array.from(element.track.cues ?? []).filter(
            (cue) => cue.startTime <= time && cue.endTime > time,
          ),
        )
      }
      // Retain original timestamps so repeated adjustments never accumulate drift,
      // and cues shifted before zero can be restored without a network reload.
      let originals: {
        cue: TextTrackCue
        start: number
        end: number
        attached: boolean
      }[] = []
      const adjust = () => {
        for (const entry of originals) {
          const interval = cueInterval(
            entry.start,
            entry.end,
            timingRef.current,
            stream.offset,
            video.duration,
          )
          if (!interval) {
            if (entry.attached) element.track.removeCue(entry.cue)
            entry.attached = false
          } else {
            if (entry.cue.endTime !== interval.end)
              entry.cue.endTime = interval.end
            if (entry.cue.startTime !== interval.start)
              entry.cue.startTime = interval.start
            if (!entry.attached) element.track.addCue(entry.cue)
            entry.attached = true
          }
        }
        readAtPosition()
      }
      updateOffset.current = adjust
      element.addEventListener('load', () => {
        if (cancelled) return
        originals = Array.from(element.track.cues ?? []).map((cue) => ({
          cue,
          start: Math.round(cue.startTime * 1000),
          end: Math.round(cue.endTime * 1000),
          attached: true,
        }))
        let transcriptCues: SourceCue[] | undefined
        setTranscript({
          plainText,
          selected,
          playback,
          // Only the sync editor needs the complete source transcript.
          getCues: () =>
            (transcriptCues ??= originals.map(({ cue, start, end }, id) => ({
              id,
              startMs: start,
              endMs: end,
              text: textOf(cue),
            }))),
        })
        adjust()
      })
      element.addEventListener('error', fail)
      element.track.addEventListener('cuechange', read)
      video.addEventListener('durationchange', adjust)
      video.addEventListener('seeked', readAtPosition)
      video.appendChild(element)
      element.track.mode = 'hidden'
      dispose = () => {
        element.track.removeEventListener('cuechange', read)
        video.removeEventListener('durationchange', adjust)
        video.removeEventListener('seeked', readAtPosition)
        element.track.mode = 'disabled'
        element.remove()
        setTranscript(undefined)
      }
    }
    return () => {
      cancelled = true
      updateOffset.current = undefined
      dispose?.()
      canvas?.remove()
    }
  }, [api, videoRef, playback, selected, onError, plainText, slot, split])
  return {
    getCues:
      transcript?.selected === selected &&
      transcript?.playback === playback &&
      transcript?.plainText === plainText
        ? transcript?.getCues
        : undefined,
    text:
      selected &&
      caption.track === selected &&
      caption.playback === playback &&
      caption.plainText === plainText
        ? caption.text
        : '',
  }
}

export function usePlayerSubtitles(
  options: CaptionsInput & { primary?: MediaStream; secondary?: MediaStream },
) {
  // Jellyfin converts styled text to VTT for bilingual playback so authored
  // positions from two ASS files cannot paint over one another.
  const bilingual = Boolean(options.secondary)
  const plainPrimary =
    /^(ass|ssa)$/i.test(options.primary?.Codec ?? '') &&
    (bilingual || options.styles.primary.customized)
  const primary = useTrack(options, options.primary, 'primary', plainPrimary)
  const secondary = useTrack(options, options.secondary, 'secondary', bilingual)
  return {
    primary: primary.text,
    secondary: secondary.text,
    getCues: { primary: primary.getCues, secondary: secondary.getCues },
  }
}
