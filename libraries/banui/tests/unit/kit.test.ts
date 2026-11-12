import { expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'

// Builds into a scratch folder that the next run overwrites, so the test leaves dist/ alone.
const out = resolve('node_modules/.cache/banui-kit-test')

/** Every file under dir as { 'relative/path': Buffer }, keys sorted. */
function tree(dir: string): Record<string, Buffer> {
  const root = resolve(dir)
  if (!existsSync(root)) return {}
  const paths = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(root, resolve(entry.parentPath, entry.name)).split('\\').join('/'))
    .sort()
  return Object.fromEntries(paths.map(path => [path, readFileSync(resolve(root, path))]))
}

test('kit в навыке совпадает со сборкой', () => {
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json', '--outDir', out])
  execFileSync(process.execPath, ['scripts/build-css.mjs', '--out', out])

  const built = tree(out), kit = tree('skills/banui/kit')
  expect(Object.keys(kit)).toEqual(Object.keys(built))
  for (const f of Object.keys(built)) expect(kit[f].equals(built[f]), f).toBe(true)
}, 60_000)

test('в навыке один файл стилей, примитивы живут в библиотеке', () => {
  expect(existsSync('skills/banui/banui.css')).toBe(false)
  const css = readFileSync('skills/banui/kit/banui.css', 'utf8')
  for (const rule of ['.ban-muted', '.ban-grown', '.ban-press', '.ban-wave', '.ban-pen[data-pen]']) expect(css).toContain(rule)
})
