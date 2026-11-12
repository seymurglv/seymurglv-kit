import { mount, drop, field } from '../../kit/index.js'

const CHECK_MS = 1300

/** Why the address is not accepted, or null when it is. */
function validateMail(value) {
  if (!value) return 'нужна почта'
  const at = value.indexOf('@')
  if (at < 0) return 'нужна @'
  return /^[^.]+\.[^.]/.test(value.slice(at + 1)) ? null : 'адрес не дописан'
}

// Every control on the page is built from its markup. Nothing is saved.
mount()

const win = document.querySelector('.win')
const status = drop(win.querySelector('.ban-drop'))

// The address is checked when focus leaves it, and once now, so the right one starts with its tick.
field(win.querySelector('[name="mail"]'), { confirm: true, validate: validateMail }).check()

win.querySelector('[name="lang"]').addEventListener('ban:change', () => {
  status.show('attention', 'Сменится после перезапуска')
})

// The update check is a delay; a press while it runs adds nothing.
let checking = false
win.querySelector('[name="check"]').addEventListener('click', () => {
  if (checking) return
  checking = true
  status.think()
  setTimeout(() => {
    checking = false
    status.show('attention', 'Есть версия 1.1')
  }, CHECK_MS)
})
