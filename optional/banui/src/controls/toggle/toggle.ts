import type { Controller } from '../../types.js'
import { sign as makeSign } from '../../dom.js'

export interface ToggleController extends Controller { checked: boolean }

const controllers = new WeakMap<HTMLButtonElement, ToggleController>()

/**
 * Builds the sign of a `button.ban-toggle[role="switch"]` and flips `aria-checked` on press. A button
 * without a role gets `role="switch"`, one without `aria-checked` gets "false"; both stay after `destroy()`.
 */
export function toggle(el: HTMLButtonElement): ToggleController {
  const known = controllers.get(el)
  if (known) return known

  // Inside a form a flip must not submit it.
  if (!el.hasAttribute('type')) el.type = 'button'
  // A Tab stop in every browser; WebKit skips a plain button by default.
  if (!el.hasAttribute('tabindex')) el.tabIndex = 0
  if (!el.hasAttribute('role')) el.setAttribute('role', 'switch')
  if (!el.hasAttribute('aria-checked')) el.setAttribute('aria-checked', 'false')

  const sign = makeSign(el.ownerDocument)
  el.append(sign)

  const controller: ToggleController = {
    get checked() { return el.getAttribute('aria-checked') === 'true' },
    // A controller that is no longer the element's current one changes nothing.
    set checked(value: boolean) { if (controllers.get(el) === controller) el.setAttribute('aria-checked', String(value)) },
    destroy() {
      if (controllers.get(el) !== controller) return
      el.removeEventListener('click', onClick)
      sign.remove()
      controllers.delete(el)
    },
  }

  // A native button turns Space and Enter into this click.
  function onClick(): void {
    const checked = !controller.checked
    controller.checked = checked
    el.dispatchEvent(new CustomEvent('ban:change', { bubbles: true, detail: { checked } }))
  }
  el.addEventListener('click', onClick)

  controllers.set(el, controller)
  return controller
}
