import { followHeight, reducedMotion } from '../../motion.js';
const controllers = new WeakMap();
/**
 * Builds the section navigation of a `.ban-nav[role="tablist"]`: a capsule that travels to the selected
 * tab, roving `tabindex`, and the switch of the sections its tabs name in `aria-controls`.
 */
export function nav(el) {
    const known = controllers.get(el);
    if (known)
        return known;
    const doc = el.ownerDocument;
    const tabs = Array.from(el.children).filter((c) => c.getAttribute('role') === 'tab');
    // A tab without a section in the document only moves the capsule.
    const panels = tabs.map(t => {
        const id = t.getAttribute('aria-controls');
        return id ? doc.getElementById(id) : null;
    });
    const box = panels.find(p => p)?.parentElement ?? null;
    const found = {
        tabs: tabs.map(t => [t.getAttribute('tabindex'), t.getAttribute('aria-selected')]),
        panels: panels.map(p => p?.hasAttribute('inert') ?? false),
        hidden: panels.map(p => p?.hidden ?? false),
        boxClass: box?.classList.contains('ban-nav-panels') ?? false,
    };
    box?.classList.add('ban-nav-panels');
    // Visibility of the sections is driven by inert from here on.
    for (const p of panels)
        if (p)
            p.hidden = false;
    const thumb = doc.createElement('i');
    thumb.className = 'ban-nav-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    el.prepend(thumb);
    let index = tabs.length ? Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true')) : -1;
    // Tab attributes and section visibility. Silent: no event.
    function render() {
        tabs.forEach((t, n) => {
            t.setAttribute('aria-selected', String(n === index));
            t.tabIndex = n === index ? 0 : -1;
        });
        panels.forEach((p, n) => p?.toggleAttribute('inert', n !== index));
    }
    // The capsule takes the selected tab's place and width; without `animate` it jumps there.
    function place(animate) {
        const tab = tabs[index];
        if (!tab)
            return;
        // Layout lengths, free of any transform on an ancestor: the used width is fractional, and the
        // rect offset is divided by the same scale, so the capsule does not round to whole pixels.
        const r = tab.getBoundingClientRect();
        const width = parseFloat(getComputedStyle(tab).width) || tab.offsetWidth;
        const scale = width && r.width ? r.width / width : 1;
        const x = (r.left - el.getBoundingClientRect().left) / scale - el.clientLeft + el.scrollLeft;
        if (!animate)
            thumb.style.transition = 'none';
        thumb.style.width = `${width}px`;
        thumb.style.transform = `translateX(${x}px)`;
        if (!animate) {
            void thumb.offsetWidth;
            thumb.style.removeProperty('transition');
        }
    }
    // A track narrower than its tabs scrolls itself, never the page, to show the selected one.
    function reveal(smooth) {
        const tab = tabs[index];
        const view = el.clientWidth;
        if (!tab || !view || el.scrollWidth <= view)
            return;
        const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
        const start = tab.offsetLeft - pad;
        const end = tab.offsetLeft + tab.offsetWidth + pad - view;
        const left = start < el.scrollLeft ? start : end > el.scrollLeft ? end : el.scrollLeft;
        if (left === el.scrollLeft)
            return;
        if (smooth && !reducedMotion() && typeof el.scrollTo === 'function')
            el.scrollTo({ left, behavior: 'smooth' });
        else
            el.scrollLeft = left;
    }
    function select(i, report = false) {
        if (!Number.isInteger(i) || i < 0 || i >= tabs.length || i === index)
            return;
        const from = index;
        index = i;
        const panel = panels[i];
        const change = () => {
            render();
            // The new section starts 12 px toward the side it comes from; CSS carries it home.
            if (panel)
                panel.dataset.enter = i < from ? 'left' : 'right';
        };
        if (box)
            followHeight(box, change);
        else
            change();
        if (panel) {
            void panel.offsetWidth;
            delete panel.dataset.enter;
        }
        place(true);
        reveal(true);
        if (report) {
            el.dispatchEvent(new CustomEvent('ban:change', {
                bubbles: true,
                detail: { index: i, id: tabs[i].getAttribute('aria-controls') ?? tabs[i].id },
            }));
        }
    }
    function tabIndexOf(target) {
        const tab = target?.closest?.('[role="tab"]');
        return tabs.findIndex(t => t === tab);
    }
    function onClick(e) {
        const i = tabIndexOf(e.target);
        if (i >= 0)
            select(i, true);
    }
    // Arrows wrap around at the ends; the selection and the focus move together.
    function onKey(e) {
        const cur = tabIndexOf(e.target);
        if (cur < 0 || e.altKey || e.metaKey || e.ctrlKey)
            return;
        const last = tabs.length - 1;
        let i;
        switch (e.key) {
            case 'ArrowRight':
                i = cur >= last ? 0 : cur + 1;
                break;
            case 'ArrowLeft':
                i = cur <= 0 ? last : cur - 1;
                break;
            case 'Home':
                i = 0;
                break;
            case 'End':
                i = last;
                break;
            default: return;
        }
        e.preventDefault();
        select(i, true);
        tabs[i].focus({ preventScroll: true });
    }
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    // Labels and the track can change size later (fonts, container); the capsule follows without a move.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => place(false)) : null;
    if (observer)
        for (const t of [el, ...tabs])
            observer.observe(t);
    const controller = {
        get index() { return index; },
        // A controller that is no longer the element's current one changes nothing.
        set index(i) { if (controllers.get(el) === controller)
            select(i); },
        select(i) { if (controllers.get(el) === controller)
            select(i); },
        destroy() {
            if (controllers.get(el) !== controller)
                return;
            el.removeEventListener('click', onClick);
            el.removeEventListener('keydown', onKey);
            observer?.disconnect();
            thumb.remove();
            tabs.forEach((t, n) => {
                const [tabindex, selected] = found.tabs[n];
                if (tabindex === null)
                    t.removeAttribute('tabindex');
                else
                    t.setAttribute('tabindex', tabindex);
                if (selected === null)
                    t.removeAttribute('aria-selected');
                else
                    t.setAttribute('aria-selected', selected);
            });
            panels.forEach((p, n) => {
                if (!p)
                    return;
                p.toggleAttribute('inert', found.panels[n]);
                p.hidden = found.hidden[n];
                delete p.dataset.enter;
            });
            if (box && !found.boxClass)
                box.classList.remove('ban-nav-panels');
            controllers.delete(el);
        },
    };
    render();
    place(false);
    reveal(false);
    controllers.set(el, controller);
    return controller;
}
