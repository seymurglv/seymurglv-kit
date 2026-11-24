import { expect, test } from 'claude-code/testing'

import type { LampState } from '../types'
import { MIN } from '../hooks/state'
import { clock, pickLanguage, systemLocale, tokens, wordsFor } from '../hooks/words'

const ru = wordsFor('ru')
const en = wordsFor('en')
const warm4: LampState = { kind: 'warm', leftMs: 4 * MIN - 1 }

test('ru line for each state', () => {
  expect(ru.line({ kind: 'warm', leftMs: 4 * MIN - 1 }, 180_000)).toBe('кэш тёплый · 4 мин · 180k')
  expect(ru.line({ kind: 'kept', untilMs: new Date(2026, 10, 23, 17, 40).getTime() }, 180_000)).toBe(
    'держу тёплым до 17:40 · 180k',
  )
  expect(ru.line({ kind: 'cooling', leftMs: 4 * MIN - 1 }, 180_000)).toBe('кэш остынет через 4 мин · 180k')
  expect(ru.line({ kind: 'cold', sinceMs: MIN }, 180_000)).toBe('кэш остыл · следующее сообщение перечитает 180k')
  expect(ru.line({ kind: 'unknown' }, 180_000)).toBe('')
})

test('short lamp text for each state', () => {
  const kept: LampState = { kind: 'kept', untilMs: new Date(2026, 10, 23, 17, 40).getTime() }
  expect(ru.short(warm4, 180_000)).toBe('4 мин · 180k')
  expect(ru.short(kept, 180_000)).toBe('держу до 17:40 · 180k')
  expect(ru.short({ kind: 'cooling', leftMs: 4 * MIN - 1 }, 180_000)).toBe('остынет через 4 мин · 180k')
  expect(ru.short({ kind: 'cold', sinceMs: MIN }, 180_000)).toBe('остыл · 180k')
  expect(ru.short({ kind: 'unknown' }, 180_000)).toBe('')
  expect(en.short(warm4, 180_000)).toBe('4 min · 180k')
  expect(en.short(kept, 180_000)).toBe('kept until 17:40 · 180k')
  expect(en.short({ kind: 'cooling', leftMs: 4 * MIN - 1 }, 180_000)).toBe('cools in 4 min · 180k')
  expect(en.short({ kind: 'cold', sinceMs: MIN }, 180_000)).toBe('cold · 180k')
})

test('en toast for self and other', () => {
  expect(en.toast('me', true, 4 * MIN - 1, 180_000)).toBe('this chat: 180k cache cools in 4 min')
  expect(en.toast('me', false, 4 * MIN - 1, 180_000)).toBe('me: 180k cache cools in 4 min')
  expect(ru.toast('кот', true, 4 * MIN - 1, 180_000)).toBe('этот чат: кэш 180k остынет через 4 мин')
  expect(ru.toast('кот', false, 4 * MIN - 1, 180_000)).toBe('кот: кэш 180k остынет через 4 мин')
})

test('list marks this chat and includes cold sessions', () => {
  const rows = [
    { label: 'other', s: { kind: 'cold', sinceMs: MIN } as LampState, ctx: 180_000, isSelf: false },
    { label: 'mine', s: warm4, ctx: 180_000, isSelf: true },
  ]
  expect(en.list(rows)).toBe(
    'other: cache cold · the next message re-reads 180k\nthis chat: cache warm · 4 min · 180k',
  )
  expect(ru.list(rows)).toBe(
    'other: кэш остыл · следующее сообщение перечитает 180k\nэтот чат: кэш тёплый · 4 мин · 180k',
  )
})

test('stopped, command and none copy', () => {
  expect(ru.stopped('rebuilt')).toBe('подогрев выключен: пинг пересобрал кэш')
  expect(ru.stopped('noAnswer')).toBe('подогрев выключен: пинг не получил ответа')
  expect(en.stopped('rebuilt')).toBe('keep-warm off: the ping rebuilt the cache')
  expect(en.stopped('noAnswer')).toBe('keep-warm off: the ping got no answer')
  expect(ru.command).toBe('Кэш всех открытых сессий')
  expect(en.command).toBe('Cache of every open session')
  expect(ru.none).toBe('cache-lamp: открытых сессий нет')
  expect(en.none).toBe('cache-lamp: no open sessions')
})

test('tokens and clock format', () => {
  expect(tokens(950)).toBe('950')
  expect(tokens(1500)).toBe('1.5k')
  expect(tokens(180_000)).toBe('180k')
  expect(tokens(2_000_000)).toBe('2.0M')
  expect(clock(new Date(2026, 10, 23, 9, 5).getTime())).toBe('09:05')
})

test('an explicit language wins over the locale', () => {
  expect(pickLanguage('ru', 'en-US')).toBe('ru')
  expect(pickLanguage('en', 'ru-RU')).toBe('en')
})
test('auto, missing or unknown follow the locale', () => {
  for (const o of ['auto', undefined, 'fr']) {
    expect(pickLanguage(o, 'ru-RU')).toBe('ru')
    expect(pickLanguage(o, 'en-US')).toBe('en')
  }
})
test('ru locales in any spelling, others English', () => {
  for (const l of ['ru', 'RU', 'ru_RU', 'ru-RU']) expect(pickLanguage('auto', l)).toBe('ru')
  for (const l of ['uk-UA', 'rus', '', undefined]) expect(pickLanguage('auto', l)).toBe('en')
})
test('wordsFor follows pickLanguage', () => {
  expect(wordsFor('auto', 'ru-RU').none).toBe('cache-lamp: открытых сессий нет')
  expect(wordsFor('fr', 'en-US').none).toBe('cache-lamp: no open sessions')
  expect(wordsFor(undefined).command).toBe('Cache of every open session')
})
test('systemLocale returns a string or undefined, never throws', () => {
  const l = systemLocale()
  expect(l === undefined || typeof l === 'string').toBe(true)
})
