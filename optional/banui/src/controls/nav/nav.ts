import type { Controller } from '../../types.js'
import { followHeight, reducedMotion } from '../../motion.js'

// Markup: buttons with role="tab" and aria-controls inside the .ban-nav; sections with role="tabpanel"
// in one common parent that is not the .ban root. Unselected sections carry hidden before the script
// runs, so the box already has the selected section's height; from then on the module drives them with inert.

export interface NavController extends Controller {
  /** Assigning an index that no tab has changes nothing. */
  index: number
  select(index: number): void
}

const controllers = new WeakMap<HTMLElement, NavController>()

/**
 * Builds the section navigation of a `.ban-nav[role="tablist"]`: a capsule that travels to the selected
 * tab, roving `tabindex`, and the switch of the sections its tabs name in `aria-controls`.
 */
export function nav(el: HTMLElement): NavController {
  const known = controllers.get(el)
  if (known) return known

  const doc = el.ownerDocument
  const tabs = Array.from(el.children).filter((c): c is HTMLElement => c.getAttribute('role') === 'tab')
  // A tab without a section in the document only moves the capsule.
  const panels = tabs.map(t => {
    const id = t.getAttribute('aria-controls')
    return id ? doc.getElementById(id) : null
  })
  const box = panels.find(p => p)?.parentElement ?? null

  const found = {
    tabs: tabs.map(t => [t.getAttribute('tabindex'), t.getAttribute('aria-selected')] as const),
    panels: panels.map(p => p?.hasAttribute('inert') ?? false),
    hidden: panels.map(p => p?.hidden ?? false),
    boxClass: box?.classList.contains('ban-nav-panels') ?? false,
  }
  box?.classList.add('ban-nav-panels')
  // Visibility of the sections is driven by inert from here on.
  for (const p of panels) if (p) p.hidden = false

  const thumb = doc.createElement('i')
  thumb.className = 'ban-nav-thumb'
  thumb.setAttribute('aria-hidden', 'true')
  el.prepend(thumb)

  let index = tabs.length ? Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true')) : -1

  // Tab attributes and section visibility. Silent: no event.
  function render(): void {
    tabs.forEach((t, n) => {
      t.setAttribute('aria-selected', String(n === index))
      t.tabIndex = n === index ? 0 : -1
    })
    panels.forEach((p, n) => p?.toggleAttribute('inert', n !== index))
  }

  // The capsule takes the selected tab's place and width; without `animate` it jumps there.
  function place(animate: boolean): void {
    const tab = tabs[index]
    if (!tab) return
    // Layout lengths, free of any transform on an ancestor: the used width is fractional, and the
    // rect offset is divided by the same scale, so the capsule does not round to whole pixels.
    const r = tab.getBoundingClientRect()
    const width = parseFloat(getComputedStyle(tab).width) || tab.offsetWidth
    const scale = width && r.width ? r.width / width : 1
    const x = (r.left - el.getBoundingClientRect().left) / scale - el.clientLeft + el.scrollLeft
    if (!animate) thumb.style.transition = 'none'
    thumb.style.width = `${width}px`
    thumb.style.transform = `translateX(${x}px)`
    if (!animate) {
      void thumb.offsetWidth
      thumb.style.removeProperty('transition')
    }
  }

  // A track narrower than its tabs scrolls itself, never the page, to show the selected one.
  function reveal(smooth: boolean): void {
    const tab = tabs[index]
    const view = el.clientWidth
    if (!tab || !view || el.scrollWidth <= view) return
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0
    const start = tab.offsetLeft - pad
    const end = tab.offsetLeft + tab.offsetWidth + pad - view
    const left = start < el.scrollLeft ? start : end > el.scrollLeft ? end : el.scrollLeft
    if (left === el.scrollLeft) return
    if (smooth && !reducedMotion() && typeof el.scrollTo === 'function') el.scrollTo({ left, behavior: 'smooth' })
    else el.scrollLeft = left
  }

  function select(i: number, report = false): void {
    if (!Number.isInteger(i) || i < 0 || i >= tabs.length || i === index) return
    const from = index
    index = i
    const panel = panels[i]
    const change = (): void => {
      render()
      // The new section starts 12 px toward the side it comes from; CSS carries it home.
      if (panel) panel.dataset.enter = i < from ? 'left' : 'right'
    }
    if (box) followHeight(box, change)
    else change()
    if (panel) {
      void panel.offsetWidth
      delete panel.dataset.enter
    }
    place(true)
    reveal(true)
    if (report) {
      el.dispatchEvent(new CustomEvent('ban:change', {
        bubbles: true,
        detail: { index: i, id: tabs[i].getAttribute('aria-controls') ?? tabs[i].id },
      }))
    }
  }

  function tabIndexOf(target: EventTarget | null): number {
    const tab = (target as Element | null)?.closest?.('[role="tab"]')
    return tabs.findIndex(t => t === tab)
  }

  function onClick(e: MouseEvent): void {
    const i = tabIndexOf(e.target)
    if (i >= 0) select(i, true)
  }
  // Arrows wrap around at the ends; the selection and the focus move together.
  function onKey(e: KeyboardEvent): void {
    const cur = tabIndexOf(e.target)
    if (cur < 0 || e.altKey || e.metaKey || e.ctrlKey) return
    const last = tabs.length - 1
    let i: number
    switch (e.key) {
      case 'ArrowRight': i = cur >= last ? 0 : cur + 1; break
      case 'ArrowLeft': i = cur <= 0 ? last : cur - 1; break
      case 'Home': i = 0; break
      case 'End': i = last; break
      default: return
    }
    e.preventDefault()
    select(i, true)
    tabs[i].focus({ preventScroll: true })
  }

  el.addEventListener('click', onClick)
  el.addEventListener('keydown', onKey)

  // Labels and the track can change size later (fonts, container); the capsule follows without a move.
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => place(false)) : null
  if (observer) for (const t of [el, ...tabs]) observer.observe(t)

  const controller: NavController = {
    get index() { return index },
    // A controller that is no longer the element's current one changes nothing.
    set index(i: number) { if (controllers.get(el) === controller) select(i) },
    select(i: number) { if (controllers.get(el) === controller) select(i) },
    destroy() {
      if (controllers.get(el) !== controller) return
      el.removeEventListener('click', onClick)
      el.removeEventListener('keydown', onKey)
      observer?.disconnect()
      thumb.remove()
      tabs.forEach((t, n) => {
        const [tabindex, selected] = found.tabs[n]
        if (tabindex === null) t.removeAttribute('tabindex')
        else t.setAttribute('tabindex', tabindex)
        if (selected === null) t.removeAttribute('aria-selected')
        else t.setAttribute('aria-selected', selected)
      })
      panels.forEach((p, n) => {
        if (!p) return
        p.toggleAttribute('inert', found.panels[n])
        p.hidden = found.hidden[n]
        delete p.dataset.enter
      })
      if (box && !found.boxClass) box.classList.remove('ban-nav-panels')
      controllers.delete(el)
    },
  }

  render()
  place(false)
  reveal(false)
  controllers.set(el, controller)
  return controller
}
