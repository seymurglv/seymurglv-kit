import { afterEach, expect, test, vi } from 'vitest'
import { followHeight, morphLabel, morphSteps } from '../../src/motion.js'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('общее начало остаётся, хвост стирается и набирается', () => {
  expect(morphSteps('Отправить', 'Отправлено')).toEqual(
    ['Отправит', 'Отправи', 'Отправ', 'Отправл', 'Отправле', 'Отправлен', 'Отправлено'])
  expect(morphSteps('да', 'да')).toEqual([])
  expect(morphSteps('', 'ок')).toEqual(['о', 'ок'])
})
test('подпись меняется по шагу в 16 мс', () => {
  vi.useFakeTimers(); const el = document.createElement('span'); el.textContent = 'Русский'
  morphLabel(el, 'English'); vi.advanceTimersByTime(16 * 14); expect(el.textContent).toBe('English')
})
test('новый вызов отменяет прежний и приходит к своему тексту', () => {
  vi.useFakeTimers(); const el = document.createElement('span'); el.textContent = 'один'
  morphLabel(el, 'первый'); vi.advanceTimersByTime(32); morphLabel(el, 'второй')
  vi.advanceTimersByTime(16 * 30); expect(el.textContent).toBe('второй')
})
test('без движения подпись меняется сразу', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true })); const el = document.createElement('span')
  el.textContent = 'a'; morphLabel(el, 'b'); expect(el.textContent).toBe('b')
})
test('ошибка в change не оставляет коробку прижатой', () => {
  const box = document.createElement('div'); document.body.append(box)
  expect(() => followHeight(box, () => { throw new Error('сбой') })).toThrow('сбой')
  expect(box.style.height).toBe(''); expect(box.style.transition).toBe(''); expect(box.style.overflow).toBe('')
  expect(box.classList.contains('ban-clip')).toBe(false); box.remove()
})
