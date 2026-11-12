import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const SURFACES = ['terminal', 'desktop'] as const

const BAND = {
  plugin: 'waypoints',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

const USAGE = {
  input_tokens: 40,
  output_tokens: 90,
  cache_read_input_tokens: 120_000,
  cache_creation_input_tokens: 300,
}

const LONG_ANSWER = 'The fix in keys.py is ready and the tests pass. '.repeat(3)

type Seen = {
  forks: number
  fills: string[]
  ghosts: string[]
  forkPrompts: string[]
  /** What the fork answers; a test may change it between turns. */
  reply: string
  /** How long the fork takes, on the mocked clock. */
  forkMs: number
  /** Lets the detached fork work run to its end. */
  settle: () => Promise<void>
  /** Moves the mocked clock on. */
  advance: (ms: number) => Promise<void>
}

// Everything beneath the plugin is the test's: these hooks stand for the
// engine, answering each call on `$` with `{ value }`.
function engine(on: On, reply: string): Seen {
  const clock = mock.clock(on)
  mock.store(on)
  const seen: Seen = { forks: 0, fills: [], ghosts: [], forkPrompts: [], reply, forkMs: 0, settle: () => clock.settle(), advance: ms => clock.advance(ms) }
  // The engine's own drawing of the band, beneath the plugin: nothing.
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'waypoints' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.list', () => ({
    value: [
      { name: 'code-review', description: 'Review the diff', source: 'plugin' },
      { name: 'end', description: 'Close the session', source: 'user' },
      { name: 'clear', description: 'Clear the conversation', source: 'builtin' },
      { name: 'waypoints', description: 'Fork stats', source: 'plugin' },
    ],
  }))
  on('model.fork', async (_, e) => {
    if (seen.forkMs > 0) await clock.sleep(seen.forkMs)
    seen.forks += 1
    seen.forkPrompts.push(e.prompt)
    return { value: { isAnswered: true, text: seen.reply, usage: USAGE } }
  })
  on('prompt.suggest', (_, e) => {
    seen.ghosts.push(e.text)
    return { isShown: true }
  })
  on('prompt.fill', (_, e) => {
    seen.fills.push(e.text)
    return { isFilled: true }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return seen
}

const REPLY = JSON.stringify([
  { label: 'Закоммить и запушь', prompt: 'Закоммить и запушь' },
  { label: 'Прогони гейты на сцене-шаблоне', prompt: 'Прогони гейты на сцене-шаблоне, потом покажи результат' },
  { label: '/code-review high', prompt: '/code-review high' },
])

// The terminal draws the digit and the label as one Button; the desktop
// holds the hotkey in a Button of its own, in the key column.
function labelKey(surface: (typeof SURFACES)[number], n: string): string {
  return surface === 'terminal' ? `pick-${n}` : `label-${n}`
}

type Node = { type: string; props?: Record<string, unknown>; hover?: Record<string, unknown>; children?: unknown[] }

function isNode(x: unknown): x is Node {
  return typeof x === 'object' && x !== null && 'type' in x
}

function walk(node: unknown, visit: (n: Node) => void): void {
  if (!isNode(node)) return
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function all(node: unknown): Node[] {
  const out: Node[] = []
  walk(node, n => out.push(n))
  return out
}

function byKey(node: unknown, key: string): Node | undefined {
  return all(node).find(n => n.props?.key === key)
}

function answer(turnId: string, text = LONG_ANSWER, agentId?: string) {
  return {
    answer: text,
    durationMs: 1000,
    isAborted: false,
    turnId,
    reason: 'answer' as const,
    ...(agentId === undefined ? {} : { agentId }),
  }
}

test('a turn brings three rows, the first as ghost text, on every surface', async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await seen.settle()

  expect(seen.forks).toBe(1)
  expect(seen.ghosts).toEqual(['Закоммить и запушь'])
  // The fork is told about plugin and user commands, never the engine's or ours.
  expect(seen.forkPrompts[0]).toContain('/code-review: Review the diff')
  expect(seen.forkPrompts[0]).toContain('/end: Close the session')
  expect(seen.forkPrompts[0]).not.toContain('/clear')
  expect(seen.forkPrompts[0]).not.toContain('/waypoints')

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    for (const [n, text] of [
      ['1', 'Закоммить и запушь'],
      ['2', 'Прогони гейты на сцене-шаблоне'],
      ['3', '/code-review high'],
    ] as const) {
      expect((await ui.find({ type: 'Button', key: `pick-${n}` }))?.props.hotkey).toBe(n)
      expect((await ui.find({ type: 'Button', key: labelKey(surface, n) }))?.text).toContain(text)
    }
    // The desktop prompt box draws no ghost text, so its key line leaves Tab out.
    const keys = surface === 'terminal' ? '1–3 insert · Tab takes the first' : '1–3 insert'
    expect((await ui.findAll({ type: 'Text', text: /1–3/ })).map(t => t.text.trim())).toContain(
      surface === 'terminal' ? `${keys} ·` : keys,
    )
    expect((await ui.find({ type: 'Button', key: 'hide' }))?.props.hotkey).toBe('0')
    await ui.unmount()
  }
})

