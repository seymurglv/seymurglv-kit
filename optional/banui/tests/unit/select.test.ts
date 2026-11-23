import { afterEach, expect, test } from 'vitest'
import { select } from '../../src/controls/select/select.js'

afterEach(() => { document.body.replaceChildren() })

function make(labels: string[] = ['Русский', 'English', 'Español']) {
  const host = document.createElement('div')
  const el = document.createElement('select')
  el.className = 'ban-select'
  el.setAttribute('aria-label', 'Язык')
  for (const text of labels) el.append(new Option(text))
  host.append(el)
  document.body.append(host)
  const events: string[] = []
  el.addEventListener('change', () => events.push(`change:${el.value}`))
  el.addEventListener('ban:change', e => {
    const d = (e as CustomEvent<{ value: string; label: string }>).detail
    events.push(`ban:${d.value}|${d.label}`)
  })
  return { host, el, events, c: select(el) }
}

const boxOf = (host: HTMLElement) => host.querySelector<HTMLElement>('.ban-select-box')!
const label = (host: HTMLElement) => host.querySelector('.ban-select-label')!.textContent
const options = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('[role="option"]')]

test('повторный вызов: тот же контроллер, одна коробка', () => {
  const { host, el, c } = make()
  expect(select(el)).toBe(c)
  expect(host.querySelectorAll('.ban-select-box').length).toBe(1)
  expect(boxOf(host).contains(el)).toBe(true)
  expect(el.hidden).toBe(true)
})
test('destroy возвращает голый select на место', () => {
  const { host, el, c } = make()
  const after = document.createElement('span')
  host.append(after)
  c.show()
  c.destroy()
  expect(host.firstElementChild).toBe(el)
  expect(el.nextElementSibling).toBe(after)
  expect(el.hidden).toBe(false)
  expect(host.querySelector('.ban-select-box, .ban-ln, [role="listbox"]')).toBeNull()
  expect(select(el)).not.toBe(c)
})
test('присвоение value молчит, чужое значение ничего не меняет', () => {
  const { host, el, events, c } = make()
  c.value = 'English'
  expect(el.value).toBe('English')
  expect(c.value).toBe('English')
  expect(label(host)).toBe('English')
  expect(options(host).map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
  c.value = 'Klingon'
  expect(c.value).toBe('English')
  expect(label(host)).toBe('English')
  expect(events).toEqual([])
})
test('выбор строки: значение, change и ban:change', () => {
  const { host, el, events, c } = make()
  c.show()
  options(host)[2].click()
  expect(el.value).toBe('Español')
  expect(events).toEqual(['change:Español', 'ban:Español|Español'])
  expect(c.open).toBe(false)
  expect(host.querySelector('.ban-select-value')!.getAttribute('aria-label')).toContain('Español')
})
test('aria-expanded следует за show и hide', () => {
  const { host, c } = make()
  const button = host.querySelector('.ban-select-value')!
  expect(button.getAttribute('aria-expanded')).toBe('false')
  c.show()
  expect(c.open).toBe(true)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  expect(boxOf(host).dataset.open).toBe('true')
  c.hide()
  expect(c.open).toBe(false)
  expect(button.getAttribute('aria-expanded')).toBe('false')
  expect(boxOf(host).dataset.open).toBe('false')
})
test('одно значение строится и открывается', () => {
  const { host, c } = make(['Только одно'])
  c.show()
  expect(c.open).toBe(true)
  expect(options(host).length).toBe(1)
  expect(label(host)).toBe('Только одно')
})
test('повторный destroy старого контроллера ничего не ломает', () => {
  const { host, el, c } = make()
  c.destroy()
  const d = select(el)
  c.destroy()
  expect(el.hidden).toBe(true)
  expect(select(el)).toBe(d)
  expect(host.querySelectorAll('.ban-select-box').length).toBe(1)
  expect(boxOf(host).contains(el)).toBe(true)
})
test('после destroy документ не слушается', () => {
  const { host, el, events, c } = make()
  c.show()
  c.destroy()
  const was = c.open
  expect(() => document.dispatchEvent(new Event('pointerdown', { bubbles: true }))).not.toThrow()
  expect(c.open).toBe(was)
  expect(host.firstElementChild).toBe(el)
  expect(el.hidden).toBe(false)
  expect(events).toEqual([])
})
test('имя берётся из label, когда нет aria-label', () => {
  const host = document.createElement('div')
  const lab = document.createElement('label')
  lab.htmlFor = 'sel-named'
  lab.textContent = 'Язык'
  const el = document.createElement('select')
  el.id = 'sel-named'
  el.className = 'ban-select'
  el.append(new Option('Русский'), new Option('English'))
  host.append(lab, el)
  document.body.append(host)
  select(el)
  expect(host.querySelector('.ban-select-value')!.getAttribute('aria-label')).toBe('Язык, Русский')
})
test('отключённый список не открывается', () => {
  const host = document.createElement('div')
  const el = document.createElement('select')
  el.className = 'ban-select'
  el.setAttribute('aria-label', 'Язык')
  el.disabled = true
  el.append(new Option('Русский'), new Option('English'))
  host.append(el)
  document.body.append(host)
  const c = select(el)
  const button = host.querySelector<HTMLButtonElement>('.ban-select-value')!
  expect(button.disabled).toBe(true)
  expect(button.getAttribute('tabindex')).toBe('-1')
  button.click()
  expect(c.open).toBe(false)
  c.show()
  expect(c.open).toBe(false)
  expect(boxOf(host).dataset.open).toBe('false')
})
test('отключённую строку нельзя выбрать и стрелки её пропускают', () => {
  const { host, el, events, c } = make(['Русский', 'English', 'Español', 'Deutsch'])
  el.options[1].disabled = true
  el.options[3].disabled = true
  c.destroy()
  const d = select(el)
  const rows = options(host)
  expect(rows.map(r => r.getAttribute('aria-disabled'))).toEqual([null, 'true', null, 'true'])
  d.show()
  rows[1].click()
  expect(d.open).toBe(true)
  expect(el.value).toBe('Русский')
  const list = host.querySelector<HTMLElement>('[role="listbox"]')!
  const key = (k: string) => list.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  key('ArrowDown')
  expect(list.getAttribute('aria-activedescendant')).toBe(rows[2].id)
  key('ArrowDown')
  expect(list.getAttribute('aria-activedescendant')).toBe(rows[2].id)
  key('ArrowUp')
  expect(list.getAttribute('aria-activedescendant')).toBe(rows[0].id)
  key('End')
  expect(list.getAttribute('aria-activedescendant')).toBe(rows[2].id)
  key('Home')
  expect(list.getAttribute('aria-activedescendant')).toBe(rows[0].id)
  key('Enter')
  expect(events).toEqual([])
  d.value = 'English'
  expect(el.value).toBe('English')
  expect(label(host)).toBe('English')
})
test('нажатие на label ставит фокус на кнопку значения', () => {
  const host = document.createElement('div')
  const lab = document.createElement('label')
  lab.htmlFor = 'sel-press'
  lab.textContent = 'Язык'
  const el = document.createElement('select')
  el.id = 'sel-press'
  el.className = 'ban-select'
  el.append(new Option('Русский'), new Option('English'))
  host.append(lab, el)
  document.body.append(host)
  const c = select(el)
  lab.click()
  expect(document.activeElement).toBe(host.querySelector('.ban-select-value'))
  expect(c.open).toBe(false)
})
test('сброс формы возвращает подпись', async () => {
  const form = document.createElement('form')
  const el = document.createElement('select')
  el.className = 'ban-select'
  el.setAttribute('aria-label', 'Язык')
  el.append(new Option('Русский'), new Option('English'))
  form.append(el)
  document.body.append(form)
  const c = select(el)
  c.value = 'English'
  expect(label(form)).toBe('English')
  form.reset()
  await new Promise(r => setTimeout(r, 0))
  expect(el.value).toBe('Русский')
  expect(label(form)).toBe('Русский')
  expect(options(form).map(o => o.getAttribute('aria-selected'))).toEqual(['true', 'false'])
})
test('после destroy контроллер ничего не меняет', () => {
  const { host, el, events, c } = make()
  c.destroy()
  c.show()
  expect(c.open).toBe(false)
  c.value = 'English'
  expect(el.value).toBe('Русский')
  expect(c.value).toBe('Русский')
  c.hide()
  expect(host.firstElementChild).toBe(el)
  document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  expect(events).toEqual([])
})
