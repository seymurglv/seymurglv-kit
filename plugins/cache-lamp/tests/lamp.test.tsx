import { expect, mock, test } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import type { Heartbeat } from '../types'
import { DROP_MS, MIN } from '../hooks/state'
import { TICK_MS, readFleet } from '../hooks/register'

// Sunday 22 November 2026, 12:00 UTC: the clock every test starts on.
const T0 = Date.UTC(2026, 10, 22, 12, 0, 0)
const CWD = '/Users/me/Desktop/demo-project'
const CTX = 180_000
const HOUR = 60 * MIN

// The plugin store, as a map the tests read and write.
const shelf = new Map<string, unknown>()
const fakeStore = {
  store: {
    keys: async () => [...shelf.keys()],
    get: async (k: string) => shelf.get(k),
    delete: async (k: string) => void shelf.delete(k),
  },
} as unknown as EngineInterface

// What the plugin asked of the engine beneath, and how that answers.
const seen = {
  forks: [] as string[],
  toasts: [] as { text: string; timeoutMs?: number }[],
  fork: 'read' as 'read' | 'rebuild' | 'throw' | 'hang',
  storeBroken: false,
  submitted: [] as string[],
  nextStep: 'read' as 'read' | 'written',
}

// Stands for the engine beneath the plugin: a session in a folder, one
// request that read the whole context from the cache.
function engine(on: On) {
  shelf.clear()
  seen.forks = []
  seen.toasts = []
  seen.fork = 'read'
  seen.storeBroken = false
  seen.submitted = []
  seen.nextStep = 'read'
  const clock = mock.clock(on, { now: T0 })
  on('store.get', (_, e) => ({ value: shelf.get(e.key) }))
  on('store.set', (_, e) => {
    if (seen.storeBroken) throw new Error('disk full')
    shelf.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    shelf.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...shelf.keys()] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.usage', () => ({
    value: { startedAt: T0, context: { tokens: CTX + 500, window: 1_000_000, percent: 18 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('ui.toast', (_, e) => {
    seen.toasts.push({ text: e.text, timeoutMs: e.timeoutMs })
    return { value: undefined }
  })
  on('model.fork', (_, e) => {
    seen.forks.push(e.prompt)
    if (seen.fork === 'throw') throw new Error('no fork')
    if (seen.fork === 'hang') return new Promise(() => undefined)
    const created = seen.fork === 'rebuild' ? CTX : 0
    return {
      value: {
        isAnswered: true,
        text: 'ok',
        usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: CTX - created, cache_creation_input_tokens: created, model: 'claude-opus-5-5' },
      },
    }
  })
  on('ui.log', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('prompt.submit', (_, e) => {
    seen.submitted.push(e.text)
    return { text: e.text }
  })
  on('session.compact', (_, e) => ({ messages: e.messages }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('classic.SessionStart', () => ({}))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
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
        cache_read_input_tokens: seen.nextStep === 'written' ? 0 : CTX - 2_000,
        cache_creation_input_tokens: seen.nextStep === 'written' ? CTX - 2_000 : 0,
        model: 'claude-opus-5-5',
      },
    }
  })
  return clock
}

async function start($: Engine) {
  await $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
}

async function request($: Engine, extra: { agentId?: string } = {}) {
  const step = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 2, ...extra })
  for await (const _ of step) {
    // no chunks beneath
  }
  await step.result
}

const typed = (text: string, extra: { command?: { name: string; args: string } } = {}) => ({
  text,
  wait: false,
  origin: { kind: 'composer' as const },
  ...extra,
})

const beat = async (_: Engine, id = 'sess-1') => shelf.get(`hb:${id}`) as Heartbeat | undefined

test('a composer prompt and a request write a heartbeat with ctx, lastActivity and lastOwnPrompt', async ($, on) => {
  const clock = engine(on)
  await start($)
  const fresh = await beat($)
  expect(fresh).toMatchObject({ id: 'sess-1', label: 'demo-project', ctx: 0, ttlMin: 60, lastActivity: 0, keepWarm: 'off' })

  await $.prompt.submit(typed('Fix the failing cache test in the keys module please'))
  await $.turn.start({ turnId: 't1', text: 'go' })
  expect((await beat($))?.working).toBe(true)
  await clock.advance(5_000)
  await request($)
  const mid = await beat($)
  expect(mid).toMatchObject({
    label: 'demo-project',
    lastOwnPrompt: T0,
    keepWarm: 'on',
    ctx: CTX,
    lastActivity: T0 + 5_000,
  })

  await $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 5000, isAborted: false, reason: 'answer' })
  const end = await beat($)
  expect(end?.working).toBe(false)
  // the engine's own count of the context wins once the turn ends
  expect(end?.ctx).toBe(CTX + 500)

  // the label is the folder; a prompt never renames it
  await $.prompt.submit(typed('another'))
  expect((await beat($))?.label).toBe('demo-project')
})

