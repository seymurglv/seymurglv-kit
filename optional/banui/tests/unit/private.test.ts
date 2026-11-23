import { expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const git = (...args: string[]): string => {
  // stderr is piped, so a failure travels in the thrown error instead of the test output
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
  catch (e) {
    // git grep exits 1 when nothing matches; any other failure means the guard did not run
    if (args[0] === 'grep' && (e as { status?: number }).status === 1) return ''
    throw e
  }
}

// Assembled from pieces, here and in the samples below, so this file does not match itself.
// Plain enough to mean the same to git grep -E and to RegExp.
const ARTIFACT_LINK = ['claude\\.ai/', '(code/)?', 'artifact/'].join('')

test('сторож падает, если git не отработал', () => {
  expect(() => git('grep', '-lE', '(', '--', ':/')).toThrow() // invalid pattern: git exits 128, not 1
})
test('probes/ исключена из git', () => {
  expect(readFileSync('.gitignore', 'utf8')).toMatch(/^probes\/$/m)
})
test('ни один файл из probes/ не отслеживается', () => {
  expect(git('ls-files', '--', 'probes')).toBe('')
})
test('в отслеживаемых файлах нет адреса артефакта', () => {
  expect(git('grep', '-lE', ARTIFACT_LINK, '--', ':/')).toBe('')
})
test('шаблон адреса ловит оба вида ссылок', () => {
  const link = (...parts: string[]): string => ['https:', '', 'claude.ai', ...parts, 'abc123'].join('/')
  const pattern = new RegExp(ARTIFACT_LINK)
  expect(link('artifact')).toMatch(pattern)
  expect(link('code', 'artifact')).toMatch(pattern)
  expect(link('chat')).not.toMatch(pattern)
})
