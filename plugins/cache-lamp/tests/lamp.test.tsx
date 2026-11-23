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

// The plugin store, as a map the tests read and write.
const shelf = new Map<string, unknown>()
const fakeStore = {
  store: {
    keys: async () => [...shelf.keys()],
    get: async (k: string) => shelf.get(k),
    delete: async (k: string) => void shelf.delete(k),
  },
} as unknown as EngineInterface

// Stands for the engine beneath the plugin: a session in a folder, one
// request that read the whole context from the cache.
function engine(on: On) {
  shelf.clear()
  const clock = mock.clock(on, { now: T0 })
  on('store.get', (_, e) => ({ value: shelf.get(e.key) }))
  on('store.set', (_, e) => {
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
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
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
        cache_read_input_tokens: CTX - 2_000,
        cache_creation_input_tokens: 0,
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

const typed = (text: string, extra: { agentId?: string } = {}) => ({ text, origin: { kind: 'composer' as const }, ...extra })

const beat = async (_: Engine, id = 'sess-1') => shelf.get(`hb:${id}`) as Heartbeat | undefined

test('a composer prompt and a request write a heartbeat with ctx, lastActivity and lastOwnPrompt', async ($, on) => {
  const clock = engine(on)
  await start($)
  const fresh = await beat($)
  expect(fresh).toMatchObject({ id: 'sess-1', label: 'demo-project', ctx: 0, ttlMin: 60, lastActivity: 0, keepWarm: 'off' })

  await $.prompt.submit(typed('Fix the failing cache test in the keys module please'))
  await $.turn.start({ turnId: 't1' })
  expect((await beat($))?.working).toBe(true)
  await clock.advance(5_000)
  await request($)
  const mid = await beat($)
  expect(mid).toMatchObject({
    label: 'demo-project · Fix the failing cache test in',
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

  // only the first prompt names the session
  await $.prompt.submit(typed('another'))
  expect((await beat($))?.label).toBe('demo-project · Fix the failing cache test in')
})

test('a subagent prompt and step change nothing', async ($, on) => {
  engine(on)
  await start($)
  const before = await beat($)
  await $.prompt.submit(typed('inside a subagent', { agentId: 'a1' }))
  await request($, { agentId: 'a1' })
  await $.turn.start({ turnId: 't9', agentId: 'a1' })
  expect(await beat($)).toEqual(before)
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
  await $.session.compact({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] })
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
  await $.session.end({ sessionId: 'sess-1' })
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
