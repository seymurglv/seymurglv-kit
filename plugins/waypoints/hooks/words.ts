// waypoints: the band's own words. Suggestions themselves come in the
// conversation's language; these follow the `language` option.

import type { WaypointsTally } from '../types'

export type Language = 'ru' | 'en'

export type Words = {
  /** Shown on a row under the pointer: what a pick does. */
  hint: string
  /** The key line under the rows, in the terminal (its box shows ghost text). */
  keys: string
  /** The key line on desktop, whose prompt box draws no ghost text. */
  keysDesktop: string
  /** The dismiss control's label, after its `0`. */
  hide: string
  /** A toast when the prompt box would not take the draft. */
  notFilled: string
  /** The /waypoints command's description. */
  command: string
  /** The /waypoints command's answer. */
  tally: (session: WaypointsTally, total: WaypointsTally) => string
}

function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function line(t: WaypointsTally, read: string, written: string, fresh: string, out: string): string {
  return `${tokens(t.cacheRead)} ${read} · ${tokens(t.cacheWrite)} ${written} · ${tokens(t.input)} ${fresh} · ${tokens(t.output)} ${out}`
}

const WORDS: Record<Language, Words> = {
  ru: {
    hint: 'в поле ввода',
    keys: '1–3 вставить · Tab первую',
    keysDesktop: '1–3 вставить',
    hide: 'скрыть',
    notFilled: 'waypoints: поле ввода не приняло подсказку',
    command: 'Сколько запросов сделал waypoints и сколько токенов они взяли',
    tally: (s, all) =>
      [
        `Этот чат: ${s.forks} запросов · ${line(s, 'из кэша', 'в кэш', 'новых', 'ответ')}`,
        `Всего: ${all.forks} запросов · ${line(all, 'из кэша', 'в кэш', 'новых', 'ответ')}`,
      ].join('\n'),
  },
  en: {
    hint: 'into the prompt box',
    keys: '1–3 insert · Tab takes the first',
    keysDesktop: '1–3 insert',
    hide: 'hide',
    notFilled: 'waypoints: the prompt box did not take the suggestion',
    command: 'How many requests waypoints made and the tokens they took',
    tally: (s, all) =>
      [
        `This session: ${s.forks} requests · ${line(s, 'from cache', 'to cache', 'new', 'out')}`,
        `All sessions: ${all.forks} requests · ${line(all, 'from cache', 'to cache', 'new', 'out')}`,
      ].join('\n'),
  },
}

export function wordsFor(language: unknown): Words {
  return language === 'ru' ? WORDS.ru : WORDS.en
}
