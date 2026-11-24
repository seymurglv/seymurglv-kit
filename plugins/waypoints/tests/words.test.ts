import { expect, test } from 'claude-code/testing'

import { pickLanguage, systemLocale, wordsFor } from '../hooks/words'

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
  expect(wordsFor('auto', 'ru-RU').loading).toBe(wordsFor('ru').loading)
  expect(wordsFor('auto', 'ru-RU').loading).not.toBe(wordsFor('fr', 'en-US').loading)
  expect(wordsFor('fr', 'en-US').loading).toBe('Looking for next steps…')
})
test('systemLocale returns a string or undefined, never throws', () => {
  const l = systemLocale()
  expect(l === undefined || typeof l === 'string').toBe(true)
})