test('a pick fills the prompt box and sends nothing, on every surface', async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of SURFACES) {
    seen.fills = []
    await $.turn.complete(answer(`pick-${surface}`))
    await seen.settle()
    const ui = await $.ui.mount({ ...BAND, surface })

    await ui.press({ key: labelKey(surface, '2') })

    expect(seen.fills).toEqual(['Прогони гейты на сцене-шаблоне, потом покажи результат'])
    expect(await ui.find({ type: 'Button', key: 'pick-1' })).toBeUndefined()
    await ui.unmount()
  }
})

test('desktop: one highlight per row, the hint after the label, nothing overlaps', async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await seen.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const tree = await ui.drawn()

  for (const n of ['1', '2', '3']) {
    const row = byKey(tree, `row-${n}`)
    expect(row?.type).toBe('Box')
    // The row's own hover is its one fill; every Button in it clears the app's.
    expect(row?.hover?.backgroundColor).toBeDefined()
    const fills = all(row).filter(e => e !== row && e.hover?.backgroundColor !== undefined)
    // Row 3 runs /code-review, so it carries the skill tag too.
    const tagged = n === '3' ? [`skill-${n}`] : []
    expect(fills.map(e => e.props?.key).sort()).toEqual([`label-${n}`, `pick-${n}`, ...tagged].sort())
    for (const e of fills) expect(e.hover?.backgroundColor).toBe('#0000')

    // Key column first, then the label, the skill tag if any, then the hint,
    // shown under the pointer only.
    const kids = (row?.children ?? []).filter(isNode)
    expect(kids[0]?.props?.key).toBe(`pick-${n}`)
    expect(kids[0]?.props?.label).toBe('')
    expect(byKey(kids[1], `label-${n}`)).toBeDefined()
    if (n === '3') expect(byKey(kids[2], 'skill-3')?.props?.label).toBe('code-review')
    const hint = kids.at(-1)
    expect(kids).toHaveLength(n === '3' ? 4 : 3)
    expect(hint?.props?.display).toBe('none')
    expect(hint?.hover?.display).toBe('flex')
    expect(all(hint).some(e => e.type === 'Text')).toBe(true)
  }

  // Nothing is placed out of the flow or pulled over a neighbour.
  for (const e of all(tree)) {
    expect(e.props?.position).not.toBe('absolute')
    for (const [name, value] of Object.entries(e.props ?? {})) {
      if (/^(margin|top|left|right|bottom)/.test(name) && typeof value === 'number') expect(value).toBeGreaterThanOrEqual(0)
    }
  }

  // Desktop drops an Svg whose alt is blank (the kit's surface does not).
  for (const svg of all(tree).filter(e => e.type === 'Svg')) expect(String(svg.props?.alt ?? '').trim()).not.toBe('')

  // The key line: air above it, a spacer to the labels' line, the words, hide last.
  const keys = await ui.find({ type: 'Text', text: '1–3 insert' })
  expect(keys).toBeDefined()
  const footer = all(tree).find(e => e.type === 'Box' && e.props?.marginTop !== undefined && byKey(e, 'hide') !== undefined)
  expect(footer).toBeDefined()
  const parts = (footer?.children ?? []).filter(isNode)
  expect(parts[0]?.type).toBe('Svg')
  const last = parts.at(-1)
  expect(last?.props?.key).toBe('hide')
  await ui.unmount()
})

test('terminal: rows read as a survey, no hover', async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await seen.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const tree = await ui.drawn()
  expect(all(tree).filter(e => e.hover !== undefined)).toEqual([])
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(4)
  await ui.unmount()
})

test('0 hides the rows, on every surface', async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of SURFACES) {
    await $.turn.complete(answer(`hide-${surface}`))
    await seen.settle()
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Button', key: 'pick-1' })).toBeDefined()

    await ui.press({ key: 'hide' })

    expect(await ui.find({ type: 'Button', key: 'pick-1' })).toBeUndefined()
    await ui.unmount()
  }
})

test('a new turn takes the rows down; a subagent turn does not', async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await seen.settle()

  await $.turn.start({ text: 'background', turnId: 'a1', agentId: 'agent-1' })
  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'pick-1' })).toBeDefined()
  await ui.unmount()

  await $.turn.start({ text: 'next', turnId: 't2' })
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'pick-1' })).toBeUndefined()
  await ui.unmount()
})

