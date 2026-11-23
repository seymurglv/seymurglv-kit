// cache-lamp: the plugin's own words in ru and en, following the `language` option.

import type { LampState } from '../types'

import { MIN } from './state'

export type Language = 'ru' | 'en'

export type Words = {
  /** One lamp line for a session's state; '' for unknown. */
  line: (s: LampState, ctx: number) => string
  /** The lamp's own short text over the prompt box; '' for unknown. */
  short: (s: LampState, ctx: number) => string
  /** The suffix on the lamp line after a ping turned keep-warm off. */
  stopped: (reason: 'rebuilt' | 'noAnswer') => string
  /** The toast when a session is about to cool. */
  toast: (label: string, isSelf: boolean, leftMs: number, ctx: number) => string
  /** The /cache-lamp command's description. */
  command: string
  /** One line per row, in the order the caller gave. */
  list: (rows: { label: string; s: LampState; ctx: number; isSelf: boolean }[]) => string
  /** /cache-lamp with no live session. */
  none: string
}

export function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const pad = (n: number): string => String(n).padStart(2, '0')

export function clock(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Copy = {
  warm: (m: number, tok: string) => string
  kept: (hhmm: string, tok: string) => string
  cooling: (m: number, tok: string) => string
  cold: (tok: string) => string
  short: {
    warm: (m: number, tok: string) => string
    kept: (hhmm: string, tok: string) => string
    cooling: (m: number, tok: string) => string
    cold: (tok: string) => string
  }
  self: string
  stopped: Record<'rebuilt' | 'noAnswer', string>
  toast: (label: string, tok: string, m: number) => string
  toastSelf: (tok: string, m: number) => string
  command: string
  none: string
}

const COPY: Record<Language, Copy> = {
  ru: {
    warm: (m, tok) => `кэш тёплый · ${m} мин · ${tok}`,
    kept: (hhmm, tok) => `держу тёплым до ${hhmm} · ${tok}`,
    cooling: (m, tok) => `кэш остынет через ${m} мин · ${tok}`,
    cold: (tok) => `кэш остыл · следующее сообщение перечитает ${tok}`,
    short: {
      warm: (m, tok) => `${m} мин · ${tok}`,
      kept: (hhmm, tok) => `держу до ${hhmm} · ${tok}`,
      cooling: (m, tok) => `остынет через ${m} мин · ${tok}`,
      cold: (tok) => `остыл · ${tok}`,
    },
    self: 'этот чат',
    stopped: {
      rebuilt: 'подогрев выключен: пинг пересобрал кэш',
      noAnswer: 'подогрев выключен: пинг не получил ответа',
    },
    toast: (label, tok, m) => `${label}: кэш ${tok} остынет через ${m} мин`,
    toastSelf: (tok, m) => `этот чат: кэш ${tok} остынет через ${m} мин`,
    command: 'Кэш всех открытых сессий',
    none: 'cache-lamp: открытых сессий нет',
  },
  en: {
    warm: (m, tok) => `cache warm · ${m} min · ${tok}`,
    kept: (hhmm, tok) => `keeping warm until ${hhmm} · ${tok}`,
    cooling: (m, tok) => `cache cools in ${m} min · ${tok}`,
    cold: (tok) => `cache cold · the next message re-reads ${tok}`,
    short: {
      warm: (m, tok) => `${m} min · ${tok}`,
      kept: (hhmm, tok) => `kept until ${hhmm} · ${tok}`,
      cooling: (m, tok) => `cools in ${m} min · ${tok}`,
      cold: (tok) => `cold · ${tok}`,
    },
    self: 'this chat',
    stopped: {
      rebuilt: 'keep-warm off: the ping rebuilt the cache',
      noAnswer: 'keep-warm off: the ping got no answer',
    },
    toast: (label, tok, m) => `${label}: ${tok} cache cools in ${m} min`,
    toastSelf: (tok, m) => `this chat: ${tok} cache cools in ${m} min`,
    command: 'Cache of every open session',
    none: 'cache-lamp: no open sessions',
  },
}

type StateCopy = Pick<Copy, 'warm' | 'kept' | 'cooling' | 'cold'>

const say = (c: StateCopy) => (s: LampState, ctx: number): string => {
  const tok = tokens(ctx)
  switch (s.kind) {
    case 'unknown':
      return ''
    case 'warm':
      return c.warm(Math.ceil(s.leftMs / MIN), tok)
    case 'kept':
      return c.kept(clock(s.untilMs), tok)
    case 'cooling':
      return c.cooling(Math.ceil(s.leftMs / MIN), tok)
    case 'cold':
      return c.cold(tok)
  }
}

function build(c: Copy): Words {
  const line = say(c)
  const other = (label: string, s: LampState, ctx: number): string => `${label}: ${line(s, ctx)}`
  return {
    line,
    short: say(c.short),
    stopped: (reason) => c.stopped[reason],
    toast: (label, isSelf, leftMs, ctx) =>
      isSelf
        ? c.toastSelf(tokens(ctx), Math.ceil(leftMs / MIN))
        : c.toast(label, tokens(ctx), Math.ceil(leftMs / MIN)),
    command: c.command,
    list: (rows) => rows.map((r) => other(r.isSelf ? c.self : r.label, r.s, r.ctx)).join('\n'),
    none: c.none,
  }
}

const WORDS: Record<Language, Words> = {
  ru: build(COPY.ru),
  en: build(COPY.en),
}

export function wordsFor(language: unknown): Words {
  return language === 'ru' ? WORDS.ru : WORDS.en
}
