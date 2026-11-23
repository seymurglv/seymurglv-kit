// The showcase: a grid of tiles built from the collection; a tile grows into a card with the live thing.
// Items come from window.__BANUI_ITEMS__ (the single-file board) or from the dev server's collection.json.
import { nav, toggle, morphLabel } from '../skills/banui/kit/index.js'

const GROUPS = [['base', 'Основа'], ['control', 'Контролы'], ['block', 'Блоки'], ['screen', 'Экраны'], ['motion', 'Движение'], ['other', 'Разное']]
const WORD = { done: 'доведённая', probe: 'проба' }
const LEVELS = [null, 'done', 'probe']
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const el = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v
    else if (k === 'text') node.textContent = v
    else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'role' || k === 'type' || k === 'title' || k === 'tabindex' || k === 'for' || k === 'id' || k === 'loading') node.setAttribute(k, v)
    else node[k] = v
  }
  node.append(...kids)
  return node
}
const ln = () => el('i', { class: 'ban-ln' })
const sign = level => el('span', { class: 'lvl', 'data-level': level, 'aria-hidden': 'true' }, ln())
const date = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('.') : ''

/** Builds the showcase inside root. An item is shown from `html` when it has one, else from `url`. */
export function start(root, items) {
  let level = null
  const byId = new Map(items.map(i => [i.id, i]))
  const openId = () => { const id = decodeURIComponent(location.hash.slice(1)); return byId.has(id) ? id : null }
  const theme = () => root.dataset.theme

  const frame = (item, live) => {
    const f = el('iframe', { title: item.name, loading: live ? 'eager' : 'lazy' })
    if (!live) { f.tabIndex = -1; f.setAttribute('aria-hidden', 'true') }
    if (item.html) f.srcdoc = item.html
    else f.src = item.url
    f.addEventListener('load', () => {
      let doc = null
      try { doc = f.contentDocument } catch { /* a thing may not let us in; it still shows */ }
      if (!doc) return
      doc.documentElement.dataset.theme = theme()
      if (!live) return
      doc.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.defaultPrevented) close() })
      const fit = () => { f.style.height = Math.max(320, doc.documentElement.scrollHeight) + 'px' }
      fit()
      if (typeof ResizeObserver === 'function' && doc.body) new ResizeObserver(fit).observe(doc.body)
    })
    return f
  }

  const tile = item => el('button', { class: 'tile', type: 'button', 'data-id': item.id, 'data-level': item.level, 'aria-label': `${item.name}, ${WORD[item.level]}` },
    el('span', { class: 'tv', 'aria-hidden': 'true' }, frame(item, false)),
    el('span', { class: 'tf' }, sign(item.level), el('span', { class: 'tn', text: item.name })))

  const row = (label, ...value) => el('div', {}, el('dt', { text: label }), el('dd', {}, ...value))
  const card = item => {
    const done = item.level === 'done'
    const path = (done ? 'skills/banui/examples/' : 'probes/') + item.folder
    const take = el('div', { class: 'take' }, done ? 'Папка для копирования' : 'Лежит только у вас', el('code', { text: path }))
    if (done) {
      const label = el('span', { text: 'Скопировать путь' })
      const copy = el('button', { class: 'ban-button', type: 'button', tabindex: '0' }, label)
      copy.addEventListener('click', () => {
        try { navigator.clipboard.writeText(path).catch(() => {}) } catch { /* no clipboard here */ }
        morphLabel(label, 'Скопировано')
      })
      take.append(copy)
    }
    const meta = el('dl', { class: 'meta' }, row('Уровень', sign(item.level), WORD[item.level]), row('Группа', GROUPS.find(g => g[0] === item.group)?.[1] ?? 'Разное'))
    if (item.signs) meta.append(row('Знаки', item.signs))
    if (date(item.added)) meta.append(row('Добавлена', date(item.added)))
    const info = el('div', { class: 'info' },
      el('div', { class: 'info-head' }, el('b', { text: item.name }), el('button', { class: 'x', id: 'close', type: 'button', 'aria-label': 'Закрыть' }, ln(), ln())),
      meta)
    if (item.note) info.append(el('p', { class: 'note', text: item.note }))
    info.append(take)
    return el('article', { class: 'card', 'data-id': item.id }, el('div', { class: 'stage' }, frame(item, true)), info)
  }

  // ---------- frame of the page ----------
  const count = el('span', { class: 'count', id: 'count' })
  const filter = el('div', { class: 'ban-nav', id: 'filter', role: 'tablist', 'aria-label': 'Уровень' },
    ...['Все', 'Доведённые', 'Пробы'].map((t, i) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(i === 0), tabindex: i === 0 ? '0' : '-1', text: t })))
  const themeEl = el('button', { class: 'ban-toggle', id: 'theme', type: 'button', role: 'switch', 'aria-checked': 'false' })
  const groups = el('div', { id: 'groups' })
  const empty = el('p', { class: 'empty', id: 'empty', hidden: true, text: 'В этом уровне пока ничего нет.' })
  root.replaceChildren(el('div', { class: 'wrap' },
    el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('b', { text: 'banui' }), count),
      el('div', { class: 'tools' }, filter, el('label', { class: 'theme', for: 'theme', text: 'Тёмная' }), themeEl)),
    el('p', { class: 'legend' },
      el('span', {}, sign('done'), 'доведённая: агент может копировать'),
      el('span', {}, sign('probe'), 'проба: только у вас, только смотреть')),
    groups, empty))

  const n = l => items.filter(i => i.level === l).length
  count.textContent = `${items.length} наработок: ${n('done')} доведённых, ${n('probe')} проб`

  function draw() {
    const open = openId()
    const shown = items.filter(i => !level || i.level === level)
    groups.replaceChildren(...GROUPS.flatMap(([key, name]) => {
      const list = shown.filter(i => i.group === key)
      if (!list.length) return []
      return [el('section', { class: 'group', 'data-group': key },
        el('h2', {}, name, el('span', { text: String(list.length) })),
        el('div', { class: 'tiles' }, ...list.map(i => i.id === open ? card(i) : tile(i))))]
    }))
    empty.hidden = shown.length > 0
  }

  // The tile grows into the card: the card starts at the tile's box and settles into its own.
  function render(after) {
    const id = openId()
    const from = id && groups.querySelector(`.tile[data-id="${CSS.escape(id)}"]`)?.getBoundingClientRect()
    draw()
    after?.()
    const c = groups.querySelector('.card')
    if (!from || !c || still()) return
    const to = c.getBoundingClientRect()
    c.style.transformOrigin = '0 0'
    c.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: .6 },
      { transform: 'none', opacity: 1 },
    ], { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' })
  }

  function close() {
    const id = openId()
    if (!id) return
    history.pushState('', '', location.pathname + location.search)
    render(() => groups.querySelector(`.tile[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }))
  }

  groups.addEventListener('click', e => {
    if (e.target.closest('#close')) return close()
    const t = e.target.closest('.tile')
    if (t) location.hash = t.dataset.id
  })
  addEventListener('hashchange', () => render(() => groups.querySelector('#close')?.focus({ preventScroll: true })))
  addEventListener('popstate', () => { if (!location.hash) render() })
  addEventListener('keydown', e => { if (e.key === 'Escape') close() })

  const filterCtl = nav(filter)
  filter.addEventListener('ban:change', () => {
    level = LEVELS[filterCtl.index]
    const open = openId()
    if (open && level && byId.get(open).level !== level) history.pushState('', '', location.pathname + location.search)
    render()
  })

  const themeCtl = toggle(themeEl)
  themeCtl.checked = matchMedia('(prefers-color-scheme: dark)').matches
  const paint = () => {
    root.dataset.theme = themeCtl.checked ? 'dark' : 'light'
    for (const f of root.querySelectorAll('iframe')) { try { f.contentDocument.documentElement.dataset.theme = theme() } catch { /* not ours to style */ } }
  }
  themeEl.addEventListener('ban:change', paint)
  paint()
  draw()
}

const root = document.querySelector('#app')
if (root) {
  const given = globalThis.__BANUI_ITEMS__
  if (given) start(root, given)
  else fetch(new URL('./collection.json', location.href)).then(r => r.json()).then(items => start(root, items))
}
