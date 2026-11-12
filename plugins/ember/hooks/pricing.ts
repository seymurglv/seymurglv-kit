// What a cache costs, in US dollars, from the Claude API price list
// (platform.claude.com/docs/en/about-claude/pricing, as the claude-api skill
// of Claude Code 2.1.309 quotes it on 2026-11-01). Dollars per million tokens.
// A cache write costs 1.25x input on the 5-minute TTL and 2x on the 1-hour one.

import type { ModelUsage } from 'claude-code'

export type Price = { id: string; input: number; output: number; read: number }

// Longer ids first: 'opus-5' must not take 'opus-5-5'.
const PRICES: readonly Price[] = [
  { id: 'fable-5-1', input: 10, output: 50, read: 0.25 },
  { id: 'mythos-5-1', input: 10, output: 50, read: 0.25 },
  { id: 'fable-5', input: 10, output: 50, read: 1 },
  { id: 'mythos-5', input: 10, output: 50, read: 1 },
  { id: 'opus-5-5', input: 4, output: 20, read: 0.2 },
  { id: 'opus-5', input: 5, output: 25, read: 0.5 },
  { id: 'opus-4-8', input: 5, output: 25, read: 0.5 },
  { id: 'opus-4-7', input: 5, output: 25, read: 0.5 },
  { id: 'opus-4-6', input: 5, output: 25, read: 0.5 },
  { id: 'sonnet-5-5', input: 2, output: 10, read: 0.2 },
  { id: 'sonnet-5', input: 2, output: 10, read: 0.2 },
  { id: 'sonnet-4-6', input: 3, output: 15, read: 0.3 },
  { id: 'haiku-5-5', input: 0.1, output: 0.5, read: 0.01 },
  { id: 'haiku-4-5', input: 1, output: 5, read: 0.1 },
]

// Haiku 5.5 bills a prompt over 100k tokens at its second card.
const HAIKU_55_LONG: Price = { id: 'haiku-5-5', input: 0.5, output: 2.5, read: 0.05 }

// A family name alone ('opus', an alias) goes to that family's current model.
const FAMILY_DEFAULT: Record<string, string> = {
  fable: 'fable-5-1',
  mythos: 'mythos-5-1',
  opus: 'opus-5-5',
  sonnet: 'sonnet-5-5',
  haiku: 'haiku-5-5',
}

function shortId(model: string): string {
  return model
    .toLowerCase()
    .replace(/^(anthropic\.|us\.anthropic\.)/, '')
    .replace(/^claude-/, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/-\d{8}$/, '')
    .trim()
}

export function priceOf(model: string, promptTokens = 0): Price {
  const id = shortId(model)
  let found = PRICES.find(p => id === p.id || id.startsWith(p.id + '-') || id.startsWith(p.id))
  if (found === undefined) {
    const family = Object.keys(FAMILY_DEFAULT).find(name => id.includes(name))
    const fallback = family === undefined ? 'opus-5-5' : FAMILY_DEFAULT[family]
    found = PRICES.find(p => p.id === fallback) ?? PRICES[0]!
  }
  if (found.id === 'haiku-5-5' && promptTokens > 100_000) return HAIKU_55_LONG
  return found
}

function writeRate(price: Price, ttlMin: number): number {
  return price.input * (ttlMin >= 60 ? 2 : 1.25)
}

/** Writing `tokens` of context into the cache again: what a cold send costs. */
export function coldRestartUsd(tokens: number, model: string, ttlMin: number): number {
  return (tokens * writeRate(priceOf(model, tokens), ttlMin)) / 1e6
}

/** A keep-warm ping: the context read from the cache plus a one-word reply. */
export function pingUsd(tokens: number, model: string): number {
  const price = priceOf(model, tokens)
  return (tokens * price.read + 40 * price.output) / 1e6
}

/** What one request cost, from the usage the API reported. */
export function requestUsd(usage: ModelUsage, model: string, ttlMin: number): number {
  const prompt = inputTokens(usage)
  const price = priceOf(model, prompt)
  return (
    ((usage.input_tokens ?? 0) * price.input +
      (usage.cache_read_input_tokens ?? 0) * price.read +
      (usage.cache_creation_input_tokens ?? 0) * writeRate(price, ttlMin) +
      (usage.output_tokens ?? 0) * price.output) /
    1e6
  )
}

/** Every input token of a request: uncached, written and read together. */
export function inputTokens(usage: ModelUsage): number {
  return (
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0)
  )
}
