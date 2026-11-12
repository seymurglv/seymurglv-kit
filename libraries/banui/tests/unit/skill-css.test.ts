import { expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

test('стартовые стили скилла совпадают с библиотекой', () => {
  const built = execFileSync('node', ['scripts/build-css.mjs', '--print-skill']).toString()
  expect(readFileSync('skills/banui/banui.css', 'utf8')).toBe(built)
})
