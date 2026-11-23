import type { Controller, LampKind } from '../../types.js'
import { morphLabel, textWidth } from '../../motion.js'
import { sign } from '../../dom.js'

// Markup: an empty <div class="ban-drop"> inside a window with position: relative.
// data-close-label on it names the cross (default «Закрыть»).

export type DropState = 'rest' | 'thinking' | 'message'

export interface DropController extends Controller {
  readonly state: DropState
  /** Shows one message; it replaces the current one. An empty text changes nothing. */
  show(kind: LampKind, text: string): void
  think(): void
  rest(): void
}

const controllers = new WeakMap<HTMLElement, DropController>()

const LAMP = 24     // the lamp's part: the text starts here
const CROSS = 26    // the cross's part after the text
const MARGIN = 112  // the message leaves this much of the window free

function button(doc: Document, className: string): HTMLButtonElement {
  const el = doc.createElement('button')
  el.type = 'button'
  el.className = className
  el.tabIndex = -1
  return el
}

/**
 * Builds the status drop of a `.ban-drop`: a filled capsule that rests as a dot, thinks as three
 * breathing dots and grows leftward into one message at a time.
 */
export function drop(el: HTMLElement): DropController {
  const known = controllers.get(el)
  if (known) return known

  const doc = el.ownerDocument
  const found = { cap: el.classList.contains('ban-cap'), style: el.hasAttribute('style') }
  el.classList.add('ban-cap')

  const lamp = doc.createElement('i')
  lamp.className = 'ban-lamp'
  lamp.setAttribute('aria-hidden', 'true')

  const dots = doc.createElement('span')
  dots.className = 'ban-drop-dots'
  dots.setAttribute('aria-hidden', 'true')
  const dotSigns = ['-7px', '0px', '7px'].map(x => sign(doc, '', `--x:${x}`))
  dots.append(...dotSigns)

  const text = button(doc, 'ban-drop-text')
  const close = button(doc, 'ban-drop-close')
  close.setAttribute('aria-label', el.dataset.closeLabel || 'Закрыть')
  const cross = [sign(doc, '', '--r:45deg; --k:.5'), sign(doc, '', '--r:-45deg; --k:.5')]
  close.append(...cross)

  const live = doc.createElement('span')
  live.className = 'ban-drop-live'
  live.setAttribute('aria-live', 'polite')

  el.append(lamp, dots, text, close, live)

  let state: DropState = 'rest'
  let kind: LampKind | null = null
  let message = ''
  // The attention lamp breathes until the person hovers, focuses or presses the drop.
  let touched = false
  // Where focus was before the message appeared, and where the person last came into the drop from.
  let returnTo: Element | null = null
  let cameFrom: Element | null = null
  // Counts messages, so a press only dismisses the message it was made on.
  let shown = 0

  // Attributes, tab stops, breathing and the live text of the current state.
  function render(): void {
    const on = state === 'message'
    el.dataset.state = state
    if (on && kind) {
      el.dataset.kind = kind
      lamp.dataset.kind = kind
    } else {
      delete el.dataset.kind
      delete lamp.dataset.kind
    }
    for (const b of [text, close]) {
      b.tabIndex = on ? 0 : -1
      if (on) b.removeAttribute('aria-hidden')
      else b.setAttribute('aria-hidden', 'true')
    }
    lamp.classList.toggle('ban-breathe', on && kind === 'attention' && !touched)
    for (const d of dotSigns) d.classList.toggle('ban-breathe', state === 'thinking')
    live.textContent = on ? message : ''
  }

  // The positioned window the drop sits in; the root element when there is none.
  function windowOf(): HTMLElement {
    const p = el.offsetParent as HTMLElement | null
    if (p && (p !== doc.body || getComputedStyle(p).position !== 'static')) return p
    return doc.documentElement
  }
  const windowWidth = (): number => windowOf().clientWidth

  // While a message is shown, a change of the window's size refits it.
  const View = doc.defaultView?.ResizeObserver
  const resize = View ? new View(() => { if (state === 'message') fit() }) : null
  let watched: HTMLElement | null = null
  function watch(on: boolean): void {
    const target = on ? windowOf() : null
    if (target === watched) return
    if (watched) resize?.unobserve(watched)
    watched = target
    if (target) resize?.observe(target)
  }

  // The message is as wide as its text, but leaves the window's title free; the text is cut beyond that.
  function fit(): void {
    const want = Math.ceil(LAMP + textWidth(text, message) + CROSS)
    const win = windowWidth()
    const width = win > 0 ? Math.min(want, Math.max(LAMP + CROSS, win - MARGIN)) : want
    el.style.width = `${width}px`
  }

  // Focus left inside the drop goes back where the person came from, else where it was before the message.
  function giveBack(): void {
    const active = doc.activeElement as HTMLElement | null
    if (!active || !el.contains(active)) return
    const target = (cameFrom ?? returnTo) as HTMLElement | null
    if (target && target !== doc.body && target.isConnected && !el.contains(target) && typeof target.focus === 'function') {
      target.focus({ preventScroll: true })
    } else active.blur()
  }

  function go(next: DropState, k: LampKind | null = null, t = ''): void {
    if (next === state && k === kind && t === message) return
    const was = state
    if (next === 'message' && was !== 'message') returnTo = doc.activeElement
    state = next
    kind = k
    message = t
    if (next === 'message') {
      // A new message breathes again; the width goes at once to the new text.
      touched = false
      shown++
      fit()
      watch(true)
      morphLabel(text, t)
    } else {
      watch(false)
      el.style.removeProperty('width')
      if (was === 'message') {
        morphLabel(text, '')
        giveBack()
        returnTo = null
        cameFrom = null
      }
    }
    render()
    el.dispatchEvent(new CustomEvent('ban:change', { bubbles: true, detail: { state } }))
  }

  function touch(): void {
    if (touched) return
    touched = true
    lamp.classList.remove('ban-breathe')
  }

  // Focus coming in from outside remembers where it came from; moves between the buttons keep it.
  function onFocusIn(e: FocusEvent): void {
    touch()
    const from = e.relatedTarget as Element | null
    if (!from || !el.contains(from)) cameFrom = from
  }

  function onClick(e: MouseEvent): void {
    if (state !== 'message') return
    const target = e.target as Node | null
    const type = target && text.contains(target) ? 'ban:open' : target && close.contains(target) ? 'ban:close' : null
    if (!type) return
    const pressed = shown
    el.dispatchEvent(new CustomEvent(type, { bubbles: true }))
    // A listener may have shown the next message or destroyed the drop; then the press is done.
    if (controllers.get(el) === controller && state === 'message' && shown === pressed) go('rest')
  }

  el.addEventListener('click', onClick)
  el.addEventListener('focusin', onFocusIn)
  for (const type of ['pointerenter', 'pointerdown']) el.addEventListener(type, touch)

  const controller: DropController = {
    get state() { return state },
    // A controller that is no longer the element's current one changes nothing.
    show(k: LampKind, t: string) {
      if (controllers.get(el) === controller && t) go('message', k, t)
    },
    think() { if (controllers.get(el) === controller) go('thinking') },
    rest() { if (controllers.get(el) === controller) go('rest') },
    destroy() {
      if (controllers.get(el) !== controller) return
      giveBack()
      watch(false)
      resize?.disconnect()
      // Stops a label change still in progress.
      morphLabel(text, text.textContent ?? '')
      el.removeEventListener('click', onClick)
      el.removeEventListener('focusin', onFocusIn)
      for (const type of ['pointerenter', 'pointerdown']) el.removeEventListener(type, touch)
      for (const part of [lamp, dots, text, close, live]) part.remove()
      if (!found.cap) el.classList.remove('ban-cap')
      delete el.dataset.state
      delete el.dataset.kind
      el.style.removeProperty('width')
      if (!found.style && !el.getAttribute('style')) el.removeAttribute('style')
      controllers.delete(el)
    },
  }

  render()
  controllers.set(el, controller)
  return controller
}
