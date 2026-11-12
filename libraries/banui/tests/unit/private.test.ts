import { expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const git = (...args: string[]): string => {
  try { return execFileSync('git', args, { encoding: 'utf8' }) }
  catch (e) { return (e as { stdout?: string }).stdout ?? '' } // git grep exits 1 when nothing matches
}

test('probes/ исключена из git', () => {
  expect(readFileSync('.gitignore', 'utf8')).toMatch(/^probes\/$/m)
})
test('ни один файл из probes/ не отслеживается', () => {
  expect(git('ls-files', '--', 'probes')).toBe('')
})
test('в отслеживаемых файлах нет адреса артефакта', () => {
  const pattern = ['claude\\.ai/', '(code/)?', 'artifact/'].join('') // split, so this file does not match itself
  expect(git('grep', '-lE', pattern, '--', ':/')).toBe('')
})
