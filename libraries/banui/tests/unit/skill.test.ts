import { expect, test } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SKILL = 'skills/banui'
const tokens = readFileSync('src/tokens.css', 'utf8')
// The first block is the light theme, the one the skill's tables are written for.
const light = tokens.slice(0, tokens.indexOf('@media'))
const token = (name: string): string | undefined => new RegExp(`--ban-${name}:\\s*([^;]+);`).exec(light)?.[1]

const read = (file: string): string => readFileSync(join(SKILL, file), 'utf8')
const prose = ['SKILL.md', ...readdirSync(join(SKILL, 'references')).map(f => `references/${f}`)]

const check = (...paths: string[]) => spawnSync(process.execPath, [join(SKILL, 'scripts/check.mjs'), ...paths], { encoding: 'utf8' })

test('карта ламп в навыке совпадает с токенами', () => {
  const rows = [...read('SKILL.md').matchAll(/^\|[^|]+\| `(\w+)` \| `(#\w+)` \| `(#\w+)` \|/gm)]
  expect(rows.map(r => r[1])).toEqual(['done', 'error', 'rec', 'attention'])
  for (const [, name, cap, card] of rows) {
    expect(cap, `${name} on a capsule`).toBe(token(`${name}-cap`))
    expect(card, `${name} on a card`).toBe(token(`${name}-card`))
  }
})

test('в тексте навыка нет цвета, которого нет в токенах', () => {
  for (const file of prose)
    for (const [hex] of read(file).matchAll(/#[0-9A-Fa-f]{6}\b/g)) expect(tokens, `${hex} in ${file}`).toContain(hex)
})

test('каждое время из токенов стоит в таблице движения', () => {
  const table = read('references/foundations.md').split('\n').filter(line => line.startsWith('|'))
  const times = [...tokens.matchAll(/--ban-t-(\w+):\s*([\d.]+)s;/g)]
  expect(times.length).toBeGreaterThan(0)
  for (const [, name, seconds] of times) {
    const ms = Math.round(parseFloat(seconds) * 1000)
    expect(table.some(row => row.includes(`${ms} ms`) && row.includes(`\`t-${name}\``)), `t-${name} = ${ms} ms`).toBe(true)
  }
})

test('проверка проходит на примерах навыка', () => {
  const run = check(join(SKILL, 'examples'))
  expect(run.stderr).toBe('')
  expect(run.status).toBe(0)
})

test('проверка ловит то, чего в banui нет', () => {
  // A scratch folder that the next run overwrites.
  const dir = resolve('node_modules/.cache/banui-check-test')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'page.html'), [
    '<style>',
    '.err { color: #f00; font-size: 14px; }',
    '.hero { background: linear-gradient(white, black); }',
    '@keyframes turn { to { transform: rotate(360deg); } }',
    '</style>',
    '<a href="#fee">an anchor, not a color</a>',
    '<dialog open>Sure?</dialog>',
    '<div class="toast">Saved</div>',
    '<svg viewBox="0 0 24 24"></svg>',
    '<svg class="ban-pen" aria-hidden="true"></svg>',
  ].join('\n'))
  const run = check(dir)
  expect(run.status).toBe(1)
  const hits = run.stderr.trim().split('\n').map(line => line.split('  ').slice(0, 2).join(' ').replace(/^.*page\.html:/, ''))
  expect(hits).toEqual(['2 text-size', '2 color', '3 gradient', '4 spinner', '7 dialog', '8 toast', '9 icon'])
})
