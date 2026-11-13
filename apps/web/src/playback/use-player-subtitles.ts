import { useEffect, useRef, useState } from 'react'
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
  delay: number
  onError: (message: string) => void
}

function useTrack(
  { api, videoRef, playback, delay, onError }: CaptionsInput,
  selected?: MediaStream,
) {
  const [caption, setCaption] = useState('')
  const delayRef = useRef(delay)
  const updateOffset = useRef<(() => void) | undefined>(undefined)
  useEffect(() => {
    delayRef.current = delay
    updateOffset.current?.()
  }, [delay])
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
    const codec = selected.Codec?.toLowerCase() ?? ''
    const path =
      'Videos/' +
      encodeURIComponent(target.id) +
      '/' +
      encodeURIComponent(stream.source.Id)
    const subPath = path + '/Subtitles/' + selected.Index + '/0/Stream.'
    const offset = () => stream.offset - delayRef.current
    const fail = () =>
      onError('Cette piste de sous-titres ne peut pas être affichée.')
    let cancelled = false
    let dispose: (() => void) | undefined
    let canvas: HTMLCanvasElement | undefined
    const createCanvas = () => {
      canvas = document.createElement('canvas')
      canvas.className = 'player-subtitle-canvas'
      canvas.style.position = 'absolute'
      canvas.style.pointerEvents = 'none'
      canvas.style.zIndex = '1'
      video.insertAdjacentElement('afterend', canvas)
      return canvas
    }

    if (/^(ass|ssa)$/.test(codec)) {
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
          subUrl: api.mediaUrl(subPath + 'ass'),
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
          subUrl: api.mediaUrl(subPath + extension),
          timeOffset: offset(),
          onError: () => {
            if (!cancelled) fail()
          },
        }
        const renderer = pgs
          ? new PgsRenderer(options)
          : new VobSubRenderer({ ...options, fileName: 'subtitles.mks' })
        updateOffset.current = () => {
          renderer.timeOffset = offset()
        }
        updateOffset.current()
        dispose = () => renderer.dispose()
      })().catch(() => {
        if (!cancelled) fail()
      })
    } else {
      const element = document.createElement('track')
      element.kind = 'subtitles'
      element.label =
        selected.DisplayTitle ?? selected.Language ?? 'Sous-titres'
      element.srclang = selected.Language ?? 'und'
      element.src = api.mediaUrl(subPath + 'vtt')
      const read = () => {
        const cues = Array.from(element.track.cues ?? []).filter(
          (cue) =>
            cue.startTime <= video.currentTime &&
            cue.endTime > video.currentTime,
        )
        setCaption(
          cues
            .map((cue) =>
              cue instanceof VTTCue ? cue.getCueAsHTML().textContent : '',
            )
            .filter(Boolean)
            .join('\n'),
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
          const end = entry.end - offset()
          if (end <= 0) {
            if (entry.attached) element.track.removeCue(entry.cue)
            entry.attached = false
          } else {
            entry.cue.endTime = end
            entry.cue.startTime = Math.max(0, entry.start - offset())
            if (!entry.attached) element.track.addCue(entry.cue)
            entry.attached = true
          }
        }
        read()
      }
      updateOffset.current = adjust
      element.addEventListener('load', () => {
        originals = Array.from(element.track.cues ?? []).map((cue) => ({
          cue,
          start: cue.startTime,
          end: cue.endTime,
          attached: true,
        }))
        adjust()
      })
      element.addEventListener('error', fail)
      element.track.addEventListener('cuechange', read)
      video.appendChild(element)
      element.track.mode = 'hidden'
      dispose = () => {
        element.track.removeEventListener('cuechange', read)
        element.track.mode = 'disabled'
        element.remove()
        setCaption('')
      }
    }
    return () => {
      cancelled = true
      updateOffset.current = undefined
      dispose?.()
      canvas?.remove()
    }
  }, [api, videoRef, playback, selected, onError])
  return selected ? caption : ''
}

export function usePlayerSubtitles(
  options: CaptionsInput & { primary?: MediaStream; secondary?: MediaStream },
) {
  const primary = useTrack(options, options.primary)
  const secondary = useTrack(options, options.secondary)
  return { primary, secondary }
}
