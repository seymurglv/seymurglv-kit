import { drawUnderline } from '../src/pen/pen.js'
import { toggle } from '../src/controls/toggle/toggle.js'
import { field } from '../src/controls/field/field.js'
import { select } from '../src/controls/select/select.js'
import { nav } from '../src/controls/nav/nav.js'
import { drop } from '../src/controls/drop/drop.js'

for (const id of ['pen-rest', 'pen-error']) {
  const svg = document.querySelector<SVGSVGElement>(`#${id} svg`)
  if (svg) drawUnderline(svg, 100)
}
for (const el of document.querySelectorAll<HTMLButtonElement>('.ban-toggle')) toggle(el)

field(document.querySelector<HTMLInputElement>('#f-plain')!)
const mail = field(document.querySelector<HTMLInputElement>('#f-mail')!, {
  confirm: true,
  validate: v => {
    if (!v) return 'нужна почта'
    const at = v.indexOf('@')
    if (at < 0) return 'нужна @'
    return /^[^.]+\.[^.]/.test(v.slice(at + 1)) ? null : 'адрес не дописан'
  },
})
mail.check()

// #sel-raw stays unbuilt: it shows the select before the module runs.
for (const id of ['sel-lang', 'sel-one']) select(document.querySelector<HTMLSelectElement>(`#${id}`)!)

for (const el of document.querySelectorAll<HTMLElement>('.ban-nav')) nav(el)

const d = drop(document.querySelector<HTMLElement>('#d-drop')!)
const on = (id: string, run: () => void): void => document.querySelector(`#${id}`)!.addEventListener('click', run)
on('d-att', () => d.show('attention', 'Сменится после перезапуска'))
on('d-done', () => d.show('done', 'Сохранено'))
on('d-think', () => d.think())
on('d-long', () => d.show('attention', 'Новая версия уже загружена, но часть настроек вида и звука сменится только после перезапуска приложения целиком, позднее'))
on('d-two', () => {
  d.show('attention', 'Сменится после перезапуска')
  d.show('attention', 'Есть версия 1.1')
})
