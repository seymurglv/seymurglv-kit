import { expect, test } from 'vitest'
import { mount } from '../../src/index.js'

test('mount достраивает каждый вид один раз', () => {
  document.body.innerHTML = '<div class="ban"><button class="ban-toggle" role="switch" aria-checked="false"></button><input class="ban-field"><div class="ban-drop"></div>' +
    '<select class="ban-select" aria-label="Язык"><option>Русский</option></select>' +
    '<div class="ban-nav" role="tablist"><button role="tab" aria-controls="p">Общие</button></div><div><div id="p" role="tabpanel"></div></div></div>'
  mount(); mount()
  expect(document.querySelectorAll('.ban-toggle .ban-ln').length).toBe(1)
  expect(document.querySelectorAll('.ban-field-box').length).toBe(1)
  expect(document.querySelectorAll('.ban-drop .ban-lamp').length).toBe(1)
  expect(document.querySelectorAll('.ban-select-box').length).toBe(1)
  expect(document.querySelectorAll('.ban-nav-thumb').length).toBe(1)
})

test('mount пропускает элементы не того вида и достраивает только под root', () => {
  document.body.innerHTML = '<div class="ban"><div class="ban-toggle"></div><div class="ban-field"></div><div class="ban-select"></div>' +
    '<svg><g class="ban-drop"></g><g class="ban-nav"></g></svg>' +
    '<section id="inside"><button class="ban-toggle" role="switch" aria-checked="true"></button></section>' +
    '<button class="ban-toggle" id="outside" role="switch" aria-checked="false"></button></div>'
  expect(() => mount(document.querySelector('#inside')!)).not.toThrow()
  expect(document.querySelectorAll('#inside .ban-ln').length).toBe(1)
  expect(document.querySelectorAll('#outside .ban-ln').length).toBe(0)
  mount()
  expect(document.querySelectorAll('div.ban-toggle .ban-ln').length).toBe(0)
  expect(document.querySelectorAll('.ban-field-box, .ban-select-box, .ban-nav-thumb, .ban-lamp').length).toBe(0)
  expect(document.querySelectorAll('#outside .ban-ln').length).toBe(1)
})

test('mount даёт тихой кнопке tabindex 0, свой остаётся', () => {
  document.body.innerHTML = '<div class="ban"><button class="ban-button" id="q">Проверить</button>' +
    '<button class="ban-button" id="own" tabindex="-1">Своя</button><div class="ban-button" id="not"></div></div>'
  mount()
  expect(document.querySelector('#q')!.getAttribute('tabindex')).toBe('0')
  expect(document.querySelector('#own')!.getAttribute('tabindex')).toBe('-1')
  expect(document.querySelector('#not')!.hasAttribute('tabindex')).toBe(false)
})
