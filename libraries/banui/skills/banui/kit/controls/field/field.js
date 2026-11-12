import { drawUnderline } from '../../pen/pen.js';
import { textWidth } from '../../motion.js';
import { newId, sign } from '../../dom.js';
const SVG = 'http://www.w3.org/2000/svg';
const controllers = new WeakMap();
const settings = new WeakMap();
/**
 * Wraps an `input.ban-field` in its box and drives its four states. Validation comes from `options.validate`.
 * A repeat call with options replaces `validate` and `confirm` of the same controller; without options it changes nothing.
 */
export function field(input, options) {
    const known = controllers.get(input);
    if (known) {
        if (options)
            settings.set(known, { validate: options.validate, confirm: options.confirm });
        return known;
    }
    const doc = input.ownerDocument;
    const hadFocus = doc.activeElement === input;
    const ownDescribedBy = input.getAttribute('aria-describedby');
    // A plain box, not a label: the note inside it must stay out of the input's accessible name.
    const box = doc.createElement('span');
    box.className = 'ban-field-box';
    const dot = sign(doc, 'ban-field-sign');
    const tick = [sign(doc, 'ban-field-tick'), sign(doc, 'ban-field-tick')];
    const pen = doc.createElementNS(SVG, 'svg');
    pen.setAttribute('class', 'ban-pen');
    pen.setAttribute('aria-hidden', 'true');
    // No width until an underline is drawn: an SVG without one is 300 px wide and reaches past the box.
    pen.setAttribute('width', '0');
    pen.append(doc.createElementNS(SVG, 'path'));
    const note = doc.createElement('span');
    note.className = 'ban-note';
    note.id = newId(doc, 'ban-field-note');
    note.setAttribute('role', 'status');
    input.replaceWith(box);
    box.append(input, dot, ...tick, pen, note);
    input.setAttribute('aria-describedby', ownDescribedBy ? `${ownDescribedBy} ${note.id}` : note.id);
    if (hadFocus)
        input.focus({ preventScroll: true });
    let state = 'rest';
    function set(next, message = '') {
        state = next;
        box.dataset.state = next;
        if (next === 'done' || next === 'error')
            dot.dataset.kind = next;
        else
            delete dot.dataset.kind;
        if (next === 'error') {
            note.textContent = message;
            input.setAttribute('aria-invalid', 'true');
            drawUnderline(pen, underlineWidth());
        }
        else {
            note.textContent = '';
            input.removeAttribute('aria-invalid');
        }
    }
    // The text's width, kept within the visible part of the field. Without layout the pen's minimum.
    function underlineWidth() {
        const cs = getComputedStyle(input);
        const visible = [cs.paddingLeft, cs.paddingRight, cs.borderLeftWidth, cs.borderRightWidth]
            .reduce((w, v) => w - (parseFloat(v) || 0), input.offsetWidth);
        if (visible <= 0)
            return 14;
        return Math.min(textWidth(input, input.value), visible);
    }
    // The last value and state reported, so the same result is not reported twice.
    let reported = null;
    function check() {
        const o = settings.get(controller) ?? {};
        const message = o.validate?.(input.value) ?? null;
        if (message)
            set('error', message);
        else
            set(o.confirm ? 'done' : 'rest');
        const value = input.value;
        if (reported && reported.value === value && reported.state === state)
            return;
        reported = { value, state };
        input.dispatchEvent(new CustomEvent('ban:change', { bubbles: true, detail: { value, state } }));
    }
    function onFocus() { if (state !== 'error')
        set('typing'); }
    function onInput() { if (state !== 'typing')
        set('typing'); }
    function onBlur() { check(); }
    // keyCode 229: the Enter that confirms an input-method candidate, which WebKit may not flag as composing.
    function onKeydown(e) { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229)
        check(); }
    input.addEventListener('focus', onFocus);
    input.addEventListener('input', onInput);
    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKeydown);
    const current = () => controllers.get(input) === controller;
    const controller = {
        get state() { return state; },
        box,
        // A controller that is no longer the element's current one changes nothing.
        check() { if (current())
            check(); },
        setError(message) {
            if (!current())
                return;
            if (message)
                set('error', message);
            else if (state === 'error')
                set(doc.activeElement === input ? 'typing' : 'rest');
        },
        destroy() {
            if (controllers.get(input) !== controller)
                return;
            input.removeEventListener('focus', onFocus);
            input.removeEventListener('input', onInput);
            input.removeEventListener('blur', onBlur);
            input.removeEventListener('keydown', onKeydown);
            const focused = doc.activeElement === input;
            box.replaceWith(input);
            if (ownDescribedBy === null)
                input.removeAttribute('aria-describedby');
            else
                input.setAttribute('aria-describedby', ownDescribedBy);
            input.removeAttribute('aria-invalid');
            if (focused)
                input.focus({ preventScroll: true });
            controllers.delete(input);
        },
    };
    settings.set(controller, { validate: options?.validate, confirm: options?.confirm });
    set(hadFocus ? 'typing' : 'rest');
    controllers.set(input, controller);
    return controller;
}
