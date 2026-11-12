// What the band says and offers, as plain data the drawing turns into elements
// on each surface. One accent at a time: green while warm or kept, amber in the
// last minutes and for a problem (with "!"), none when cold. One main button.

import type { EmberHandoff, EmberLive } from '../types'
import { coldRestartUsd, pingUsd } from './pricing'
import type { RingTone } from './ring'
import {
  clock,
  liveWarmth,
  minutesLeft,
  pings,
  ringAlt,
  ringShare,
  span,
  tokens,
  usd,
} from './warmth'
import { words } from './words'

export type BandAction = 'keep' | 'release' | 'handoff' | 'continue' | 'drop'

export type BandButton = { action: BandAction; label: string; isMain: boolean }

export type BandModel = {
  tone: RingTone
  /** Share of the ring drawn, 0 to 1. */
  share: number
  /** The ring's digits; -1 leaves it empty. */
  minutes: number
  /** The ring in words: its alt, and what the terminal draws in its place. */
  ringWords: string
  alt: string
  /** The first line's lead, in the accent; the rest follows plain. */
  lead: string
  rest: string
  detail: string
  buttons: BandButton[]
  /** A quiet word where a button would be: the handoff being written. */
  note: string
}

export function bandModel(live: EmberLive, handoff: EmberHandoff, now: number): BandModel | null {
  const w = liveWarmth(live, now)
  if (w.kind === 'unknown' && handoff.phase === 'none') return null

  const W = words()
  const HANDOFF: BandButton = { action: 'handoff', label: W.handoff, isMain: false }
  const inCache = W.inCache(tokens(live.ctx))
  const cold = coldRestartUsd(live.ctx, live.model, live.ttlMin)
  const model: BandModel = {
    tone: 'idle',
    share: ringShare(w, live.ttlMin),
    minutes: w.kind === 'cold' || w.kind === 'unknown' ? -1 : minutesLeft(w),
    ringWords: '',
    alt: ringAlt(w),
    lead: '',
    rest: '',
    detail: '',
    buttons: [],
    note: '',
  }

  switch (w.kind) {
    case 'kept': {
      const keep = live.keep
      model.tone = 'ok'
      model.lead = W.warm
      model.rest = keep === null ? '' : W.keptUntil(clock(keep.until))
      model.detail =
        keep === null || keep.pings === 0
          ? `${inCache} · ${W.noPingsYet}`
          : `${inCache} · ${pings(keep.pings)}, ${usd(keep.usd)}`
      model.buttons = [
        { action: 'release', label: W.release, isMain: false },
        { ...HANDOFF, isMain: true },
      ]
      break
    }
    case 'warm':
      model.tone = 'ok'
      model.lead = W.warm
      model.rest = W.coolsAt(clock(now + w.leftMs))
      model.detail = live.costUsd > 0 ? `${inCache} · ${W.chatCost(usd(live.costUsd))}` : inCache
      model.buttons = [{ action: 'keep', label: W.keepWarm, isMain: false }, HANDOFF]
      break
    case 'cooling':
      model.tone = 'warn'
      model.lead = W.coolsIn(model.minutes)
      model.detail = W.coldRestart(usd(cold), usd(pingUsd(live.ctx, live.model)))
      model.buttons = [{ action: 'keep', label: W.keepWarm, isMain: true }, HANDOFF]
      break
    case 'cold':
      model.lead = W.cacheCold
      model.rest = W.ago(span(w.agoMs))
      model.detail = W.nextRewrites(tokens(live.ctx), usd(cold))
      model.buttons = [{ ...HANDOFF, isMain: true }]
      break
    case 'unknown':
      model.lead = W.cacheNotCreated
      break
  }
  model.ringWords = w.kind === 'cold' ? W.coldShort : w.kind === 'unknown' ? '—' : `${model.minutes} ${W.min}`

  if (live.problem !== '') {
    model.tone = 'warn'
    model.lead = `! ${live.problem}`
    model.rest = ''
  }

  if (handoff.phase === 'asked' || handoff.phase === 'writing') {
    model.buttons = model.buttons.filter(b => b.action !== 'handoff')
    model.note = handoff.phase === 'asked' ? W.handoffQueued : W.writingHandoff
  } else if (handoff.phase === 'ready') {
    const quiet = model.buttons
      .filter(b => b.action === 'keep' || b.action === 'release')
      .map(b => ({ ...b, isMain: false }))
    model.buttons = [
      ...quiet,
      { action: 'drop', label: W.keepChat, isMain: false },
      { action: 'continue', label: W.clearAndContinue, isMain: true },
    ]
    model.detail = W.handoffReady
  } else if (handoff.phase === 'clearing') {
    model.buttons = []
    model.note = W.clearing
  }

  return model
}
