import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { drop } from '../../src/controls/drop/drop.js'

// jsdom has no canvas; text width measures as 0 without a console error.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})
afterEach(() => { document.body.replaceChildren() })

function make() {
  const host = document.createElement('div')
  host.className = 'ban'
  const before = document.createElement('button')
  before.type = 'button'
  const el = document.createElement('div')
  el.className = 'ban-drop'
  host.append(before, el)
  document.body.append(host)
  const events: string[] = []
  for (const type of ['ban:change', 'ban:open', 'ban:close']) {
    host.addEventListener(type, e => {
      const d = (e as CustomEvent<{ state?: string } | null>).detail
      events.push(d?.state ? `${type}|${d.state}` : type)
    })
  }
  return { el, before, events, c: drop(el) }
}

const parts = (el: HTMLElement) => ({
  text: el.querySelector<HTMLButtonElement>('.ban-drop-text')!,
  close: el.querySelector<HTMLButtonElement>('.ban-drop-close')!,
  live: el.querySelector<HTMLElement>('.ban-drop-live')!,
})

test('повторный вызов: тот же контроллер, одна лампа', () => {
  const { el, c } = make()
  expect(drop(el)).toBe(c)
  expect(el.querySelectorAll('.ban-lamp').length).toBe(1)
  expect(el.classList.contains('ban-cap')).toBe(true)
})
test('show, think и rest ставят состояние и сообщают о каждой смене один раз', () => {
  const { el, events, c } = make()
  expect([c.state, el.dataset.state, el.dataset.kind]).toEqual(['rest', 'rest', undefined])
  c.rest()
  c.think()
  c.think()
  expect([c.state, el.dataset.state, el.dataset.kind]).toEqual(['thinking', 'thinking', undefined])
  c.show('attention', 'Сменится после перезапуска')
  c.show('attention', 'Сменится после перезапуска')
  expect([c.state, el.dataset.state, el.dataset.kind]).toEqual(['message', 'message', 'attention'])
  expect(el.querySelector('.ban-lamp')!.getAttribute('data-kind')).toBe('attention')
  c.show('done', 'Сохранено')
  expect(el.dataset.kind).toBe('done')
  c.rest()
  c.rest()
  expect([c.state, el.dataset.state, el.dataset.kind]).toEqual(['rest', 'rest', undefined])
  expect(el.querySelector('.ban-lamp')!.hasAttribute('data-kind')).toBe(false)
  expect(events).toEqual(['ban:change|thinking', 'ban:change|message', 'ban:change|message', 'ban:change|rest'])
})
test('кнопки вне обхода в покое и в обходе в сообщении', () => {
  const { el, c } = make()
  const { text, close } = parts(el)
  expect([text.getAttribute('tabindex'), close.getAttribute('tabindex')]).toEqual(['-1', '-1'])
  c.show('done', 'Сохранено')
  expect([text.getAttribute('tabindex'), close.getAttribute('tabindex')]).toEqual(['0', '0'])
  c.think()
  expect([text.getAttribute('tabindex'), close.getAttribute('tabindex')]).toEqual(['-1', '-1'])
  expect(close.getAttribute('aria-label')).toBe('Закрыть')
})
test('нажатие на текст сообщает ban:open и даёт покой', () => {
  const { el, before, events, c } = make()
  before.focus()
  c.show('attention', 'Есть версия 1.1')
  parts(el).text.focus()
  parts(el).text.click()
  expect(c.state).toBe('rest')
  expect(events).toEqual(['ban:change|message', 'ban:open', 'ban:change|rest'])
  expect(document.activeElement).toBe(before)
})
test('нажатие на крест сообщает ban:close и даёт покой', () => {
  const { el, events, c } = make()
  c.show('attention', 'Есть версия 1.1')
  parts(el).close.click()
  expect(c.state).toBe('rest')
  expect(events).toEqual(['ban:change|message', 'ban:close', 'ban:change|rest'])
})
test('кнопки вне сообщения не нажимаются', () => {
  const { el, events } = make()
  parts(el).text.click()
  parts(el).close.click()
  expect(events).toEqual([])
})
test('живая область держит полный текст последнего сообщения', () => {
  const { el, c } = make()
  const { live } = parts(el)
  expect(live.getAttribute('aria-live')).toBe('polite')
  expect(live.textContent).toBe('')
  c.show('attention', 'Сменится после перезапуска')
  c.show('attention', 'Есть версия 1.1')
  expect(live.textContent).toBe('Есть версия 1.1')
  c.rest()
  expect(live.textContent).toBe('')
})
test('пустой текст ничего не показывает', () => {
  const { events, c } = make()
  c.show('done', '')
  expect(c.state).toBe('rest')
  expect(events).toEqual([])
})
test('destroy оставляет голый пустой элемент', () => {
  const { el, c } = make()
  c.show('attention', 'Есть версия 1.1')
  c.destroy()
  expect(el.outerHTML).toBe('<div class="ban-drop"></div>')
  expect(drop(el)).not.toBe(c)
})
test('сообщение, показанное из обработчика ban:close, остаётся', () => {
  const { el, events, c } = make()
  // On the same element as the recorder and after it, so the record keeps the order of the presses.
  el.parentElement!.addEventListener('ban:close', () => c.show('done', 'B'))
  c.show('attention', 'A')
  parts(el).close.click()
  expect([c.state, parts(el).live.textContent]).toEqual(['message', 'B'])
  expect(events).toEqual(['ban:change|message', 'ban:close', 'ban:change|message'])
})
test('сообщение, показанное из обработчика ban:open, остаётся', () => {
  const { el, events, c } = make()
  // On the same element as the recorder and after it, so the record keeps the order of the presses.
  el.parentElement!.addEventListener('ban:open', () => c.show('done', 'B'))
  c.show('attention', 'A')
  parts(el).text.click()
  expect([c.state, parts(el).live.textContent]).toEqual(['message', 'B'])
  expect(events).toEqual(['ban:change|message', 'ban:open', 'ban:change|message'])
})
test('фокус возвращается туда, откуда человек пришёл в каплю', () => {
  const { el, before, c } = make()
  const later = document.createElement('button')
  later.type = 'button'
  el.parentElement!.append(later)
  before.focus()
  c.show('attention', 'Есть версия 1.1')
  later.focus()
  parts(el).text.focus()
  parts(el).close.focus()
  parts(el).close.click()
  expect(document.activeElement).toBe(later)
})
test('фокус снаружи капли не трогается', () => {
  const { el, before, c } = make()
  const other = document.createElement('button')
  other.type = 'button'
  el.parentElement!.append(other)
  before.focus()
  c.show('attention', 'Есть версия 1.1')
  other.focus()
  parts(el).close.click()
  expect(c.state).toBe('rest')
  expect(document.activeElement).toBe(other)
})
test('дышит только внимание и только пока не посмотрели', () => {
  const { el, c } = make()
  const lamp = el.querySelector('.ban-lamp')!
  const breathes = () => lamp.classList.contains('ban-breathe')
  c.show('attention', 'Сменится после перезапуска')
  expect(breathes()).toBe(true)
  el.dispatchEvent(new Event('pointerenter'))
  expect(breathes()).toBe(false)
  c.show('attention', 'Есть версия 1.1')
  expect(breathes()).toBe(true)
  parts(el).text.focus()
  expect(breathes()).toBe(false)
  parts(el).text.blur()
  for (const kind of ['done', 'error', 'rec'] as const) {
    c.show(kind, `Сообщение ${kind}`)
    expect(breathes()).toBe(false)
  }
  c.show('attention', 'Снова')
  expect(breathes()).toBe(true)
  c.rest()
  expect(breathes()).toBe(false)
})
test('имя креста берётся из data-close-label', () => {
  const { el } = make()
  expect(parts(el).close.getAttribute('aria-label')).toBe('Закрыть')
  const named = document.createElement('div')
  named.className = 'ban-drop'
  named.dataset.closeLabel = 'Скрыть'
  document.body.append(named)
  drop(named)
  expect(parts(named).close.getAttribute('aria-label')).toBe('Скрыть')
})
test('destroy останавливает смену подписи', () => {
  vi.useFakeTimers()
  try {
    const { el, c } = make()
    c.show('attention', 'Сменится после перезапуска')
    const text = parts(el).text
    vi.advanceTimersByTime(40)
    const at = text.textContent
    c.destroy()
    vi.advanceTimersByTime(1000)
    expect(text.textContent).toBe(at)
  } finally {
    vi.useRealTimers()
  }
})
test('повторный destroy старого контроллера ничего не ломает', () => {
  const { el, events, c } = make()
  c.destroy()
  const d = drop(el)
  c.destroy()
  c.show('done', 'Сохранено')
  expect(d.state).toBe('rest')
  expect(drop(el)).toBe(d)
  expect(el.querySelectorAll('.ban-lamp').length).toBe(1)
  d.show('done', 'Сохранено')
  parts(el).close.click()
  expect(events).toEqual(['ban:change|message', 'ban:close', 'ban:change|rest'])
})
test('после destroy контроллер ничего не меняет', () => {
  const { el, events, c } = make()
  c.destroy()
  c.show('done', 'Сохранено')
  c.think()
  c.rest()
  expect(c.state).toBe('rest')
  expect(el.hasAttribute('data-state')).toBe(false)
  expect(el.style.width).toBe('')
  expect(events).toEqual([])
})
