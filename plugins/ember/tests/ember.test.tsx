import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { coldRestartUsd, pingUsd, priceOf } from '../hooks/pricing'
import { ringSvg } from '../hooks/ring'
import { mmss, plural, ringAlt, warmthOf } from '../hooks/warmth'
import { setLanguage } from '../hooks/words'

const MIN = 60_000
// Sunday 1 November 2026, 12:00 UTC: the clock every test starts on.
const T0 = Date.UTC(2026, 10, 1, 12, 0, 0)
const CTX = 412_000
const SURFACES = ['terminal', 'desktop'] as const
const TYPED = { args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

const BAND = {
  plugin: 'ember',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const PANE = {
  plugin: 'ember',
  component: 'Pane',
  requestId: 'ember-board',
  props: {
    title: 'Chats',
    isFocused: false,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

// Stands for the engine beneath ember: a session in a folder, a model, a
// context of 412k tokens, and one request that read it all from the cache.
function engine(on: On, cwd = 'C:/Users/me/Desktop/demo-project', registered: string[] = []) {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('command.list', () => ({ value: [] }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => ({ value: cwd }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.usage', () => ({
    value: {
      startedAt: T0 - 30 * MIN,
      context: { tokens: CTX, window: 1_000_000, percent: 41 },
      rateLimits: [],
      cost: { usd: 1.5 },
    },
  }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  // The engine's own band and panes: nothing of theirs to draw.
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        input_tokens: 2_000,
        output_tokens: 300,
        cache_read_input_tokens: CTX - 2_000,
        cache_creation_input_tokens: 0,
        model: 'claude-opus-5-5',
      },
    }
  })
  return clock
}

async function oneRequest($: Engine) {
  await $.session.start({ cwd: 'C:/Users/me/Desktop/demo-project', surface: 'desktop', isInteractive: true })
  const step = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 2 })
  for await (const _ of step) {
    // no chunks beneath
  }
  await step.result
}

test('the words and the prices', () => {
  expect(plural(1, 'минута', 'минуты', 'минут')).toBe('минута')
  expect(plural(3, 'минута', 'минуты', 'минут')).toBe('минуты')
  expect(plural(11, 'минута', 'минуты', 'минут')).toBe('минут')
  expect(plural(41, 'минута', 'минуты', 'минут')).toBe('минута')
  expect(mmss(41 * MIN + 12_000)).toBe('41:12')
  expect(priceOf('claude-opus-5-5').id).toBe('opus-5-5')
  expect(priceOf('claude-opus-5[1m]').id).toBe('opus-5')
  expect(priceOf('haiku').id).toBe('haiku-5-5')
  // 412k written again on the 1-hour TTL: 2 x $4 per million.
  expect(Math.round(coldRestartUsd(CTX, 'claude-opus-5-5', 60) * 1000)).toBe(3296)
  expect(Math.round(pingUsd(CTX, 'claude-opus-5-5') * 10000)).toBe(832)
  const w = warmthOf({ lastActivity: T0, ttlMin: 60, isKept: false }, T0 + 19 * MIN)
  setLanguage(undefined)
  expect(ringAlt(w)).toBe('41 minutes until cold')
  setLanguage('ru')
  expect(ringAlt(w)).toBe('41 минута до остывания')
  setLanguage(undefined)
})

test('the ring carries its digits as outlines and needs no network', () => {
  const svg = ringSvg(0.68, 41, 'ok')
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg).not.toContain('<text')
  expect(svg).not.toMatch(/href|url\(|@import|@font-face/)
  expect(svg.match(/<path class="n"/g)?.length).toBe(2)
  expect(svg).toContain('#1E9E5A')
  expect(svg).toContain('prefers-color-scheme:dark')
  expect(svg.length).toBeLessThan(131_072)
  expect(ringSvg(0, -1, 'idle')).not.toContain('<path')
})

test('warm: the ring, the chat’s cost, quiet keep and handoff, on every surface', async ($, on) => {
  const clock = engine(on)
  await oneRequest($)
  await clock.advance(19 * MIN)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /Warm/ }))?.text).toMatch(/goes cold at/)
    expect(await ui.find({ type: 'Text', text: /412k tokens in cache/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /chat \$1\.50/ })).toBeDefined()
    expect(await ui.find({ key: 'handoff' })).toBeDefined()
    expect(await ui.find({ key: 'keep' })).toBeDefined()
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /^41 min$/ })).toBeDefined()
    } else {
      const ring = await ui.find({ type: 'Svg' })
      expect(ring?.props.alt).toBe('41 minutes until cold')
    }
    await ui.unmount()
  }
})

