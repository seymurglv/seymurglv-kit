import { toggle } from './controls/toggle/toggle.js';
import { field } from './controls/field/field.js';
import { select } from './controls/select/select.js';
import { nav } from './controls/nav/nav.js';
import { drop } from './controls/drop/drop.js';
export * from './types.js';
export { toggle, field, select, nav, drop };
export { morphLabel, followHeight, textWidth } from './motion.js';
const HTML = 'http://www.w3.org/1999/xhtml';
function each(root, selector, build) {
    for (const el of root.querySelectorAll(selector))
        if (el.namespaceURI === HTML)
            build(el);
}
/**
 * Builds every control under `root`: `button.ban-toggle`, `input.ban-field`, `select.ban-select`,
 * `.ban-nav` and `.ban-drop`, and makes each `button.ban-button` without a `tabindex` a Tab stop.
 * An element of another kind is left alone. A control that is already built keeps its controller,
 * so a second call adds nothing.
 */
export function mount(root = document) {
    // WebKit leaves a plain button out of the Tab order.
    each(root, 'button.ban-button', el => { if (!el.hasAttribute('tabindex'))
        el.tabIndex = 0; });
    each(root, 'button.ban-toggle', toggle);
    each(root, 'input.ban-field', el => field(el));
    each(root, 'select.ban-select', select);
    each(root, '.ban-nav', nav);
    each(root, '.ban-drop', drop);
}
