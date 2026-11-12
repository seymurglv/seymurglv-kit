import { toggle } from '../src/controls/toggle/toggle.js'
import { field } from '../src/controls/field/field.js'
import { select } from '../src/controls/select/select.js'
import { nav } from '../src/controls/nav/nav.js'
import { drop } from '../src/controls/drop/drop.js'

const CHECK_MS = 1300

function validateMail(value: string): string | null {
  if (!value) return 'нужна почта'
  const at = value.indexOf('@')
  if (at < 0) return 'нужна @'
  return /^[^.]+\.[^.]/.test(value.slice(at + 1)) ? null : 'адрес не дописан'
}

/** Fills a `.win` with the settings window and builds its controls. Nothing is saved. */
function settingsWindow(win: HTMLElement, body: HTMLTemplateElement): void {
  const suffix = win.id.replace(/^win-/, '')
  const content = body.content.cloneNode(true) as DocumentFragment
  for (const el of content.querySelectorAll('[id]')) el.id = `${el.id}-${suffix}`
  for (const attr of ['for', 'aria-controls', 'aria-labelledby']) {
    for (const el of content.querySelectorAll(`[${attr}]`)) el.setAttribute(attr, `${el.getAttribute(attr)}-${suffix}`)
  }
  win.append(content)

  const status = drop(win.querySelector<HTMLElement>('.ban-drop')!)
  nav(win.querySelector<HTMLElement>('.ban-nav')!)
  for (const el of win.querySelectorAll<HTMLButtonElement>('.ban-toggle')) toggle(el)

  field(win.querySelector<HTMLInputElement>('[name="name"]')!)
  field(win.querySelector<HTMLInputElement>('[name="mail"]')!, { confirm: true, validate: validateMail }).check()

  const lang = win.querySelector<HTMLSelectElement>('[name="lang"]')!
  select(lang)
  select(win.querySelector<HTMLSelectElement>('[name="mic"]')!)
  lang.addEventListener('ban:change', () => status.show('attention', 'Сменится после перезапуска'))

  // The update check is a delay; a press while it runs adds nothing.
  let checking = false
  win.querySelector<HTMLButtonElement>('[name="check"]')!.addEventListener('click', () => {
    if (checking) return
    checking = true
    status.think()
    setTimeout(() => {
      checking = false
      status.show('attention', 'Есть версия 1.1')
    }, CHECK_MS)
  })
}

const body = document.querySelector<HTMLTemplateElement>('#win-body')!
for (const win of document.querySelectorAll<HTMLElement>('.win')) settingsWindow(win, body)
