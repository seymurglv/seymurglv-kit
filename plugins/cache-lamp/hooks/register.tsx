// cache-lamp: keeps this session's heartbeat (its cache's age, size and TTL)
// current, and shares it with the other sessions through the plugin store.
// The lamp itself, the keep-warm ping and the warning build on these values.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Heartbeat, Options } from '../types'
import { DROP_MS, lampState, nextTtl, pingVerdict, shouldPing, toWarn, warnTargetId } from './state'
import { wordsFor } from './words'
import type { Words } from './words'

export const TICK_MS = 30_000
const LABEL_CHARS = 30

const NEW: Heartbeat = {
  id: '',
  label: '',
  ctx: 0,
  ttlMin: 60,
  lastActivity: 0,
  lastOwnPrompt: 0,
  working: false,
  keepWarm: 'off',
  updatedAt: 0,
}

// Bump the tag when the heartbeat's fields change.
const self = atom({ plugin: 'cache-lamp', key: 'self' } as const, NEW, { shape: 'self-1' })

// Keys `${id}:${lastActivity}` of the cooling warnings already shown.
const warned = atom({ plugin: 'cache-lamp', key: 'warned' } as const, [] as string[], { shape: 'warned-1' })
const KEEP_WARNED = 50
const TOAST_MS = 15_000
const PING_PROMPT = 'cache-lamp keep-alive. Reply with only: ok'

const key = (id: string): string => `hb:${id}`

const basename = (path: string): string => path.split(/[\\/]/).filter(part => part !== '').pop() ?? path

// Applies `change` to this session's heartbeat, shares it, redraws.
async function change($: EngineInterface, fn: (hb: Heartbeat, now: number) => Heartbeat): Promise<void> {
  const now = await $.clock.now()
  let next = NEW
  await update($, self, hb => {
    next = { ...fn(hb, now), updatedAt: now }
    return next
  })
  if (next.id !== '') await $.store.set(key(next.id), next)
  $.ui.invalidate('ui.render')
}

const isHeartbeat = (v: unknown): v is Heartbeat =>
  typeof v === 'object' && v !== null && typeof (v as Heartbeat).id === 'string' && typeof (v as Heartbeat).updatedAt === 'number'

/** Every session's heartbeat, this one included; one silent for DROP_MS is deleted. */
export async function readFleet($: EngineInterface, now: number): Promise<Heartbeat[]> {
  const fleet: Heartbeat[] = []
  for (const k of await $.store.keys()) {
    if (!k.startsWith('hb:')) continue
    const hb = await $.store.get(k)
    if (!isHeartbeat(hb)) continue
    if (now - hb.updatedAt > DROP_MS) await $.store.delete(k)
    else fleet.push(hb)
  }
  return fleet
}

// One fork ping, when this cache is about to go cold: a rebuilt or missing
// answer stops keep-warm, and there is no retry within the tick.
async function ping($: EngineInterface, o: Options): Promise<void> {
  const hb = await read($, self)
  if (!shouldPing(hb, await $.clock.now(), o)) return
  let stop: 'rebuilt' | 'noAnswer' | undefined
  try {
    const reply = await $.model.fork({ prompt: PING_PROMPT })
    if (!reply.isAnswered) stop = 'noAnswer'
    else if ('usage' in reply && reply.usage !== undefined && pingVerdict(reply.usage) === 'rebuilt') stop = 'rebuilt'
  } catch {
    stop = 'noAnswer'
  }
  if (stop === undefined) await change($, (h, now) => ({ ...h, lastActivity: now }))
  else await change($, h => ({ ...h, keepWarm: 'stopped', stopReason: stop }))
}