test('a prompt from a non-person origin, and a subagent step and turn, change nothing', async ($, on) => {
  engine(on)
  await start($)
  const before = await beat($)
  await $.prompt.submit({ text: 'from a task', wait: false, origin: { kind: 'task-notification' } })
  await request($, { agentId: 'a1' })
  await $.turn.start({ turnId: 't9', text: 'go', agentId: 'a1' })
  expect(await beat($)).toEqual(before)
})

test('a slash command is not an own prompt: no rename, no re-arm', async ($, on) => {
  const clock = engine(on)
  await start($)
  await $.prompt.submit(typed('/cache-lamp', { command: { name: 'cache-lamp', args: '' } }))
  expect(await beat($)).toMatchObject({ label: 'demo-project', lastOwnPrompt: 0, keepWarm: 'off' })

  await $.prompt.submit(typed('real prompt'))
  await clock.advance(1_000)
  await $.prompt.submit(typed('/cache-lamp', { command: { name: 'cache-lamp', args: '' } }))
  expect(await beat($)).toMatchObject({ lastOwnPrompt: T0 })
})

test('a store that throws does not break the prompt', async ($, on) => {
  engine(on)
  await start($)
  seen.storeBroken = true
  await $.prompt.submit(typed('still goes through'))
  expect(seen.submitted).toEqual(['still goes through'])
})

test('clear resets the cache to unknown', async ($, on) => {
  engine(on)
  await start($)
  await $.prompt.submit(typed('hello'))
  await request($)
  expect((await beat($))?.lastActivity).toBe(T0)

  await $.classic.SessionStart({ source: 'clear', session_id: 'sess-1' })
  expect(await beat($)).toMatchObject({ lastActivity: 0, lastOwnPrompt: 0 })

  await request($)
  await $.prompt.submit(typed('again'))
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'summary', toolUses: [] }] })
  expect(await beat($)).toMatchObject({ lastActivity: 0, lastOwnPrompt: 0 })
})

test('clear under a new session id moves the heartbeat to the new key', async ($, on) => {
  engine(on)
  await start($)
  await $.prompt.submit(typed('hello there'))
  await request($)

  await $.classic.SessionStart({ source: 'clear', session_id: 'sess-2' })
  expect(shelf.has('hb:sess-1')).toBe(false)
  expect(await beat($, 'sess-2')).toMatchObject({ id: 'sess-2', label: 'demo-project', lastActivity: 0, lastOwnPrompt: 0, working: false })
})

test('session.end deletes the heartbeat for good', async ($, on) => {
  const clock = engine(on)
  await start($)
  expect(await beat($)).toBeDefined()
  await $.session.end({ sessionId: 'sess-1', reason: 'other', resume: { id: 'x' } })
  expect(await beat($)).toBeUndefined()
  await clock.advance(TICK_MS * 3)
  expect(await beat($)).toBeUndefined()
})

test('readFleet drops a heartbeat silent for over an hour', async ($, on) => {
  const clock = engine(on)
  await start($)
  const old: Heartbeat = { ...(await beat($))!, id: 'old', label: 'old', updatedAt: T0 - DROP_MS - 1 }
  const recent: Heartbeat = { ...old, id: 'recent', label: 'recent', updatedAt: T0 - 10 * MIN }
  shelf.set('hb:old', old)
  shelf.set('hb:recent', recent)
  shelf.set('other', { x: 1 })

  const fleet = await readFleet(fakeStore, await clock.now())
  expect(fleet.map(h => h.id).sort()).toEqual(['recent', 'sess-1'])
  expect(shelf.has('hb:old')).toBe(false)
  expect(shelf.get('other')).toEqual({ x: 1 })
})

// A session whose last request was at T0 and whose person just prompted.
async function idleBig($: Engine) {
  await start($)
  await $.prompt.submit(typed('Keep this big cache warm'))
  await request($)
}