test('a fork that answers after the next turn began shows nothing', async ($, on) => {
  const seen = engine(on, REPLY)
  seen.forkMs = 3000
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await $.turn.start({ text: 'typed meanwhile', turnId: 't2' })
  await seen.advance(3000)

  expect(seen.forks).toBe(1)
  expect(seen.ghosts).toEqual([])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Button', key: 'pick-1' })).toBeUndefined()
    await ui.unmount()
  }
})

test('while a turn runs or a survey holds the band, no rows', async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await seen.settle()
  for (const surface of SURFACES) {
    for (const props of [{ isWorking: true }, { hasSurvey: true }]) {
      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, ...props } })
      expect(await ui.find({ type: 'Button', key: 'pick-1' })).toBeUndefined()
      await ui.unmount()
    }
  }
})

test('no fork after a short answer, a subagent, an interrupt or an error', async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  await $.turn.complete(answer('short', 'Done.'))
  await seen.settle()

  await seen.settle()
  await $.turn.complete(answer('agent', LONG_ANSWER, 'agent-1'))
  await seen.settle()
  await $.turn.complete({ ...answer('stop'), reason: 'aborted', isAborted: true })
  await seen.settle()
  await $.turn.complete({ ...answer('err'), reason: 'error' })
  await seen.settle()

  expect(seen.forks).toBe(0)
})

test('the shortest answer follows the option', { options: { minAnswerChars: 3 } }, async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('short', 'Done.'))
  await seen.settle()
  expect(seen.forks).toBe(1)
})

test('without suggestSkills the fork hears no command list', { options: { suggestSkills: false } }, async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await seen.settle()
  expect(seen.forkPrompts[0]).not.toContain('<available-commands>')
})

test('a command the session lacks, or ours, is never offered', async ($, on) => {
  const seen = engine(
    on,
    JSON.stringify([
      { label: 'made up', prompt: '/deploy-everything now' },
      { label: 'ours', prompt: '/waypoints' },
      { label: 'real', prompt: '/end' },
    ]),
  )
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await seen.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Button', key: 'label-1' }))?.text).toContain('real')
  expect(await ui.find({ type: 'Button', key: 'pick-2' })).toBeUndefined()
  expect(seen.ghosts).toEqual(['/end'])
  await ui.unmount()
})

test('a step with a skill shows its tag and fills /skill task, on every surface', async ($, on) => {
  const seen = engine(
    on,
    JSON.stringify([
      { label: 'Сделай ревью ветки', prompt: 'проверь ветку перед мержем', skill: 'code-review' },
      { label: 'Выдуманный скилл', prompt: 'что-то', skill: 'deploy-everything' },
    ]),
  )
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of SURFACES) {
    seen.fills = []
    await $.turn.complete(answer(`skill-${surface}`))
    await seen.settle()
    const ui = await $.ui.mount({ ...BAND, surface })
    if (surface === 'terminal') {
      expect((await ui.find({ type: 'Button', key: 'pick-1' }))?.text).toContain('Сделай ревью ветки · code-review')
      expect((await ui.find({ type: 'Button', key: 'pick-2' }))?.text).not.toContain('·')
    } else {
      expect((await ui.find({ type: 'Button', key: 'skill-1' }))?.props.label).toBe('code-review')
      expect(await ui.find({ type: 'Button', key: 'skill-2' })).toBeUndefined()
    }
    // The fork prompt asks for a skill per step.
    expect(seen.forkPrompts[0]).toContain('"skill"')

    await ui.press({ key: labelKey(surface, '1') })
    expect(seen.fills).toEqual(['/code-review проверь ветку перед мержем'])
    await ui.unmount()
  }
})

test('an empty or broken reply shows nothing', async ($, on) => {
  const seen = engine(on, '[]')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const reply of ['[]', 'no idea', '[{"label": 1}]']) {
    seen.reply = reply
    await $.turn.complete(answer(`r-${reply.length}`))
    await seen.settle()
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Button', key: 'pick-1' })).toBeUndefined()
      await ui.unmount()
    }
  }
})

test('Russian words follow the language option', { options: { language: 'ru' } }, async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await seen.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const keys = surface === 'terminal' ? /1–3 вставить · Tab первую/ : /^1–3 вставить$/
    expect(await ui.find({ type: 'Text', text: keys })).toBeDefined()
    await ui.unmount()
  }
})

test('/waypoints reports what the forks took', async ($, on) => {
  const seen = engine(on, REPLY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete(answer('t1'))
  await seen.settle()
  await $.turn.complete(answer('t2'))
  await seen.settle()

  const result = await $.command.run({
    command: 'waypoints',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(JSON.stringify(result)).toContain('This session: 2 requests · 240k from cache')
})
