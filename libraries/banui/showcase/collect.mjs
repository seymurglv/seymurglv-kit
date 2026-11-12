// Reads the collection: every item is a folder with an index.html, and the place
// the folder lives in is the only thing that decides its level.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

/** @typedef {'base'|'control'|'block'|'screen'|'motion'|'other'} Group */
/** @typedef {{ id: string, folder: string, level: 'done'|'probe', name: string, group: Group,
 *   signs: string, note: string, added: string, dir: string, url: string }} Item */

/** Groups in the order the collection shows them. */
export const GROUPS = /** @type {const} */ (['base', 'control', 'block', 'screen', 'motion', 'other'])

const EXAMPLES = join('skills', 'banui', 'examples')
const FOLDER = /^[a-z0-9-]+$/ // also rules out names that start with "." or "_"
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TITLE = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i
const META = /<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi
const ATTR = /([^\s"'<>\/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

/** One line of text: a title or a content written across several lines reads as one. */
function plain(text) {
  return text.replace(/\s+/g, ' ').trim()
}

/** content of every <meta name="banui:…">, keyed by the part after the colon; the first one wins. */
function banuiMeta(html) {
  /** @type {Record<string, string>} */
  const found = {}
  for (const [tag] of html.matchAll(META)) {
    /** @type {Record<string, string>} */
    const attrs = {}
    for (const [, key, double, single] of tag.matchAll(ATTR)) attrs[key.toLowerCase()] ??= double ?? single
    const key = attrs.name?.startsWith('banui:') ? attrs.name.slice('banui:'.length) : ''
    if (key && attrs.content !== undefined) found[key] ??= plain(attrs.content)
  }
  return found
}

/**
 * What a page says about itself.
 * @param {string} html
 * @returns {{ name: string|null, group: Group, signs: string, note: string, added: string }}
 */
export function readMeta(html) {
  const meta = banuiMeta(html)
  const group = GROUPS.find(g => g === meta.group) ?? 'other'
  return {
    name: plain(TITLE.exec(html)?.[1] ?? '') || null,
    group,
    signs: meta.signs ?? '',
    note: meta.note ?? '',
    added: DATE.test(meta.added ?? '') ? meta.added : '',
  }
}

/** The items of one folder, by folder name; a folder that is not there holds nothing. */
function readLevel(base, level, root) {
  if (!statSync(base, { throwIfNoEntry: false })?.isDirectory()) return []
  /** @type {Item[]} */
  const items = []
  for (const folder of readdirSync(base).sort()) {
    const dir = join(base, folder)
    const page = join(dir, 'index.html')
    if (!FOLDER.test(folder) || !statSync(page, { throwIfNoEntry: false })?.isFile()) continue
    const { name, ...meta } = readMeta(readFileSync(page, 'utf8'))
    const inside = relative(root, dir)
    const served = !inside.startsWith('..') && !isAbsolute(inside)
    items.push({
      id: level === 'probe' ? `probe-${folder}` : folder,
      folder,
      level,
      name: name ?? folder,
      ...meta,
      dir,
      url: served ? `/${inside.split(sep).join('/')}/index.html` : '',
    })
  }
  return items
}

/**
 * Finished examples from the skill and, when a probes folder is named, the probes next to them.
 * Ordered by GROUPS, newest first inside a group, then by name.
 * @param {{ root: string, probes?: string }} options  root: the banui folder; probes: absolute, or relative to root
 * @returns {Item[]}
 */
export function collect({ root, probes }) {
  const base = resolve(root)
  const items = readLevel(join(base, EXAMPLES), 'done', base)
  if (probes) items.push(...readLevel(resolve(base, probes), 'probe', base))
  return items.sort((a, b) =>
    GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)
    || (a.added < b.added ? 1 : a.added > b.added ? -1 : 0)
    || a.name.localeCompare(b.name, 'ru'))
}
