import { afterEach, expect, test } from 'vitest'
import { nav } from '../../src/controls/nav/nav.js'

afterEach(() => { document.body.replaceChildren() })

function make(labels: string[] = ['Вид', 'Звук', 'Клавиши'], prep?: (tabs: HTMLElement[], panels: HTMLElement[]) => void) {
  const host = document.createElement('div')
  host.className = 'ban'
  const el = document.createElement('div')
  el.className = 'ban-nav'
  el.setAttribute('role', 'tablist')
  const box = document.createElement('div')
  labels.forEach((text, n) => {
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-controls', `p${n}`)
    tab.textContent = text
    el.append(tab)
    const panel = document.createElement('div')
    panel.id = `p${n}`
    panel.setAttribute('role', 'tabpanel')
    box.append(panel)
  })
  host.append(el, box)
  document.body.append(host)
  const events: string[] = []
  el.addEventListener('ban:change', e => {
    const d = (e as CustomEvent<{ index: number; id: string }>).detail
    events.push(`${d.index}|${d.id}`)
  })
  const tabs = [...el.querySelectorAll<HTMLElement>('[role="tab"]')]
  const panels = [...box.children] as HTMLElement[]
  prep?.(tabs, panels)
  return { el, box, tabs, panels, events, c: nav(el) }
}

const attr = (els: HTMLElement[], name: string) => els.map(e => e.getAttribute(name))
const inert = (els: HTMLElement[]) => els.map(e => e.hasAttribute('inert'))

test('повторный вызов: тот же контроллер, один бегунок', () => {
  const { el, c } = make()
  expect(nav(el)).toBe(c)
  expect(el.querySelectorAll('.ban-nav-thumb').length).toBe(1)
})
test('select и index из кода молчат, клик сообщает событием', () => {
  const { tabs, events, c } = make()
  c.select(2)
  expect(c.index).toBe(2)
  c.index = 1
  expect(c.index).toBe(1)
  expect(events).toEqual([])
  tabs[0].click()
  expect(c.index).toBe(0)
  expect(events).toEqual(['0|p0'])
  tabs[0].click()
  expect(events).toEqual(['0|p0'])
})
test('невыбранные разделы inert, tabindex и aria-selected за выбором', () => {
  const { tabs, panels, c } = make()
  expect(inert(panels)).toEqual([false, true, true])
  expect(attr(tabs, 'tabindex')).toEqual(['0', '-1', '-1'])
  expect(attr(tabs, 'aria-selected')).toEqual(['true', 'false', 'false'])
  c.select(2)
  expect(inert(panels)).toEqual([true, true, false])
  expect(attr(tabs, 'tabindex')).toEqual(['-1', '-1', '0'])
  expect(attr(tabs, 'aria-selected')).toEqual(['false', 'false', 'true'])
})
test('стрелки по кругу, Home и End переносят фокус', () => {
  const { tabs, events, c } = make()
  tabs[0].focus()
  tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
  expect(c.index).toBe(2)
  expect(document.activeElement).toBe(tabs[2])
  tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
  expect(c.index).toBe(0)
  expect(events).toEqual(['2|p2', '0|p0'])
  tabs[1].focus()
  tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(c.index).toBe(2)
})
test('destroy убирает бегунок и возвращает атрибуты', () => {
  const { el, box, tabs, panels, c } = make()
  c.select(1)
  c.destroy()
  expect(el.querySelector('.ban-nav-thumb')).toBeNull()
  expect(attr(tabs, 'tabindex')).toEqual([null, null, null])
  expect(attr(tabs, 'aria-selected')).toEqual([null, null, null])
  expect(inert(panels)).toEqual([false, false, false])
  expect(box.classList.contains('ban-nav-panels')).toBe(false)
  expect(nav(el)).not.toBe(c)
})
test('повторный destroy старого контроллера ничего не ломает', () => {
  const { el, tabs, c } = make()
  c.destroy()
  const d = nav(el)
  c.destroy()
  expect(nav(el)).toBe(d)
  expect(el.querySelectorAll('.ban-nav-thumb').length).toBe(1)
  expect(attr(tabs, 'tabindex')).toEqual(['0', '-1', '-1'])
  tabs[1].click()
  expect(d.index).toBe(1)
})
test('навигация с одной кнопкой строится', () => {
  const { el, panels, c } = make(['Один'])
  expect(c.index).toBe(0)
  expect(el.querySelectorAll('.ban-nav-thumb').length).toBe(1)
  expect(inert(panels)).toEqual([false])
  c.select(1)
  expect(c.index).toBe(0)
})
test('destroy возвращает tabindex, inert и hidden как были', () => {
  const { tabs, panels, c } = make(undefined, (t, p) => {
    t[1].setAttribute('tabindex', '-1')
    p[1].setAttribute('inert', '')
    p[2].hidden = true
  })
  expect(panels.map(p => p.hidden)).toEqual([false, false, false])
  c.select(2)
  c.destroy()
  expect(attr(tabs, 'tabindex')).toEqual([null, '-1', null])
  expect(inert(panels)).toEqual([false, true, false])
  expect(panels.map(p => p.hidden)).toEqual([false, false, true])
})
test('навигация без разделов достраивается и молчит', () => {
  const { el, events, c } = make([])
  expect(c.index).toBe(-1)
  expect(el.querySelectorAll('.ban-nav-thumb').length).toBe(1)
  c.select(0)
  c.index = 0
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
  expect(c.index).toBe(-1)
  expect(events).toEqual([])
  c.destroy()
  expect(el.querySelector('.ban-nav-thumb')).toBeNull()
})
test('стрелка с модификатором ничего не меняет', () => {
  const { tabs, events, c } = make()
  tabs[0].focus()
  for (const mod of ['altKey', 'ctrlKey', 'metaKey']) {
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true, [mod]: true })
    tabs[0].dispatchEvent(e)
    expect(e.defaultPrevented).toBe(false)
  }
  expect(c.index).toBe(0)
  expect(events).toEqual([])
})
test('старый контроллер после пересборки ничего не меняет', () => {
  const { el, tabs, panels, c } = make()
  c.destroy()
  const d = nav(el)
  c.select(2)
  c.index = 1
  expect(d.index).toBe(0)
  expect(attr(tabs, 'aria-selected')).toEqual(['true', 'false', 'false'])
  expect(inert(panels)).toEqual([false, true, true])
})
test('после destroy контроллер ничего не меняет', () => {
  const { tabs, panels, events, c } = make()
  c.destroy()
  c.select(2)
  c.index = 1
  expect(c.index).toBe(0)
  expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual([null, null, null])
  expect(panels.map(p => p.hasAttribute('inert'))).toEqual([false, false, false])
  expect(events).toEqual([])
})
