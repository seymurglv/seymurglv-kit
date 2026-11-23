import { expect, test } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collect, readMeta } from '../../showcase/collect.mjs'

/** A fresh banui-shaped root in the system temp folder; each test builds its own. */
const tree = (): string => mkdtempSync(join(tmpdir(), 'banui-collect-'))

/** Writes `<dir>/<file>`, creating the folders on the way. */
function put(dir: string, html: string, file = 'index.html'): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), html)
}

const example = (root: string, name: string): string => join(root, 'skills', 'banui', 'examples', name)
const meta = (name: string, content: string): string => `<meta name="banui:${name}" content="${content}">`

test('читает название и сведения со страницы', () => {
  expect(readMeta('<title>Флажок</title><meta name="banui:group" content="control"><meta name="banui:signs" content="капсула, линия"><meta name="banui:note" content="Две линии"><meta name="banui:added" content="2026-11-12">'))
    .toEqual({ name: 'Флажок', group: 'control', signs: 'капсула, линия', note: 'Две линии', added: '2026-11-12' })
  expect(readMeta('<p>без сведений</p>')).toEqual({ name: null, group: 'other', signs: '', note: '', added: '' })
  expect(readMeta('<meta name="banui:group" content="widget">').group).toBe('other')
  // values are text, not page source: an entity is read once, an unknown one stays as written
  expect(readMeta('<title>Флажок &amp; линия</title><meta name="banui:note" content="Две &quot;линии&quot; &#8212; да&nbsp;&#x2713; &lt;b&gt; &#39;и&#39; &amp;lt; &mdash;">'))
    .toMatchObject({ name: 'Флажок & линия', note: 'Две "линии" — да ✓ <b> \'и\' &lt; &mdash;' })
})
test('уровень задаёт папка, адрес пробы с приставкой', () => {
  const root = tree(), probes = join(root, 'probes')
  put(example(root, 'toggle'), '<title>А</title>')
  put(join(probes, 'alpha'), '<title>Б</title>')
  put(join(probes, 'toggle'), '<title>В</title>')
  expect(collect({ root, probes }).map(i => [i.id, i.level, i.url])).toEqual([
    ['toggle', 'done', '/skills/banui/examples/toggle/index.html'],
    ['probe-alpha', 'probe', '/probes/alpha/index.html'],
    ['probe-toggle', 'probe', '/probes/toggle/index.html'],
  ]) // fixture titles are «А», «Б», «В» in this order: same group and date, so the order is by name
})
test('без папки проб остаются только доведённые', () => {
  const root = tree()
  put(example(root, 'toggle'), '<title>А</title>')
  put(join(root, 'probes', 'alpha'), '<title>Б</title>') // present on disk, but nobody names it
  expect(collect({ root, probes: join(root, 'нет-такой') }).every(i => i.level === 'done')).toBe(true)
  expect(collect({ root }).length).toBe(1)
})
test('мусор пропускается', () => {
  const root = tree(), probes = join(root, 'probes')
  put(join(probes, '_draft'), '<title>Черновик</title>')
  put(join(probes, '.board'), '<title>Доска</title>')
  put(join(probes, 'noindex'), 'не страница', 'readme.txt')
  put(join(probes, 'Bad Name'), '<title>Имя</title>')
  put(example(root, 'probe-x'), '<title>Занятое имя</title>') // would share its id with probes/x
  expect(collect({ root, probes }).filter(i => i.level === 'probe')).toEqual([])
  expect(collect({ root, probes }).map(i => i.id)).toEqual([])
})
test('порядок: группы по списку, внутри новые выше', () => {
  const root = tree()
  // Each rule is the only one that can put its item where it belongs:
  // «Афиша» is first by name and last by group, «Ящик» is last by name and first by date,
  // «Точка» and «Якорь» share group and date while their folders (dot, anchor) sort the other way.
  put(example(root, 'poster'), `<title>Афиша</title>${meta('group', 'screen')}${meta('added', '2026-11-01')}`)
  put(example(root, 'dot'), `<title>Точка</title>${meta('group', 'base')}${meta('added', '2026-11-01')}`)
  put(example(root, 'anchor'), `<title>Якорь</title>${meta('group', 'base')}${meta('added', '2026-11-01')}`)
  put(example(root, 'box'), `<title>Ящик</title>${meta('group', 'base')}${meta('added', '2026-11-12')}`)
  expect(collect({ root }).map(i => [i.group, i.added, i.name])).toEqual([
    ['base', '2026-11-12', 'Ящик'], ['base', '2026-11-01', 'Точка'], ['base', '2026-11-01', 'Якорь'], ['screen', '2026-11-01', 'Афиша'],
  ])
})
