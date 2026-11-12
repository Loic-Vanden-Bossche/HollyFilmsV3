const defaults = {
  volume: 1,
  muted: false,
  rate: 1,
  fit: 'contain' as 'contain' | 'cover' | 'fill',
  subtitleScale: 1,
  subtitleColor: '#ffffff',
  autoNext: true,
  askAfterEpisodes: false,
  bitrate: 0,
}

export type PlaybackPreferences = typeof defaults

export function readPlaybackPreferences(userId: string): PlaybackPreferences {
  try {
    const data: Partial<PlaybackPreferences> =
      JSON.parse(
        localStorage.getItem('hollyfilms.playback.' + userId) ?? '{}',
      ) ?? {}
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
      subtitleScale:
        typeof data.subtitleScale === 'number' &&
        data.subtitleScale >= 0.7 &&
        data.subtitleScale <= 1.8
          ? data.subtitleScale
          : 1,
      subtitleColor:
        typeof data.subtitleColor === 'string' &&
        /^#[0-9a-f]{6}$/i.test(data.subtitleColor)
          ? data.subtitleColor
          : defaults.subtitleColor,
      autoNext: data.autoNext !== false,
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
