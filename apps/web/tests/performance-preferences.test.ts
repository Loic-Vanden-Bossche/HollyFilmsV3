import assert from 'node:assert/strict'
import test from 'node:test'
import { PerformanceController } from '../src/performance/profiles.ts'
import { bindPerformancePreference } from '../src/performance/preferences.ts'

function storage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

test('admin choice survives reload and StrictMode cleanup; Auto is also saved', () => {
  const saved = storage()
  const bind = (controller: PerformanceController) =>
    bindPerformancePreference(
      controller,
      '/jellyfin',
      'admin',
      () => saved,
      () => 0,
    )
  const first = new PerformanceController()
  const stop = bind(first)
  first.select('ultra', 1)
  stop()
  assert.equal([...saved.values.values()][0], 'ultra')
  const reloaded = new PerformanceController()
  const cleanup = bind(reloaded)
  assert.equal(reloaded.getSettings().selection, 'ultra')
  assert.equal(reloaded.getSettings().profile.id, 'ultra')
  reloaded.select('auto', 2)
  cleanup()
  const next = new PerformanceController()
  bind(next)()
  assert.equal(next.getSettings().selection, 'auto')
  assert.equal([...saved.values.values()][0], 'auto')
})

test('preferences are isolated by verified account and server, members never read them', () => {
  const saved = storage()
  const first = new PerformanceController()
  const stop = bindPerformancePreference(
    first,
    'server-a',
    'admin-a',
    () => saved,
  )
  first.select('light', 1)
  stop()
  for (const [server, admin] of [
    ['server-a', 'admin-b'],
    ['server-b', 'admin-a'],
  ]) {
    const other = new PerformanceController()
    bindPerformancePreference(other, server, admin, () => saved)()
    assert.equal(other.getSettings().selection, 'auto')
  }
  let reads = 0
  const member = new PerformanceController()
  bindPerformancePreference(member, 'server-a', null, () => {
    reads++
    return saved
  })()
  assert.equal(reads, 0)
  assert.equal(member.getSettings().admin, false)
})

test('invalid or inaccessible storage cannot block authentication or runtime selection', () => {
  const saved = storage()
  const controller = new PerformanceController()
  const stop = bindPerformancePreference(
    controller,
    'server',
    'admin',
    () => saved,
  )
  controller.select('ultra', 1)
  stop()
  for (const key of saved.values.keys()) saved.values.set(key, 'invalid')
  const invalid = new PerformanceController()
  bindPerformancePreference(invalid, 'server', 'admin', () => saved)()
  assert.equal(invalid.getSettings().selection, 'auto')
  const blocked = new PerformanceController()
  const cleanup = bindPerformancePreference(blocked, 'server', 'admin', () => {
    throw new Error('Storage disabled')
  })
  blocked.select('high', 1)
  assert.equal(blocked.getSettings().profile.id, 'high')
  cleanup()
})
