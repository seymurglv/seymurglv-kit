// cache-lamp: the pure decisions about a session's prompt cache.
// No `$`, so the tests can call them directly.

import type { ModelUsage } from 'claude-code'

import type { Heartbeat, LampState, Options } from '../types'

export const MIN = 60_000
export const PING_AT_MS = 6 * MIN
export const STALE_MS = MIN
export const DROP_MS = 60 * MIN

/** On the 5-min TTL a 5-min window would keep the lamp lit all the time. */
export const warnMs = (ttlMin: 5 | 60): number => (ttlMin === 60 ? 5 * MIN : MIN)

const leftMs = (hb: Heartbeat, now: number): number => hb.ttlMin * MIN - (now - hb.lastActivity)

export function willKeepWarm(hb: Heartbeat, now: number, o: Options): boolean {
  return (
    hb.ctx >= o.bigTokens &&
    hb.ttlMin === 60 &&
    hb.keepWarm === 'on' &&
    hb.lastOwnPrompt > 0 &&
    now - hb.lastOwnPrompt < o.keepWarmHours * 60 * MIN
  )
}

export function lampState(hb: Heartbeat, now: number, o: Options): LampState {
  if (hb.lastActivity === 0) return { kind: 'unknown' }
  const left = leftMs(hb, now)
  if (left <= 0) return { kind: 'cold', sinceMs: -left }
  if (willKeepWarm(hb, now, o)) return { kind: 'kept', untilMs: hb.lastOwnPrompt + o.keepWarmHours * 60 * MIN }
  if (left <= warnMs(hb.ttlMin) && hb.ctx >= o.bigTokens) return { kind: 'cooling', leftMs: left }
  return { kind: 'warm', leftMs: left }
}

export function shouldPing(hb: Heartbeat, now: number, o: Options): boolean {
  if (!willKeepWarm(hb, now, o) || hb.working || hb.lastActivity <= 0) return false
  const left = leftMs(hb, now)
  return left > 0 && left <= PING_AT_MS
}

export function pingVerdict(u: ModelUsage): 'read' | 'rebuilt' {
  const read = u.cache_read_input_tokens ?? 0
  const created = u.cache_creation_input_tokens ?? 0
  return created > 0.1 * Math.max(1, read) ? 'rebuilt' : 'read'
}

export function nextTtl(current: 5 | 60, gapMs: number, u: ModelUsage): 5 | 60 {
  const read = u.cache_read_input_tokens ?? 0
  const written = u.cache_creation_input_tokens ?? 0
  const total = (u.input_tokens ?? 0) + read + written
  if (total <= 30_000) return current
  if (written / total > 0.5 && gapMs > 5.5 * MIN && gapMs < current * MIN) return 5
  if (gapMs > 5.5 * MIN && read / total > 0.8) return 60
  return current
}

export const live = (hb: Heartbeat, now: number): boolean => now - hb.updatedAt <= STALE_MS

export function boardOthers(fleet: Heartbeat[], selfId: string, now: number, o: Options): Heartbeat[] {
  return fleet.filter((hb) => {
    if (hb.id === selfId || !live(hb, now)) return false
    const k = lampState(hb, now, o).kind
    return k === 'cooling' || k === 'kept'
  })
}

export function warnTargetId(fleet: Heartbeat[], now: number): string | undefined {
  let best: Heartbeat | undefined
  for (const hb of fleet) {
    if (!live(hb, now) || hb.lastOwnPrompt <= 0) continue
    if (!best || hb.lastOwnPrompt > best.lastOwnPrompt) best = hb
  }
  return best?.id
}

export function toWarn(fleet: Heartbeat[], now: number, o: Options): Heartbeat[] {
  return fleet.filter((hb) => live(hb, now) && lampState(hb, now, o).kind === 'cooling')
}

/** A heartbeat's folder: an older version put the first prompt after ` · `. */
const folder = (label: string): string => label.split(' · ')[0] ?? label

/**
 * The name each session goes by: its folder, numbered when several share one (in id order).
 * Pass only the sessions on show, so a closed one never takes a number.
 */
export function labels(fleet: Heartbeat[]): Map<string, string> {
  const names = new Map<string, string>()
  const seen = new Map<string, number>()
  for (const hb of [...fleet].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const base = folder(hb.label)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    names.set(hb.id, n === 1 ? base : `${base} ${n}`)
  }
  return names
}

/** This session and the live neighbours that have a cache state: the set names are numbered within. */
export const onShow = (fleet: Heartbeat[], me: Heartbeat, now: number): Heartbeat[] => [
  me,
  ...fleet.filter(hb => hb.id !== me.id && live(hb, now) && hb.lastActivity !== 0),
]
