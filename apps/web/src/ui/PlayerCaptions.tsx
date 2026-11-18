import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { SubtitleStyles } from '../playback/preferences.ts'

type Props = {
  layout: 'single' | 'paired' | 'split'
  primary: string
  secondary: string
  primaryLanguage?: string
  secondaryLanguage?: string
  styles: SubtitleStyles
}

export function PlayerCaptions({
  layout,
  primary,
  secondary,
  primaryLanguage,
  secondaryLanguage,
  styles,
}: Props) {
  const layer = useRef<HTMLDivElement>(null)
  const primaryRow = useRef<HTMLDivElement>(null)

  // Keep a long lower cue's space for as long as the same upper cue is visible.
  useLayoutEffect(() => {
    const box = layer.current
    const row = primaryRow.current
    if (layout !== 'paired' || !secondary || !box || !row) return
    let width = -1
    let height = 0
    const reserve = () => {
      const rect = row.getBoundingClientRect()
      if (rect.width !== width) {
        width = rect.width
        height = 0
      }
      height = Math.max(height, rect.height)
      box.style.setProperty('--primary-cue-space', height + 'px')
    }
    reserve()
    const observer = new ResizeObserver(reserve)
    observer.observe(row)
    return () => {
      observer.disconnect()
      box.style.removeProperty('--primary-cue-space')
    }
  }, [layout, secondary, styles.primary.scale])

  if (!primary && !secondary) return null
  const lowerCue = primary && (
    <p data-subtitle-slot="primary" lang={primaryLanguage}>
      {primary}
    </p>
  )
  return (
    <div
      ref={layer}
      className="player-captions"
      data-layout={layout}
      style={
        {
          '--primary-caption-scale': styles.primary.scale,
          '--secondary-caption-scale': styles.secondary.scale,
          '--primary-caption-color': styles.primary.color,
          '--secondary-caption-color': styles.secondary.color,
        } as CSSProperties
      }
    >
      {secondary && (
        <p data-subtitle-slot="secondary" lang={secondaryLanguage}>
          {secondary}
        </p>
      )}
      {layout === 'paired' ? (
        <div ref={primaryRow} className="player-caption-primary-row">
          {lowerCue}
        </div>
      ) : (
        lowerCue
      )}
    </div>
  )
}
