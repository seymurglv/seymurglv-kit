// How warm a cache is, and the words the band and the board say it in
// (`words.ts`, English unless the `language` option is `ru`).
// Pure functions: no $ here, so the tests read them directly.

import type { EmberChat, EmberLive } from '../types'
import { words } from './words'

const MIN = 60_000

export type Warmth =
  | { kind: 'unknown' }
  | { kind: 'kept'; leftMs: number }
  | { kind: 'warm'; leftMs: number }
  | { kind: 'cooling'; leftMs: number }
  | { kind: 'cold'; agoMs: number }

/** Minutes before cold at which the band turns amber: 10, or 2 on a 5-minute TTL. */
export function coolingMs(ttlMin: number): number {
  return (ttlMin >= 60 ? 10 : 2) * MIN
}

export function warmthOf(
  chat: Pick<EmberChat, 'lastActivity' | 'ttlMin'> & { isKept: boolean },
  now: number,
): Warmth {
  if (chat.lastActivity <= 0) return { kind: 'unknown' }
  const leftMs = chat.ttlMin * MIN - (now - chat.lastActivity)
  if (leftMs <= 0) return { kind: 'cold', agoMs: -leftMs }
  if (chat.isKept) return { kind: 'kept', leftMs }
  if (leftMs <= coolingMs(chat.ttlMin)) return { kind: 'cooling', leftMs }
  return { kind: 'warm', leftMs }
}

export function liveWarmth(live: EmberLive, now: number): Warmth {
  return warmthOf({ ...live, isKept: live.keep !== null }, now)
}

/** Share of the TTL left, 0 to 1: how much of the ring is drawn. */
export function ringShare(w: Warmth, ttlMin: number): number {
  if (w.kind === 'unknown' || w.kind === 'cold') return 0
  return Math.max(0, Math.min(1, w.leftMs / (ttlMin * MIN)))
}

/** Whole minutes left, as the ring's digits show them: 1 in the last minute. */
export function minutesLeft(w: Warmth): number {
  if (w.kind === 'unknown' || w.kind === 'cold') return 0
  return Math.max(1, Math.floor(w.leftMs / MIN))
}

/** Russian plural: 1 минута, 2 минуты, 5 минут, 21 минута. */
export function plural(n: number, one: string, few: string, many: string): string {
  const tens = Math.abs(n) % 100
  const last = tens % 10
  if (tens > 10 && tens < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

export function tokens(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return String(Math.round(n))
}

export function usd(n: number): string {
  if (n <= 0) return '$0'
  if (n < 0.01) return '<$0.01'
  if (n < 100) return '$' + n.toFixed(2)
  return '$' + n.toFixed(0)
}

function two(n: number): string {
  return String(n).padStart(2, '0')
}

/** A local wall-clock time, 24-hour: 23:40. */
export function clock(ms: number): string {
  const d = new Date(ms)
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}

/** The local date, as a store key reads it: 2026-11-01. */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/** Minutes and seconds left: 41:12, or 1:02:03 past an hour. */
export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`
}

/** A span in words: 6 min, 2 h, 2 h 15 min. */
export function span(ms: number): string {
  const w = words()
  const m = Math.max(0, Math.round(ms / MIN))
  if (m < 60) return `${m} ${w.min}`
  const h = Math.floor(m / 60)
  return m % 60 === 0 ? `${h} ${w.hour}` : `${h} ${w.hour} ${m % 60} ${w.min}`
}

/** What the ring says to a reader that cannot see it, and the terminal's ring. */
export function ringAlt(w: Warmth): string {
  if (w.kind === 'unknown') return words().notCreated
  if (w.kind === 'cold') return words().cold
  return words().minutesToCold(minutesLeft(w))
}

export function pings(n: number): string {
  return words().pings(n)
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/** What fills the context, 0 to 100, or undefined without a window. */
export function percent(ctx: number, window: number): number | undefined {
  return window > 0 ? Math.round((100 * ctx) / window) : undefined
}

/** Board order: the warmest first, then the cold ones, the latest of them first. */
export function boardOrder(chats: readonly EmberChat[], now: number): EmberChat[] {
  const left = (c: EmberChat) => c.ttlMin * MIN - (now - c.lastActivity)
  return [...chats].sort((a, b) => {
    const la = a.lastActivity > 0 ? left(a) : -Infinity
    const lb = b.lastActivity > 0 ? left(b) : -Infinity
    const coldA = la <= 0
    const coldB = lb <= 0
    if (coldA !== coldB) return coldA ? 1 : -1
    if (!coldA) return lb - la
    return b.lastActivity - a.lastActivity
  })
}
