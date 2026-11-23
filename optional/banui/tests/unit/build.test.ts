import { expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Builds into a scratch folder that the next run overwrites, so the test leaves dist/ alone.
const out = resolve('node_modules/.cache/banui-build-test')

test('собранные файлы загружаются', () => {
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json', '--outDir', out])
  execFileSync(process.execPath, ['scripts/build-css.mjs', '--out', out])

  const entry = pathToFileURL(resolve(out, 'index.js')).href
  const exported = execFileSync(process.execPath, ['--input-type=module', '-e',
    'const m = await import(process.argv[1]); console.log(Object.keys(m).sort().join(" "))', entry]).toString().trim()
  expect(exported).toBe('drop field followHeight morphLabel mount nav select textWidth toggle')

  const css = readFileSync(resolve(out, 'banui.css'), 'utf8')
  expect(css).not.toMatch(/@import/)
  expect(css).not.toMatch(/\.\.\/fonts\//)
  expect(css).toMatch(/url\("\.\/fonts\/caveat-latin-600\.woff2"\)/)
  expect(css).toMatch(/\.ban-drop/)
  expect(css).toMatch(/\.ban-grown/)
  for (const f of ['caveat-latin-600.woff2', 'caveat-cyrillic-600.woff2', 'OFL.txt']) expect(existsSync(resolve(out, 'fonts', f))).toBe(true)
}, 60_000)
