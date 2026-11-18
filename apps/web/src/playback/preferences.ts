export type SubtitleSlot = 'primary' | 'secondary'
export type SubtitleStyle = {
  color: string
  scale: number
  customized: boolean
}
export const classicSubtitle: SubtitleStyle = {
  color: '#ffffff',
  scale: 1,
  customized: false,
}
export const subtitleYellow = '#ffe066'
export type SubtitleStyles = Record<SubtitleSlot, SubtitleStyle>

function readStyle(
  value: Partial<SubtitleStyle> | undefined,
  fallback: SubtitleStyle,
): SubtitleStyle {
  return {
    color:
      typeof value?.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color)
        ? value.color.toLowerCase()
        : fallback.color,
    scale:
      typeof value?.scale === 'number' &&
      value.scale >= 0.7 &&
      value.scale <= 1.8
        ? value.scale
        : fallback.scale,
    customized:
      typeof value?.customized === 'boolean'
        ? value.customized
        : fallback.customized,
  }
}

const defaults = {
  volume: 1,
  muted: false,
  rate: 1,
  fit: 'contain' as 'contain' | 'cover' | 'fill',
  subtitleStyles: { primary: classicSubtitle, secondary: classicSubtitle },
  autoNext: true,
  allowSystemPause: true,
  askAfterEpisodes: false,
  bitrate: 0,
}

export type PlaybackPreferences = typeof defaults

export function readPlaybackPreferences(userId: string): PlaybackPreferences {
  try {
    const data: Partial<PlaybackPreferences> & {
      subtitleColor?: string
      subtitleScale?: number
    } =
      JSON.parse(
        localStorage.getItem('hollyfilms.playback.' + userId) ?? '{}',
      ) ?? {}
    const legacy = readStyle(
      { color: data.subtitleColor, scale: data.subtitleScale },
      classicSubtitle,
    )
    legacy.customized =
      legacy.color !== classicSubtitle.color ||
      legacy.scale !== classicSubtitle.scale
    return {
      volume:
        typeof data.volume === 'number' && data.volume >= 0 && data.volume <= 1
          ? data.volume
          : defaults.volume,
      muted: data.muted === true,
      rate:
        typeof data.rate === 'number' && data.rate >= 0.5 && data.rate <= 2
          ? data.rate
          : defaults.rate,
      fit: data.fit === 'cover' || data.fit === 'fill' ? data.fit : 'contain',
      subtitleStyles: {
        primary: readStyle(data.subtitleStyles?.primary, legacy),
        secondary: readStyle(data.subtitleStyles?.secondary, legacy),
      },
      autoNext: data.autoNext !== false,
      allowSystemPause: data.allowSystemPause !== false,
      askAfterEpisodes: data.askAfterEpisodes === true,
      bitrate:
        typeof data.bitrate === 'number' &&
        data.bitrate > 0 &&
        data.bitrate <= 120_000_000
          ? data.bitrate
          : 0,
    }
  } catch {
    return defaults
  }
}

export function savePlaybackPreferences(
  userId: string,
  values: PlaybackPreferences,
) {
  try {
    localStorage.setItem(
      'hollyfilms.playback.' + userId,
      JSON.stringify(values),
    )
  } catch {
    /* Private mode can block persistent preferences. */
  }
}
