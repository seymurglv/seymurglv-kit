import { expect, test } from 'claude-code/testing'

import type { Heartbeat } from '../types'
import { MIN, boardOthers, lampState, nextTtl, pingVerdict, shouldPing, toWarn, warnTargetId, labels } from '../hooks/state'

const o = { bigTokens: 100_000, keepWarmHours: 3 }
const now = 10_000_000_000

const hb = (over: Partial<Heartbeat>): Heartbeat => ({
  id: 'a',
  label: 'a',
  ctx: 180_000,
  ttlMin: 60,
  lastActivity: 0,
  lastOwnPrompt: 0,
  working: false,
  keepWarm: 'on',
  updatedAt: now,
  ...over,
})

test('lampState is unknown before any request', () => {
  expect(lampState(hb({}), now, o)).toEqual({ kind: 'unknown' })
})

test('big session idle 50 min with an own prompt 1 h ago is kept', () => {
  const lastOwnPrompt = now - 60 * MIN
  const s = lampState(hb({ lastActivity: now - 50 * MIN, lastOwnPrompt }), now, o)
  expect(s).toEqual({ kind: 'kept', untilMs: lastOwnPrompt + 3 * 60 * MIN })
})

test('big session 56 min idle, own prompt 4 h ago, is cooling with 4 min left', () => {
  const s = lampState(hb({ lastActivity: now - 56 * MIN, lastOwnPrompt: now - 240 * MIN }), now, o)
  expect(s).toEqual({ kind: 'cooling', leftMs: 4 * MIN })
})

test('small session 56 min idle stays warm, never cooling', () => {
  const s = lampState(hb({ ctx: 50_000, lastActivity: now - 56 * MIN }), now, o)
  expect(s.kind).toBe('warm')
})

test('session on the 5-min TTL is never kept', () => {
  const base = { ttlMin: 5 as const, lastOwnPrompt: now - MIN }
  expect(lampState(hb({ ...base, lastActivity: now - 2 * MIN }), now, o).kind).toBe('warm')
  expect(lampState(hb({ ...base, lastActivity: now - 4 * MIN }), now, o)).toEqual({ kind: 'cooling', leftMs: MIN })
})

test('61 min idle is cold', () => {
  expect(lampState(hb({ lastActivity: now - 61 * MIN }), now, o)).toEqual({ kind: 'cold', sinceMs: MIN })
})

test('shouldPing fires at 6 min left, not at 7, not while working, not when stopped', () => {
  const base = { lastOwnPrompt: now - 10 * MIN }
  expect(shouldPing(hb({ ...base, lastActivity: now - 54 * MIN }), now, o)).toBe(true)
  expect(shouldPing(hb({ ...base, lastActivity: now - 53 * MIN }), now, o)).toBe(false)
  expect(shouldPing(hb({ ...base, lastActivity: now - 54 * MIN, working: true }), now, o)).toBe(false)
  expect(shouldPing(hb({ ...base, lastActivity: now - 54 * MIN, keepWarm: 'stopped' }), now, o)).toBe(false)
})

test('pingVerdict tells a read from a rebuild', () => {
  const u = { input_tokens: 5, output_tokens: 1 }
  expect(pingVerdict({ ...u, cache_read_input_tokens: 180_000, cache_creation_input_tokens: 300 })).toBe('read')
  expect(pingVerdict({ ...u, cache_read_input_tokens: 0, cache_creation_input_tokens: 180_000 })).toBe('rebuilt')
})

test('nextTtl follows cache-keeper', () => {
  const u = (read: number, written: number) => ({
    input_tokens: 10,
    output_tokens: 1,
    cache_read_input_tokens: read,
    cache_creation_input_tokens: written,
  })
  expect(nextTtl(60, 20 * MIN, u(0, 100_000))).toBe(5)
  expect(nextTtl(5, 20 * MIN, u(100_000, 100))).toBe(60)
  expect(nextTtl(60, 20 * MIN, u(0, 1_000))).toBe(60)
  expect(nextTtl(5, 20 * MIN, u(0, 1_000))).toBe(5)
})

test('boardOthers drops self, stale, warm and cold; keeps cooling and kept', () => {
  const own = now - 10 * MIN
  const fleet = [
    hb({ id: 'self', lastActivity: now - 56 * MIN, lastOwnPrompt: now - 240 * MIN }),
    hb({ id: 'stale', lastActivity: now - 56 * MIN, lastOwnPrompt: now - 240 * MIN, updatedAt: now - 4 * MIN }),
    hb({ id: 'warm', lastActivity: now - 5 * MIN }),
    hb({ id: 'cold', lastActivity: now - 70 * MIN }),
    hb({ id: 'cooling', lastActivity: now - 56 * MIN, lastOwnPrompt: now - 240 * MIN }),
    hb({ id: 'kept', lastActivity: now - 30 * MIN, lastOwnPrompt: own }),
  ]
  expect(boardOthers(fleet, 'self', now, o).map((h) => h.id)).toEqual(['cooling', 'kept'])
})

test('warnTargetId picks the latest own prompt among live sessions, skipping a stale one', () => {
  const fleet = [
    hb({ id: 'old', lastOwnPrompt: now - 30 * MIN }),
    hb({ id: 'newer', lastOwnPrompt: now - 10 * MIN }),
    hb({ id: 'stale', lastOwnPrompt: now - MIN, updatedAt: now - 4 * MIN }),
    hb({ id: 'none' }),
  ]
  expect(warnTargetId(fleet, now)).toBe('newer')
  expect(warnTargetId([hb({})], now)).toBeUndefined()
})

test('toWarn lists live cooling sessions', () => {
  const fleet = [
    hb({ id: 'c', lastActivity: now - 56 * MIN }),
    hb({ id: 'w', lastActivity: now - 5 * MIN }),
  ]
  expect(toWarn(fleet, now, o).map((h) => h.id)).toEqual(['c'])
})

test('labels number sessions that share a folder, in id order', () => {
  const fleet = [hb({ id: 'b', label: 'sglv' }), hb({ id: 'x', label: 'unbluffed' }), hb({ id: 'a', label: 'sglv' })]
  const names = labels(fleet)
  expect(names.get('a')).toBe('sglv')
  expect(names.get('b')).toBe('sglv 2')
  expect(names.get('x')).toBe('unbluffed')
})

test('a neighbour silent for over a minute leaves the board', () => {
  const now = 10_000_000
  const cooling = { ctx: 180_000, lastActivity: now - 56 * MIN, lastOwnPrompt: now - 240 * MIN }
  const fleet = [hb({ id: 'me' }), hb({ id: 'live', ...cooling, updatedAt: now - 59_000 }), hb({ id: 'gone', ...cooling, updatedAt: now - 61_000 })]
  expect(boardOthers(fleet, 'me', now, o).map(h => h.id)).toEqual(['live'])
})
