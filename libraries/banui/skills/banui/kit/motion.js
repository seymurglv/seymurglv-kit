const STEP_MS = 16;
const FOLLOW_MS = 340;
/** True when the user asks for reduced motion. False where `matchMedia` is unavailable. */
export function reducedMotion() {
    const mm = globalThis.matchMedia;
    return typeof mm === 'function' && !!mm('(prefers-reduced-motion: reduce)')?.matches;
}
/** Every intermediate string from `from` to `to`: erase the differing tail, then type the new one. */
export function morphSteps(from, to) {
    const a = Array.from(from);
    const b = Array.from(to);
    let common = 0;
    while (common < a.length && common < b.length && a[common] === b[common])
        common++;
    const steps = [];
    for (let n = a.length - 1; n >= common; n--)
        steps.push(a.slice(0, n).join(''));
    for (let n = common + 1; n <= b.length; n++)
        steps.push(b.slice(0, n).join(''));
    return steps;
}
const labelTimers = new WeakMap();
/** Changes the element's text one character per 16 ms. A new call cancels the previous one. */
export function morphLabel(el, to) {
    const running = labelTimers.get(el);
    if (running !== undefined) {
        clearInterval(running);
        labelTimers.delete(el);
    }
    if (reducedMotion()) {
        el.textContent = to;
        return;
    }
    const steps = morphSteps(el.textContent ?? '', to);
    if (!steps.length)
        return;
    let i = 0;
    const timer = setInterval(() => {
        el.textContent = steps[i++];
        if (i >= steps.length) {
            clearInterval(timer);
            labelTimers.delete(el);
        }
    }, STEP_MS);
    labelTimers.set(el, timer);
}
let measureCtx;
/**
 * Width in px of `text` set in the element's font, measured on a canvas.
 * The element must be attached and styled, so its computed font is the one it is drawn in.
 */
export function textWidth(el, text) {
    if (measureCtx === undefined)
        measureCtx = document.createElement('canvas').getContext('2d');
    if (!measureCtx)
        return 0;
    const cs = getComputedStyle(el);
    measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('letterSpacing' in measureCtx) {
        measureCtx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    }
    return measureCtx.measureText(text).width;
}
const follows = new WeakMap();
function endFollow(box) {
    const f = follows.get(box);
    if (!f)
        return;
    clearTimeout(f.timer);
    follows.delete(box);
    box.style.removeProperty('height');
    box.style.removeProperty('overflow');
    box.style.removeProperty('transition');
    if (f.addedClip)
        box.classList.remove('ban-clip');
}
/** Border-box height turned into a value for `style.height` under the box's own `box-sizing`. */
function cssHeight(box, borderBox) {
    const cs = getComputedStyle(box);
    if (cs.boxSizing === 'border-box')
        return `${borderBox}px`;
    const extra = [cs.paddingTop, cs.paddingBottom, cs.borderTopWidth, cs.borderBottomWidth]
        .reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    return `${Math.max(0, borderBox - extra)}px`;
}
/** Runs `change` and moves the box's height from the old value to the new one. */
export function followHeight(box, change) {
    if (reducedMotion()) {
        endFollow(box);
        change();
        return;
    }
    const prev = follows.get(box);
    const from = box.getBoundingClientRect().height;
    if (prev)
        clearTimeout(prev.timer);
    // Hold the current rendered height while the content changes.
    box.style.transition = 'none';
    box.style.height = cssHeight(box, from);
    try {
        change();
    }
    catch (error) {
        // Nothing stays pinned when the change fails.
        if (prev)
            endFollow(box);
        else {
            box.style.removeProperty('height');
            box.style.removeProperty('transition');
        }
        throw error;
    }
    box.style.removeProperty('height');
    const to = box.getBoundingClientRect().height;
    if (to === from) {
        if (prev)
            endFollow(box);
        else
            box.style.removeProperty('transition');
        return;
    }
    const addedClip = prev ? prev.addedClip : !box.classList.contains('ban-clip');
    box.classList.add('ban-clip');
    box.style.overflow = 'hidden';
    box.style.height = cssHeight(box, from);
    void box.offsetHeight;
    box.style.transition = 'height var(--ban-t-mid) var(--ban-e-out)';
    box.style.height = cssHeight(box, to);
    follows.set(box, { timer: setTimeout(() => endFollow(box), FOLLOW_MS), addedClip });
}
