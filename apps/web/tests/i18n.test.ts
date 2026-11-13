import assert from 'node:assert/strict'
import test from 'node:test'
import en from '../src/i18n/en.ts'
import zh from '../src/i18n/zh-Hans.ts'
import { detectLocale, translate, type Message } from '../src/i18n/messages.ts'
import { formatDuration } from '../src/format-duration.ts'

test('browser locale detection honors priority, regional variants and fallback', () => {
  assert.equal(detectLocale(['de-DE', 'fr-CA', 'en-US']), 'fr')
  assert.equal(detectLocale(['zh-CN', 'en-US']), 'zh-Hans')
  assert.equal(detectLocale(['EN-GB', 'fr']), 'en')
  assert.equal(detectLocale(['es-ES']), 'en')
  assert.equal(detectLocale([]), 'en')
})

test('English and Chinese translate every message and preserve its placeholders', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
  const placeholders = (message: string) =>
    [...message.matchAll(/\{\w+\}/g)].map(([key]) => key).sort()
  for (const message of Object.keys(en) as Message[]) {
    for (const catalogue of [en, zh]) {
      assert.ok(catalogue[message].trim(), message)
      assert.deepEqual(
        placeholders(catalogue[message]),
        placeholders(message),
        message,
      )
    }
  }
  assert.equal(
    translate('zh-Hans', 'Voir la fiche de {title}', { title: 'Arrival' }),
    '查看《Arrival》详情',
  )
  assert.equal(
    formatDuration(122, (message, values) => translate('fr', message, values)),
    '2 h 02',
  )
  assert.equal(
    formatDuration(122, (message, values) =>
      translate('zh-Hans', message, values),
    ),
    '2 小时 02 分钟',
  )
})