test('a big idle session pings at 6 min left and stays warm', async ($, on) => {
  const clock = engine(on)
  await idleBig($)
  await clock.advance(53 * MIN)
  expect(seen.forks).toHaveLength(0)
  await clock.advance(2 * MIN)
  expect(seen.forks).toEqual(['cache-lamp keep-alive. Reply with only: ok'])
  const hb = await beat($)
  expect(hb?.keepWarm).toBe('on')
  expect(hb!.lastActivity).toBeGreaterThanOrEqual(T0 + 53 * MIN)
  // it is warm again for a while: no second ping right after
  await clock.advance(10 * MIN)
  expect(seen.forks).toHaveLength(1)
})

test('no ping on the 5-min TTL', async ($, on) => {
  const clock = engine(on)
  await idleBig($)
  await clock.advance(6 * MIN)
  seen.nextStep = 'written'
  await request($)
  expect((await beat($))?.ttlMin).toBe(5)
  await clock.advance(40 * MIN)
  expect(seen.forks).toHaveLength(0)
})

test('no ping 3 h after the last own prompt, and the warning toast follows', async ($, on) => {
  const clock = engine(on)
  await idleBig($)
  await clock.advance(218 * MIN)
  // pings at 54, 108 and 162 min; none once the 3 h are over
  expect(seen.forks).toHaveLength(3)
  expect(seen.toasts).toHaveLength(1)
  expect(seen.toasts[0]?.timeoutMs).toBe(15_000)
  await clock.advance(MIN)
  expect(seen.forks).toHaveLength(3)
  expect(seen.toasts).toHaveLength(1)
})

test('a rebuilding ping stops keep-warm with reason rebuilt and never pings again', async ($, on) => {
  const clock = engine(on)
  await idleBig($)
  seen.fork = 'rebuild'
  await clock.advance(56 * MIN)
  expect(seen.forks).toHaveLength(1)
  expect(await beat($)).toMatchObject({ keepWarm: 'stopped', stopReason: 'rebuilt', ttlMin: 5 })
  await clock.advance(30 * MIN)
  expect(seen.forks).toHaveLength(1)
})

test('a fork that throws stops keep-warm with reason noAnswer', async ($, on) => {
  const clock = engine(on)
  await idleBig($)
  seen.fork = 'throw'
  await clock.advance(56 * MIN)
  expect(seen.forks).toHaveLength(1)
  expect(await beat($)).toMatchObject({ keepWarm: 'stopped', stopReason: 'noAnswer' })
  await clock.advance(30 * MIN)
  expect(seen.forks).toHaveLength(1)
})

test('a fork that never answers stops keep-warm after the deadline and the heartbeat keeps beating', async ($, on) => {
  const clock = engine(on)
  await idleBig($)
  seen.fork = 'hang'
  await clock.advance(55 * MIN)
  expect(seen.forks).toHaveLength(1)
  expect(await beat($)).toMatchObject({ keepWarm: 'on' })
  await clock.advance(3 * MIN)
  expect(await beat($)).toMatchObject({ keepWarm: 'stopped', stopReason: 'noAnswer' })
  const at = (await beat($))!.updatedAt
  await clock.advance(5 * MIN)
  expect((await beat($))!.updatedAt).toBeGreaterThan(at)
  expect(seen.forks).toHaveLength(1)
})

test('only the session with the latest own prompt shows the toast, once', async ($, on) => {
  const clock = engine(on)
  await idleBig($)
  await clock.advance(10 * MIN)
  const now = await clock.now()
  const other = (lastOwnPrompt: number): Heartbeat => ({
    id: 'sess-2',
    label: 'other',
    ctx: CTX,
    ttlMin: 60,
    lastActivity: now - 57 * MIN,
    lastOwnPrompt,
    working: false,
    keepWarm: 'off',
    updatedAt: now,
  })
  // the other session was prompted later: it is the target, not this one
  shelf.set('hb:sess-2', other(now - MIN))
  await clock.advance(TICK_MS * 2)
  expect(seen.toasts).toHaveLength(0)

  // this session was prompted later: it speaks, once
  shelf.set('hb:sess-2', { ...other(T0 - HOUR), updatedAt: await clock.now() })
  await clock.advance(TICK_MS)
  await clock.advance(TICK_MS)
  expect(seen.toasts).toHaveLength(1)
  expect(seen.toasts[0]?.text).toContain('other')
})

test('no ping and no toast while working', async ($, on) => {
  const clock = engine(on)
  await idleBig($)
  await $.turn.start({ turnId: 't2', text: 'go' })
  await clock.advance(58 * MIN)
  expect(seen.forks).toHaveLength(0)
  expect(seen.toasts).toHaveLength(0)
})

