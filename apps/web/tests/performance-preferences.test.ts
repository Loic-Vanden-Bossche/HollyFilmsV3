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

test('member and administrator choices survive reload, sign-out and StrictMode cleanup', () => {
  for (const admin of [false, true]) {
    const saved = storage()
    const bind = (controller: PerformanceController) =>
      bindPerformancePreference(
        controller,
        '/jellyfin',
        'viewer',
        admin,
        () => saved,
      )
    const first = new PerformanceController()
    const stop = bind(first)
    assert.equal(first.getSettings().admin, admin)
    first.select('light', 1)
    stop()
    assert.equal(first.getSettings().selection, 'cinema')
    assert.equal(first.getSettings().admin, false)
    assert.deepEqual([...saved.values.values()], ['light'])
    const reloaded = new PerformanceController()
    bind(reloaded)()
    const cleanup = bind(reloaded)
    assert.equal(reloaded.getSettings().profile.id, 'light')
    reloaded.select('cinema', 2)
    cleanup()
    assert.deepEqual([...saved.values.values()], ['cinema'])
  }
})

test('stored preferences are isolated by verified account and server', () => {
  const saved = storage()
  const controller = new PerformanceController()
  const bind = (server: string, user: string, admin = false) =>
    bindPerformancePreference(controller, server, user, admin, () => saved)
  const stop = bind('server-a', 'viewer-a')
  controller.select('light', 1)
  stop()
  for (const [server, user] of [
    ['server-a', 'viewer-b'],
    ['server-b', 'viewer-a'],
  ]) {
    const unbind = bind(server, user)
    assert.equal(controller.getSettings().selection, 'cinema')
    unbind()
  }
  const promoted = bind('server-a', 'viewer-a', true)
  assert.equal(controller.getSettings().admin, true)
  assert.equal(controller.getSettings().profile.id, 'light')
  promoted()
  let reads = 0
  const anonymous = bindPerformancePreference(
    controller,
    'server-a',
    null,
    true,
    () => {
      reads++
      return saved
    },
  )
  assert.equal(reads, 0)
  assert.equal(controller.getSettings().admin, false)
  anonymous()
})

test('a restored catalogue and a second tab pick up the current account choice', (t) => {
  const browser = new EventTarget()
  Object.defineProperty(globalThis, 'window', {
    value: browser,
    configurable: true,
  })
  t.after(() => Reflect.deleteProperty(globalThis, 'window'))
  const saved = storage()
  const key = 'hollyfilms:performance:v1:server:member'
  const controller = new PerformanceController()
  const stop = bindPerformancePreference(
    controller,
    'server',
    'member',
    false,
    () => saved,
  )
  saved.setItem(key, 'light')
  browser.dispatchEvent(
    Object.assign(new Event('storage'), { key: key + '-other' }),
  )
  assert.equal(controller.getSettings().profile.id, 'cinema')
  browser.dispatchEvent(
    Object.assign(new Event('pageshow'), { persisted: true }),
  )
  assert.equal(controller.getSettings().profile.id, 'light')
  saved.setItem(key, 'cinema')
  browser.dispatchEvent(Object.assign(new Event('storage'), { key }))
  assert.equal(controller.getSettings().profile.id, 'cinema')
  stop()
  saved.setItem(key, 'light')
  browser.dispatchEvent(
    Object.assign(new Event('pageshow'), { persisted: true }),
  )
  assert.equal(controller.getSettings().profile.id, 'cinema')
})

test('legacy choices are migrated in place for the current account', () => {
  for (const [stored, expected] of [
    ['essential', 'light'],
    ['light', 'light'],
    ['balanced', 'cinema'],
    ['high', 'cinema'],
    ['ultra', 'cinema'],
    ['auto', 'cinema'],
    ['invalid', 'cinema'],
  ]) {
    const saved = storage()
    const key = 'hollyfilms:performance:v1:%2Fjellyfin:existing%2Fuser'
    saved.values.set(key, stored)
    const controller = new PerformanceController()
    const stop = bindPerformancePreference(
      controller,
      '/jellyfin',
      'existing/user',
      false,
      () => saved,
    )
    assert.equal(controller.getSettings().profile.id, expected)
    assert.equal(saved.getItem(key), expected)
    stop()
  }
})

test('blocked storage leaves both modes usable', () => {
  const controller = new PerformanceController()
  const cleanup = bindPerformancePreference(
    controller,
    'server',
    'member',
    false,
    () => {
      throw new Error('Storage disabled')
    },
  )
  controller.select('light', 1)
  assert.equal(controller.getSettings().profile.id, 'light')
  controller.select('cinema', 2)
  assert.equal(controller.getSettings().profile.id, 'cinema')
  cleanup()
})
