// What one main-loop request says about the cache: did it read the cache or
// write it again, and so which TTL the session runs on. Pure: no $ here.

import type { ModelUsage } from 'claude-code'

import type { EmberLive } from '../types'
import { coldRestartUsd, inputTokens } from './pricing'

const MIN = 60_000

// A cache lives at least five minutes, so a write after a shorter gap is the
// context growing, not a cold restart. Requests this small are left out.
const SHORTEST_COLD_GAP = 4.5 * MIN
const LONGER_THAN_5_MIN = 5.5 * MIN
const SMALLEST_MEASURED = 20_000

export function afterRequest(
  live: EmberLive,
  usage: ModelUsage & { model?: string },
  startedAt: number,
  endedAt: number,
  isAfterCompact: boolean,
): EmberLive {
  const total = inputTokens(usage)
  const written = usage.cache_creation_input_tokens ?? 0
  const read = usage.cache_read_input_tokens ?? 0
  const gap = live.lastActivity > 0 ? startedAt - live.lastActivity : 0
  const model = usage.model || live.model
  const canMeasure = live.lastActivity > 0 && total >= SMALLEST_MEASURED && !isAfterCompact
  const isTtlFree = live.ttlSource !== 'setting'
  let { ttlMin, ttlSource, coldRestarts, coldUsd } = live

  if (canMeasure && gap > SHORTEST_COLD_GAP && written / total > 0.5) {
    // Written again after 5 to 60 idle minutes: the 5-minute TTL.
    if (isTtlFree && gap > LONGER_THAN_5_MIN && gap < 60 * MIN) {
      ttlMin = 5
      ttlSource = 'measured'
    }
    coldRestarts += 1
    coldUsd += coldRestartUsd(written, model, ttlMin)
  } else if (canMeasure && isTtlFree && gap > LONGER_THAN_5_MIN && read / total > 0.8) {
    // Read after more than five idle minutes: the 1-hour TTL.
    ttlMin = 60
    ttlSource = 'measured'
  }

  return {
    ...live,
    model,
    ttlMin,
    ttlSource,
    coldRestarts,
    coldUsd,
    ctx: total,
    lastActivity: endedAt,
    problem: '',
  }
}
