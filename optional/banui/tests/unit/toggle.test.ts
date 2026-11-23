import { expect, test } from 'vitest'
import { toggle } from '../../src/controls/toggle/toggle.js'

function makeButton(checked: string | null = 'false'): HTMLButtonElement {
  const el = document.createElement('button')
  el.className = 'ban-toggle'
  el.setAttribute('role', 'switch')
  if (checked !== null) el.setAttribute('aria-checked', checked)
  document.body.append(el)
  return el
}

test('присвоение checked из кода не сообщает событием', () => {
  const el = makeButton()
  const got: boolean[] = []
  el.addEventListener('ban:change', e => got.push((e as CustomEvent).detail.checked))
  const t = toggle(el)
  t.checked = true
  expect(el.getAttribute('aria-checked')).toBe('true')
  t.checked = false
  expect(el.getAttribute('aria-checked')).toBe('false')
  expect(got).toEqual([])
})
test('destroy убирает знак и обработчик, новый вызов достраивает заново', () => {
  const el = makeButton()
  const a = toggle(el)
  a.destroy()
  expect(el.querySelectorAll('.ban-ln').length).toBe(0)
  el.click()
  expect(el.getAttribute('aria-checked')).toBe('false')
  const b = toggle(el)
  expect(b).not.toBe(a)
  expect(el.querySelectorAll('.ban-ln').length).toBe(1)
})
test('кнопка без type получает type="button"', () => {
  const el = makeButton()
  toggle(el)
  expect(el.getAttribute('type')).toBe('button')
  const own = makeButton()
  own.setAttribute('type', 'submit')
  toggle(own)
  expect(own.getAttribute('type')).toBe('submit')
})
test('без aria-checked переключатель считается выключенным', () => {
  const el = makeButton(null)
  const t = toggle(el)
  expect(t.checked).toBe(false)
  el.click()
  expect(el.getAttribute('aria-checked')).toBe('true')
})
test('кнопка без tabindex получает tabindex 0, свой остаётся', () => {
  const el = makeButton()
  toggle(el)
  expect(el.getAttribute('tabindex')).toBe('0')
  const own = makeButton()
  own.setAttribute('tabindex', '-1')
  toggle(own)
  expect(own.getAttribute('tabindex')).toBe('-1')
})
test('повторный destroy старого контроллера ничего не ломает', () => {
  const el = makeButton()
  const a = toggle(el)
  a.destroy()
  const b = toggle(el)
  a.destroy()
  expect(el.querySelectorAll('.ban-ln').length).toBe(1)
  expect(toggle(el)).toBe(b)
  el.click()
  expect(el.getAttribute('aria-checked')).toBe('true')
})
test('после destroy контроллер ничего не меняет', () => {
  const el = makeButton()
  const t = toggle(el)
  t.destroy()
  t.checked = true
  expect(el.getAttribute('aria-checked')).toBe('false')
  expect(t.checked).toBe(false)
})
test('кнопка без role и aria-checked получает switch и false, destroy их оставляет', () => {
  const el = document.createElement('button')
  el.className = 'ban-toggle'
  document.body.append(el)
  const t = toggle(el)
  expect(el.getAttribute('role')).toBe('switch')
  expect(el.getAttribute('aria-checked')).toBe('false')
  t.destroy()
  expect(el.getAttribute('role')).toBe('switch')
  expect(el.getAttribute('aria-checked')).toBe('false')
  const own = makeButton('true')
  own.setAttribute('role', 'menuitemcheckbox')
  toggle(own)
  expect(own.getAttribute('role')).toBe('menuitemcheckbox')
  expect(own.getAttribute('aria-checked')).toBe('true')
})