// With keeping by itself off, so the amber minutes stay amber.
const MANUAL = { options: { autoKeepTokens: 0 } }

test('cooling: amber, the cold-restart cost, and keeping it warm on a press', MANUAL, async ($, on) => {
  const clock = engine(on)
  await oneRequest($)
  await clock.advance(54 * MIN)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Cold in 6 min/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /cold restart/ }))?.text).toContain(
      'cold restart ≈ $3.30 · ping ≈ $0.08',
    )
    expect(await ui.find({ key: 'keep' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'keep' })
  expect((await ui.find({ type: 'Text', text: /Warm/ }))?.text).toMatch(/keeping until/)
  expect(await ui.find({ key: 'release' })).toBeDefined()
  await ui.press({ key: 'release' })
  expect(await ui.find({ type: 'Text', text: /Cold in/ })).toBeDefined()
  await ui.unmount()
})

test('cold: no accent, the rewrite cost, handoff as the main button', MANUAL, async ($, on) => {
  const clock = engine(on)
  await oneRequest($)
  await clock.advance(72 * MIN)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /Cache is cold/ }))?.text).toMatch(/12 min ago/)
    expect(await ui.find({ type: 'Text', text: /rewrites 412k tokens ≈ \$3.30/ })).toBeDefined()
    expect(await ui.find({ key: 'keep' })).toBeUndefined()
    await ui.unmount()
  }
})

test('a big chat is kept warm by itself in its last minutes, and pinged', async ($, on) => {
  const clock = engine(on)
  let forks = 0
  on('model.fork', () => {
    forks += 1
    return {
      value: {
        isAnswered: true,
        text: 'ok',
        usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: CTX, cache_creation_input_tokens: 0 },
      },
    }
  })
  await oneRequest($)
  // 412k is over the 300k default: past 50 minutes it keeps, past 54 it pings.
  await clock.advance(56 * MIN)
  await clock.settle()

  expect(forks).toBe(1)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /1 ping,/ }))?.text).toMatch(/1 ping, \$0.08/)
  await ui.unmount()
})

test('the board lists this chat and today’s spend, on every surface', async ($, on) => {
  const clock = engine(on)
  await oneRequest($)
  await clock.advance(19 * MIN)
  await $.command.run({ command: 'board', ...TYPED })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /^Chats$/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /open/ }))?.text).toBe('1 open · $1.50 today')
    expect(await ui.find({ type: 'Text', text: /demo-project/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^\s*41%$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^\s*41:00$/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a handoff answer turns the band into clear-and-continue', async ($, on) => {
  engine(on)
  on('command.run', () => ({ text: '' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  await oneRequest($)

  await $.command.run({ command: 'ember:handoff', ...TYPED })
  await $.turn.start({ text: '/ember:handoff', turnId: 't2' })
  const answer = '# Handoff: ember\n\n## Goal\n' + 'x'.repeat(300)
  await $.turn.complete({ answer, durationMs: 1000, isAborted: false, turnId: 't2', reason: 'answer' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'continue' })).toBeDefined()
    expect(await ui.find({ key: 'drop' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /handoff ready/ })).toBeDefined()
    await ui.unmount()
  }
})

test('Russian words with language: ru', { options: { language: 'ru' } }, async ($, on) => {
  const clock = engine(on)
  await oneRequest($)
  await clock.advance(19 * MIN)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Тёплый/ }))?.text).toMatch(/остынет в/)
  expect(await ui.find({ type: 'Text', text: /412k токенов в кэше/ })).toBeDefined()
  await ui.unmount()
})

test('one handoff entry: the skill, no /handoff command of ember’s own', async ($, on) => {
  const names: string[] = []
  engine(on, undefined, names)
  await $.session.start({ cwd: 'C:/Users/me/Desktop/demo-project', surface: 'desktop', isInteractive: true })
  expect(names).toContain('board')
  expect(names).toContain('ember')
  expect(names.some(n => n.includes('handoff'))).toBe(false)
})
