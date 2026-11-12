import { toggle } from './controls/toggle/toggle.js'
import { field } from './controls/field/field.js'
import { select } from './controls/select/select.js'
import { nav } from './controls/nav/nav.js'
import { drop } from './controls/drop/drop.js'

export * from './types.js'
export { toggle, field, select, nav, drop }
export type { ToggleController } from './controls/toggle/toggle.js'
export type { FieldController, FieldOptions, FieldState } from './controls/field/field.js'
export type { SelectController } from './controls/select/select.js'
export type { NavController } from './controls/nav/nav.js'
export type { DropController, DropState } from './controls/drop/drop.js'
export { morphLabel, followHeight, textWidth } from './motion.js'

const HTML = 'http://www.w3.org/1999/xhtml'

function each<T extends Element>(root: ParentNode, selector: string, build: (el: T) => unknown): void {
  for (const el of root.querySelectorAll<T>(selector)) if (el.namespaceURI === HTML) build(el)
}

/**
 * Builds every control under `root`: `button.ban-toggle`, `input.ban-field`, `select.ban-select`,
 * `.ban-nav` and `.ban-drop`, and makes each `button.ban-button` without a `tabindex` a Tab stop.
 * An element of another kind is left alone. A control that is already built keeps its controller,
 * so a second call adds nothing.
 */
export function mount(root: ParentNode = document): void {
  // WebKit leaves a plain button out of the Tab order.
  each<HTMLButtonElement>(root, 'button.ban-button', el => { if (!el.hasAttribute('tabindex')) el.tabIndex = 0 })
  each<HTMLButtonElement>(root, 'button.ban-toggle', toggle)
  each<HTMLInputElement>(root, 'input.ban-field', el => field(el))
  each<HTMLSelectElement>(root, 'select.ban-select', select)
  each<HTMLElement>(root, '.ban-nav', nav)
  each<HTMLElement>(root, '.ban-drop', drop)
}
