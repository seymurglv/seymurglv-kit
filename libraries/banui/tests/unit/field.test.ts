import { afterEach, expect, test } from 'vitest'
import { field, type FieldOptions } from '../../src/controls/field/field.js'

afterEach(() => { document.body.replaceChildren() })

function make(value = '', options?: FieldOptions) {
  const host = document.createElement('div')
  const input = document.createElement('input')
  input.className = 'ban-field'
  input.value = value
  host.append(input)
  document.body.append(host)
  const events: string[] = []
  input.addEventListener('ban:change', e => events.push((e as CustomEvent).detail.state))
  return { host, input, events, f: field(input, options) }
}

test('повторный вызов: тот же контроллер, одна обёртка', () => {
  const { host, input, f } = make('а')
  expect(field(input)).toBe(f)
  expect(host.querySelectorAll('.ban-field-box').length).toBe(1)
  expect(f.box.dataset.state).toBe('rest')
})
test('destroy возвращает голое поле на место', () => {
  const { host, input, f } = make('а')
  const after = document.createElement('span')
  host.append(after)
  f.destroy()
  expect(host.firstElementChild).toBe(input)
  expect(input.nextElementSibling).toBe(after)
  expect(host.querySelector('.ban-field-box, .ban-ln, .ban-pen, .ban-note')).toBeNull()
  expect(input.hasAttribute('aria-describedby')).toBe(false)
  expect(input.hasAttribute('aria-invalid')).toBe(false)
  expect(field(input)).not.toBe(f)
})
test('setError показывает и снимает ошибку без события', () => {
  const { input, events, f } = make('а')
  f.setError('не так')
  expect(f.state).toBe('error')
  const note = f.box.querySelector('.ban-note')!
  expect(note.textContent).toBe('не так')
  expect(input.getAttribute('aria-describedby')).toBe(note.id)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  f.setError(null)
  expect(f.state).toBe('rest')
  expect(note.textContent).toBe('')
  expect(input.hasAttribute('aria-invalid')).toBe(false)
  expect(events).toEqual([])
})
test('у пометок разные id', () => {
  const a = make().f.box.querySelector('.ban-note')!.id
  const b = make().f.box.querySelector('.ban-note')!.id
  expect(a).not.toBe(b)
})
test('null с confirm даёт done, без confirm rest', () => {
  const a = make('а', { validate: () => null, confirm: true })
  a.f.check()
  expect(a.f.state).toBe('done')
  expect(a.f.box.querySelector('.ban-field-sign')!.getAttribute('data-kind')).toBe('done')
  const b = make('а', { validate: () => null })
  b.f.check()
  expect(b.f.state).toBe('rest')
  expect(a.events).toEqual(['done'])
  expect(b.events).toEqual(['rest'])
})
test('ошибка держится в фокусе и уходит при вводе', () => {
  const { input, f } = make('а', { validate: v => (v.includes('@') ? null : 'нужна @') })
  f.check()
  expect(f.state).toBe('error')
  input.focus()
  expect(f.state).toBe('error')
  input.value = 'а@'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  expect(f.state).toBe('typing')
  expect(input.hasAttribute('aria-invalid')).toBe(false)
})
test('после destroy поле молчит', () => {
  const { input, events, f } = make('а', { validate: () => 'не так', confirm: true })
  f.destroy()
  input.focus()
  input.value = 'б'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  input.blur()
  expect(events).toEqual([])
  expect(f.state).toBe('rest')
  expect(f.box.dataset.state).toBe('rest')
  expect(input.hasAttribute('aria-invalid')).toBe(false)
})
test('повторный destroy старого контроллера ничего не ломает', () => {
  const { host, input, f } = make('а')
  f.destroy()
  const g = field(input)
  f.destroy()
  expect(field(input)).toBe(g)
  expect(host.querySelectorAll('.ban-field-box').length).toBe(1)
  expect(g.box.contains(input)).toBe(true)
})
test('после destroy контроллер ничего не меняет', () => {
  const { input, events, f } = make('а', { validate: () => 'не так', confirm: true })
  f.destroy()
  f.check()
  f.setError('не так')
  expect(events).toEqual([])
  expect(input.hasAttribute('aria-invalid')).toBe(false)
  expect(f.state).toBe('rest')
})
test('одно и то же поле не сообщает дважды', () => {
  const { input, events } = make('anna@mail.ru', { validate: () => null, confirm: true })
  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  input.blur()
  expect(events).toEqual(['done'])
  input.focus()
  input.value = 'anna@mail.com'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.blur()
  expect(events).toEqual(['done', 'done'])
})
test('повторный вызов с настройками обновляет проверку', () => {
  const { input, events, f } = make('а')
  const g = field(input, { validate: () => 'не так' })
  expect(g).toBe(f)
  expect(document.querySelectorAll('.ban-field-box').length).toBe(1)
  f.check()
  expect(f.state).toBe('error')
  expect(field(input)).toBe(f)
  f.setError(null)
  f.check()
  expect(f.state).toBe('error')
  field(input, { confirm: true })
  f.check()
  expect(f.state).toBe('done')
  expect(events).toEqual(['error', 'done'])
})