// ---- the lamp line and /cache-lamp ----

const SURFACES = ['terminal', 'desktop'] as const

const BAND = {
  plugin: 'cache-lamp',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

const RU = { options: { language: 'ru' } }

const neighbour = (now: number, over: Partial<Heartbeat> = {}): Heartbeat => ({
  id: 'sess-2',
  label: 'other',
  ctx: CTX,
  ttlMin: 60,
  lastActivity: now - 57 * MIN,
  lastOwnPrompt: 0,
  working: false,
  keepWarm: 'off',
  updatedAt: now,
  ...over,
})

const dump = (ui: unknown): string => JSON.stringify(ui)

test('nothing is drawn before the first request', RU, async ($, on) => {
  engine(on)
  await start($)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /●|мин/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('a warm line reads "42 мин · 180k"', RU, async ($, on) => {
  const clock = engine(on)
  await start($)
  await request($)
  await clock.advance(18 * MIN)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /^42 мин · 180k$/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the lamp lights only for a big cooling session', RU, async ($, on) => {
  const clock = engine(on)
  await start($)
  await request($)
  // warm: a rest dot
  await clock.advance(10 * MIN)
  const restTerm = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(dump(await restTerm.find({ type: 'Text', text: '●' }))).not.toContain('blue')
  await restTerm.unmount()
  const restDesk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(dump(await restDesk.find({ type: 'Svg' }))).toContain('#808080')
  expect(dump(await restDesk.find({ type: 'Svg' }))).not.toContain('animate')
  expect(dump(await restDesk.find({ type: 'Svg' }))).toContain('r=\\"1.5\\"')
  await restDesk.unmount()

  // cooling and big: lit
  await clock.advance(46 * MIN)
  const litTerm = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(dump(await litTerm.find({ type: 'Text', text: '●' }))).toContain('blue')
  expect(await litTerm.find({ type: 'Text', text: /^остынет через/ })).toBeDefined()
  await litTerm.unmount()
  const litDesk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = dump(await litDesk.find({ type: 'Svg' }))
  expect(svg).toContain('#2F6BFF')
  expect(svg).toContain('r=\\"1.5\\"')
  expect(svg).toContain('values=\\"1;0.35;1\\"')
  expect(svg).toContain('2.4s')
  await litDesk.unmount()
})

test('a small cooling session stays at rest', { options: { language: 'ru', bigTokens: 500_000 } }, async ($, on) => {
  const clock = engine(on)
  await start($)
  await request($)
  await clock.advance(56 * MIN)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(dump(await ui.find({ type: 'Text', text: '●' }))).not.toContain('blue')
  await ui.unmount()
})

test('a cooling neighbour gets a row, a cold one does not', RU, async ($, on) => {
  const clock = engine(on)
  await start($)
  await request($)
  const now = await clock.now()
  shelf.set('hb:sess-2', neighbour(now))
  shelf.set('hb:sess-3', neighbour(now, { id: 'sess-3', label: 'frozen', lastActivity: now - 90 * MIN }))
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /^other 180k$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /frozen/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('stopped keep-warm shows its reason', RU, async ($, on) => {
  const clock = engine(on)
  await idleBig($)
  seen.fork = 'rebuild'
  await clock.advance(56 * MIN)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /· подогрев выключен: пинг пересобрал кэш/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the line hides while a turn runs or a survey is open', RU, async ($, on) => {
  engine(on)
  await start($)
  await request($)
  for (const surface of SURFACES) {
    for (const props of [{ isWorking: true }, { hasSurvey: true }]) {
      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, ...props } })
      expect(await ui.find({ type: 'Text', text: /мин|●/ })).toBeUndefined()
      await ui.unmount()
    }
  }
})

test('/cache-lamp lists a cold neighbour too', RU, async ($, on) => {
  const clock = engine(on)
  await start($)
  await request($)
  const now = await clock.now()
  shelf.set('hb:sess-3', neighbour(now, { id: 'sess-3', label: 'frozen', lastActivity: now - 90 * MIN }))
  shelf.set('hb:sess-4', neighbour(now, { id: 'sess-4', label: 'fresh', lastActivity: 0 }))
  const result = await $.command.run({
    command: 'cache-lamp',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  const text = JSON.stringify(result)
  expect(text).toContain('этот чат: кэш тёплый')
  expect(text).toContain('frozen: кэш остыл')
  expect(text).not.toContain('fresh')
})
