import { morphLabel } from '../../motion.js';
import { newId, sign } from '../../dom.js';
const controllers = new WeakMap();
/** The select's own name: its `aria-label`, else the text of its labels. */
function nameOf(el) {
    const own = el.getAttribute('aria-label')?.trim();
    if (own)
        return own;
    return Array.from(el.labels ?? [], l => l.textContent?.trim() ?? '').filter(Boolean).join(' ');
}
/**
 * Builds the dropdown of a `select.ban-select`: a 28 px capsule that grows downward into its list
 * over the content below. The select stays inside the box, hidden, as the form value.
 */
export function select(el) {
    const known = controllers.get(el);
    if (known)
        return known;
    const doc = el.ownerDocument;
    const wasHidden = el.hidden;
    const name = nameOf(el);
    const opts = Array.from(el.options);
    const box = doc.createElement('div');
    box.className = 'ban-select-box';
    box.dataset.open = 'false';
    box.style.setProperty('--ban-rows', String(opts.length));
    // The growing part clips its content, so a focus ring inside it is drawn inward.
    const pop = doc.createElement('div');
    pop.className = 'ban-select-pop ban-clip';
    const listId = newId(doc, 'ban-select');
    const button = doc.createElement('button');
    button.type = 'button';
    button.tabIndex = 0; // a Tab stop in every browser; WebKit skips a plain button by default
    button.className = 'ban-select-value';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', listId);
    const label = doc.createElement('span');
    label.className = 'ban-select-label';
    const arrow = doc.createElement('span');
    arrow.className = 'ban-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.append(sign(doc, 'ban-select-arrow-l'), sign(doc, 'ban-select-arrow-r'));
    button.append(label, arrow);
    const list = doc.createElement('div');
    list.className = 'ban-select-list';
    list.id = listId;
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    if (name)
        list.setAttribute('aria-label', name);
    const rows = opts.map(o => {
        const row = doc.createElement('div');
        row.className = 'ban-select-row';
        row.id = newId(doc, 'ban-select');
        row.setAttribute('role', 'option');
        if (o.disabled)
            row.setAttribute('aria-disabled', 'true');
        const text = doc.createElement('span');
        text.textContent = o.label;
        row.append(sign(doc, 'ban-select-mark'), text);
        return row;
    });
    list.append(...rows);
    pop.append(button, list);
    el.replaceWith(box);
    box.append(el, pop);
    el.hidden = true;
    let open = false;
    let active = -1;
    let resetTimer;
    const labels = Array.from(el.labels ?? []);
    const form = el.form;
    // A disabled select gives a disabled value button that is not a Tab stop.
    function syncDisabled() {
        const off = el.disabled;
        button.disabled = off;
        button.tabIndex = off ? -1 : 0;
        box.toggleAttribute('data-disabled', off);
        if (off)
            hide();
    }
    const usable = (i) => i >= 0 && i < rows.length && !opts[i].disabled;
    // The nearest usable row from `from` in direction `step`, or -1.
    function nearest(from, step) {
        for (let i = from; i >= 0 && i < rows.length; i += step)
            if (usable(i))
                return i;
        return -1;
    }
    // Value, label, selected row and the button's name. Silent: no event.
    function render(animate) {
        const i = el.selectedIndex;
        const text = i >= 0 ? opts[i].label : '';
        rows.forEach((r, n) => r.setAttribute('aria-selected', String(n === i)));
        if (animate)
            morphLabel(label, text);
        else {
            morphLabel(label, label.textContent ?? ''); // stops a morph still running
            label.textContent = text;
        }
        if (name)
            button.setAttribute('aria-label', text ? `${name}, ${text}` : name);
    }
    // The list is driven from the keyboard: the active row then shows the inward ring.
    function setKeys(on) { list.toggleAttribute('data-keys', on); }
    function setActive(i) {
        if (!usable(i))
            return;
        active = i;
        rows.forEach((r, n) => r.toggleAttribute('data-active', n === active));
        list.setAttribute('aria-activedescendant', rows[active].id);
    }
    function show() {
        if (open || el.disabled)
            return;
        open = true;
        box.dataset.open = 'true';
        button.setAttribute('aria-expanded', 'true');
        setActive(usable(el.selectedIndex) ? el.selectedIndex : nearest(0, 1));
        doc.addEventListener('pointerdown', onOutside, true);
        list.focus({ preventScroll: true });
    }
    function hide() {
        if (!open)
            return;
        open = false;
        box.dataset.open = 'false';
        button.setAttribute('aria-expanded', 'false');
        doc.removeEventListener('pointerdown', onOutside, true);
        // A row brought into view while the box grew must not leave the closed box scrolled.
        pop.scrollTop = 0;
        // The list stops being focusable once closed; focus that was in it goes to the button.
        if (list.contains(doc.activeElement))
            button.focus({ preventScroll: true });
    }
    function choose(i) {
        if (!usable(i))
            return;
        const changed = i !== el.selectedIndex;
        if (changed) {
            el.selectedIndex = i;
            render(true);
        }
        hide();
        button.focus({ preventScroll: true });
        if (!changed)
            return;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new CustomEvent('ban:change', { bubbles: true, detail: { value: el.value, label: opts[i].label } }));
    }
    function rowIndex(target) {
        const row = target?.closest?.('[role="option"]');
        return rows.findIndex(r => r === row);
    }
    // Focus does not move on a press inside the control; the handlers below place it.
    function onPress(e) { e.preventDefault(); }
    // A click with detail 0 comes from Enter or Space.
    function onButtonClick(e) {
        if (open)
            return hide();
        setKeys(e.detail === 0);
        show();
    }
    function onButtonKey(e) {
        if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setKeys(true);
            show();
        }
    }
    function onListKey(e) {
        switch (e.key) {
            case 'ArrowDown':
                setActive(nearest(active + 1, 1));
                break;
            case 'ArrowUp':
                setActive(nearest(active - 1, -1));
                break;
            case 'Home':
                setActive(nearest(0, 1));
                break;
            case 'End':
                setActive(nearest(rows.length - 1, -1));
                break;
            case 'Enter':
                choose(active);
                break;
            case 'Escape':
                hide();
                button.focus({ preventScroll: true });
                break;
            case ' ': break; // no choice, and no page scroll
            // Tab closes without a choice and moves on from the button, as from a closed control.
            case 'Tab':
                hide();
                button.focus({ preventScroll: true });
                return;
            default: return;
        }
        if (e.key !== 'Escape' && e.key !== ' ')
            setKeys(true);
        e.preventDefault();
    }
    function onListClick(e) {
        const i = rowIndex(e.target);
        if (i >= 0)
            choose(i);
    }
    function onListMove(e) {
        const i = rowIndex(e.target);
        if (i < 0)
            return;
        setKeys(false);
        if (!usable(i))
            rows.forEach(r => r.removeAttribute('data-active'));
        else if (i !== active || !rows[i].hasAttribute('data-active'))
            setActive(i);
    }
    function onOutside(e) { if (!box.contains(e.target))
        hide(); }
    function onFocusOut(e) { if (!box.contains(e.relatedTarget))
        hide(); }
    // A press on one of the select's labels focuses the value button; it does not open the list.
    function onLabelClick(e) {
        if (box.contains(e.target))
            return;
        e.preventDefault();
        if (!el.disabled)
            button.focus();
    }
    // A form reset applies after its event; the label follows on the next task.
    function onReset() {
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => render(false), 0);
    }
    const watch = typeof MutationObserver === 'function' ? new MutationObserver(syncDisabled) : null;
    button.addEventListener('mousedown', onPress);
    button.addEventListener('click', onButtonClick);
    button.addEventListener('keydown', onButtonKey);
    list.addEventListener('mousedown', onPress);
    list.addEventListener('keydown', onListKey);
    list.addEventListener('click', onListClick);
    list.addEventListener('pointermove', onListMove);
    box.addEventListener('focusout', onFocusOut);
    for (const l of labels)
        l.addEventListener('click', onLabelClick);
    form?.addEventListener('reset', onReset);
    watch?.observe(el, { attributes: true, attributeFilter: ['disabled'] });
    const current = () => controllers.get(el) === controller;
    const controller = {
        get value() { return el.value; },
        // A controller that is no longer the element's current one changes nothing.
        set value(v) {
            if (!current())
                return;
            const i = opts.findIndex(o => o.value === v);
            if (i < 0)
                return;
            el.selectedIndex = i;
            render(false);
        },
        get open() { return open; },
        show() { if (current())
            show(); },
        hide() { if (current())
            hide(); },
        destroy() {
            if (!current())
                return;
            const focused = box.contains(doc.activeElement);
            doc.removeEventListener('pointerdown', onOutside, true);
            box.removeEventListener('focusout', onFocusOut);
            for (const l of labels)
                l.removeEventListener('click', onLabelClick);
            form?.removeEventListener('reset', onReset);
            clearTimeout(resetTimer);
            watch?.disconnect();
            morphLabel(label, label.textContent ?? '');
            box.replaceWith(el);
            el.hidden = wasHidden;
            if (focused)
                el.focus({ preventScroll: true });
            controllers.delete(el);
        },
    };
    syncDisabled();
    render(false);
    controllers.set(el, controller);
    return controller;
}
