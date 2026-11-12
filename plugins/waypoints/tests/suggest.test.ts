import { expect, test } from 'claude-code/testing'

import { LABEL_MAX, commandList, parseReply, skillTag, visible } from '../hooks/suggest'

test('visible drops what a person cannot see', () => {
  expect(visible('\x1b[31mred\x1b[0m text', 100)).toBe('red text')
  expect(visible('a​b‮c', 100)).toBe('abc')
  expect(visible('line one\n\n  line two', 100)).toBe('line one line two')
  expect(visible('hidden\u{E0041}\u{E0042}', 100)).toBe('')
  expect(visible('é́́́́', 100)).toBe('é́́')
  expect(visible('x'.repeat(60), LABEL_MAX)).toHaveLength(LABEL_MAX)
  expect(visible('x'.repeat(60), LABEL_MAX)).toEndWith('…')
})

test('parseReply keeps three, drops doubles, fills a missing label', () => {
  const reply =
    'Sure:\n' +
    JSON.stringify([
      { prompt: 'run the tests' },
      { label: 'again', prompt: 'run the tests' },
      { label: 'b', prompt: 'b' },
      { label: 'c', prompt: 'c' },
      { label: 'd', prompt: 'd' },
    ])
  const items = parseReply(reply, null, 'waypoints')
  expect(items.map(i => i.prompt)).toEqual(['run the tests', 'b', 'c'])
  expect(items[0]?.label).toBe('run the tests')
})

test('parseReply tags a known skill and puts it before the task', () => {
  const known = new Set(['superpowers:systematic-debugging', 'code-review', 'waypoints'])
  const reply = JSON.stringify([
    { label: 'Найди, почему падает тест', prompt: 'найди, почему падает test_keys', skill: 'superpowers:systematic-debugging' },
    { label: 'Ревью', prompt: '/code-review high' },
    { label: 'Выдумка', prompt: 'сделай что-то', skill: 'made-up' },
    { label: 'Наш', prompt: 'покажи статистику', skill: 'waypoints' },
  ])
  const items = parseReply(reply, known, 'waypoints')
  expect(items).toEqual([
    {
      label: 'Найди, почему падает тест',
      prompt: '/superpowers:systematic-debugging найди, почему падает test_keys',
      skill: 'superpowers:systematic-debugging',
    },
    { label: 'Ревью', prompt: '/code-review high', skill: 'code-review' },
    { label: 'Выдумка', prompt: 'сделай что-то' },
  ])
  expect(skillTag('superpowers:systematic-debugging')).toBe('systematic-debugging')
  expect(skillTag('code-review')).toBe('code-review')
})

test('commandList leaves out the engine, ours and odd names', () => {
  const list = commandList(
    [
      { name: 'end', description: 'Close \x1b[1mthe\x1b[0m session', source: 'user' },
      { name: 'clear', description: 'Clear', source: 'builtin' },
      { name: 'waypoints', description: 'Stats', source: 'plugin' },
      { name: 'bad name', description: 'Spaces', source: 'mcp' },
    ],
    'waypoints',
  )
  expect(list).toBe('/end: Close the session')
})
