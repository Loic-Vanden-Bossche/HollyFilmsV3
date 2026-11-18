// The recovery page also works when application bundles have never been loaded.
let preference
try {
  preference = localStorage.getItem('hollyfilms.language')
} catch {
  // Storage can be disabled in private browsing.
}
const language = ['en', 'fr', 'zh-Hans'].includes(preference)
  ? preference
  : (navigator.languages
      .map((value) => value.toLowerCase().split('-')[0])
      .find((value) => ['en', 'fr', 'zh'].includes(value)) ?? 'en')
const copy = language.startsWith('zh')
  ? [
      'zh-Hans',
      '目前处于离线状态',
      '重新连接网络后，即可浏览媒体库并继续播放。',
      '重试',
    ]
  : language.startsWith('en')
    ? [
        'en',
        'You’re offline',
        'Reconnect to browse your library and resume playback.',
        'Try again',
      ]
    : undefined
if (copy) {
  document.documentElement.lang = copy[0]
  document.title = 'HollyFilms · ' + copy[1]
  document.getElementById('heading').textContent = copy[1]
  document.getElementById('detail').textContent = copy[2]
  document.getElementById('retry').textContent = copy[3]
}
const retry = document.getElementById('retry')
if (location.pathname === '/offline.html') retry.href = '/app'
// A normal link works without scripting; reload also preserves a nested route.
window.addEventListener('online', () => location.replace(retry.href), {
  once: true,
})
