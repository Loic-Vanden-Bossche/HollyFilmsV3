import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRequestFollowUp,
  requestFollowUpKey,
} from '../src/request-follow-up.ts'

test('a successful request claims the suggestion once, including after reload', () => {
  const values = new Map<string, string>()
  const storage = () => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  })
  const claim = createRequestFollowUp(storage)
  assert.equal(claim('user-a'), true)
  assert.equal(claim('user-a'), false)
  assert.equal(createRequestFollowUp(storage)('user-a'), false)
  assert.equal(claim('user-b'), true)
  assert.equal(values.get(requestFollowUpKey('user-a')), 'shown')
})
test('blocked storage keeps a once-only fallback without preventing the request', () => {
  const claim = createRequestFollowUp(() => {
    throw new Error('Storage blocked')
  })
  assert.equal(claim('user-a'), true)
  assert.equal(claim('user-a'), false)
  assert.equal(claim('user-b'), true)
})