// Only the session with the latest own prompt speaks, once per cache state.
async function warn($: EngineInterface, o: Options, words: Words, fleet: Heartbeat[]): Promise<void> {
  const now = await $.clock.now()
  const me = await read($, self)
  if (me.id === '' || warnTargetId(fleet, now) !== me.id) return
  const shown = new Set(await read($, warned))
  const fresh: string[] = []
  for (const hb of toWarn(fleet, now, o)) {
    if (hb.working) continue
    const k = `${hb.id}:${hb.lastActivity}`
    if (shown.has(k)) continue
    const s = lampState(hb, now, o)
    if (s.kind !== 'cooling') continue
    await $.ui.toast(words.toast(hb.label, hb.id === me.id, s.leftMs, hb.ctx), { timeoutMs: TOAST_MS })
    fresh.push(k)
  }
  if (fresh.length > 0) await update($, warned, list => [...list, ...fresh].slice(-KEEP_WARNED))
}

// Runs every TICK_MS: keeps this heartbeat fresh for the other sessions,
// pings a big cache that is about to cool, and warns once before one goes cold.
let ticking = false
async function tick($: EngineInterface, o: Options, words: Words): Promise<void> {
  if (ticking) return
  ticking = true
  try {
    const hb = await read($, self)
    if (hb.id === '') return
    await change($, h => h)
    await ping($, o)
    await warn($, o, words, await readFleet($, await $.clock.now()))
    $.ui.invalidate('ui.render')
  } finally {
    ticking = false
  }
}

const fromPerson = (origin: { kind: string } | undefined): boolean => origin?.kind === 'composer' || origin?.kind === 'bridge'

export const register: Register = (on, options) => {
  const words = wordsFor(options?.language)
  const opts: Options = {
    bigTokens: typeof options?.bigTokens === 'number' ? options.bigTokens : 100_000,
    keepWarmHours: typeof options?.keepWarmHours === 'number' ? options.keepWarmHours : 3,
  }

  on('session.start', async ($, e, next) => {
    const id = await $.session.id()
    const label = basename(await $.session.cwd())
    await $.command.register({ name: 'cache-lamp', description: words.command })
    await change($, (_, now) => ({ ...NEW, id, label, updatedAt: now }))
    $.clock.every(TICK_MS, () => {
      tick($, opts, words).catch(() => undefined)
    })
    return next(e)
  })

  // /clear, /resume and /branch go on under a new session id with an
  // unknown cache, and raise no session.start.
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') {
      const before = await read($, self)
      if (before.id !== '' && before.id !== e.session_id) await $.store.delete(key(before.id))
      const label = basename(await $.session.cwd())
      await change($, hb => ({ ...hb, id: e.session_id, label, lastActivity: 0, lastOwnPrompt: 0, working: false }))
    }
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    await change($, hb => ({ ...hb, lastActivity: 0, lastOwnPrompt: 0 }))
    return result
  })

  on('session.end', async ($, e, next) => {
    const hb = await read($, self)
    if (hb.id !== '') await $.store.delete(key(hb.id))
    // No id, so the timer's next tick writes nothing.
    await update($, self, () => NEW)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.agentId === undefined && fromPerson(e.origin)) {
      const base = basename(await $.session.cwd())
      const named = e.text.trim().slice(0, LABEL_CHARS).trim()
      await change($, (hb, now) => ({
        ...hb,
        lastOwnPrompt: now,
        keepWarm: 'on',
        stopReason: undefined,
        label: hb.label === base && named !== '' ? `${base} · ${named}` : hb.label,
      }))
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await change($, hb => ({ ...hb, working: true }))
    return next(e)
  })

  // Each main-loop request: how much it read, and what it says of the TTL.
  on('turn.step', async function* ($, e, next) {
    const startedAt = await $.clock.now()
    const result = yield* next(e)
    if (e.agentId !== undefined || !result?.usage) return result
    const u = result.usage
    const total = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
    await change($, (hb, now) => ({
      ...hb,
      ttlMin: nextTtl(hb.ttlMin, hb.lastActivity === 0 ? 0 : startedAt - hb.lastActivity, u),
      ctx: total,
      lastActivity: now,
    }))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const usage = await $.session.usage().catch(() => undefined)
    const tokens = usage?.context?.tokens
    await change($, hb => ({ ...hb, working: false, ctx: tokens ? tokens : hb.ctx }))
    return result
  })
}
