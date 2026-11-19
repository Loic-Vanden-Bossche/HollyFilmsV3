import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import {
  clearSession,
  readSession,
  subscribeToSession,
  writeSession,
} from '../src/session.ts'

const key = 'hollyfilms.jellyfin.session'
const previous = { accessToken: 'old-test-token', deviceId: 'old-device' }
const latest = { accessToken: 'new-test-token', deviceId: 'new-device' }

function fakeStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => values.set(name, value),
    removeItem: (name: string) => values.delete(name),
  }
}

function fakeBrowser(t: TestContext) {
  const localStorage = fakeStorage()
  const sessionStorage = fakeStorage()
  const browser = Object.assign(new EventTarget(), {
    localStorage,
    sessionStorage,
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: browser,
  })
  t.after(() => Reflect.deleteProperty(globalThis, 'window'))
  return browser
}

test('migrates a tab session once and prevents it from returning after sign-out', (t) => {
  const { localStorage, sessionStorage } = fakeBrowser(t)
  sessionStorage.setItem(key, JSON.stringify(previous))
  assert.deepEqual(readSession(), previous)

  const changed = t.mock.fn()
  const unsubscribe = subscribeToSession(changed)
  t.after(unsubscribe)
  assert.deepEqual(changed.mock.calls[0].arguments, [previous])
  assert.equal(localStorage.getItem(key), JSON.stringify(previous))
  assert.equal(sessionStorage.getItem(key), null)

  assert.equal(clearSession(previous), null)
  sessionStorage.setItem(key, JSON.stringify(previous))
  assert.equal(readSession(), null)
})

test('an older tab re-reads the current session and cannot clear a newer login', (t) => {
  const browser = fakeBrowser(t)
  writeSession(previous)
  const changed = t.mock.fn()
  t.after(subscribeToSession(changed))

  browser.localStorage.setItem(key, JSON.stringify(latest))
  browser.dispatchEvent(
    Object.assign(new Event('storage'), {
      key,
      storageArea: browser.localStorage,
      newValue: JSON.stringify(previous),
    }),
  )
  assert.deepEqual(changed.mock.calls[1].arguments, [latest])
  assert.deepEqual(clearSession(previous), latest)
  assert.deepEqual(readSession(), latest)
})

test('retains the tab session when persistent storage is blocked', (t) => {
  const browser = fakeBrowser(t)
  Object.defineProperty(browser, 'localStorage', {
    get() {
      throw new Error('Storage is blocked')
    },
  })
  writeSession(latest)
  assert.deepEqual(readSession(), latest)
  assert.equal(clearSession(latest), null)
  assert.equal(readSession(), null)
})
