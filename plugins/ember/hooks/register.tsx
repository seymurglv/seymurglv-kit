// ember: how warm this chat's prompt cache is, one quiet row above the prompt.
//
// Each request re-reads the whole context. Read from the cache it costs a
// tenth of input or less; once the cache has gone cold (an hour idle on a
// subscription, five minutes on the API's default TTL) the next message writes
// it all again at 1.25x to 2x input. A read restarts the TTL, so a one-word
// ping before it ends costs a small part of that rewrite. ember shows the
// minutes left, pings only when asked (on its own only for chats over 300k
// tokens), lists every local chat on a board (/board) and hands a chat off to
// a fresh one (/ember:handoff, or the band's Handoff button).

import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { EmberBoard, EmberChat, EmberHandoff, EmberKeep, EmberLive } from '../types'
import { afterRequest } from './measure'
import { requestUsd } from './pricing'
import { RING_PX, ringSvg } from './ring'
import { bandModel, type BandAction, type BandModel } from './say'
import {
  basename,
  boardOrder,
  dayKey,
  liveWarmth,
  mmss,
  percent,
  pings,
  usd,
  warmthOf,
} from './warmth'
import { setLanguage, words } from './words'

type $ = EngineInterface

const MIN = 60_000
const PANE = 'ember-board'
const HANDOFF_SKILL = 'ember:handoff'
const PING = 'ember keep-warm ping. Reply with the one word: ok'
// A heartbeat older than this is a session that ended without saying so.
const SILENT_MS = 2 * MIN
const FORGET_MS = 10 * MIN

const EMPTY_LIVE: EmberLive = {
  sessionId: '',
  cwd: '',
  name: '',
  model: '',
  lastActivity: 0,
  ctx: 0,
  window: 0,
  ttlMin: 60,
  ttlSource: 'default',
  isWorking: false,
  keep: null,
  releasedAt: 0,
  costUsd: 0,
  day: '',
  dayBase: -1,
  coldRestarts: 0,
  coldUsd: 0,
  problem: '',
}
const NO_HANDOFF: EmberHandoff = { phase: 'none', text: '', skipTurn: '' }

// Change a tag when that value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const live = atom({ plugin: 'ember', key: 'live' } as const, EMPTY_LIVE, { shape: 'live-1' })
const now = atom({ plugin: 'ember', key: 'now' } as const, 0)
const board = atom({ plugin: 'ember', key: 'board' } as const, { chats: [], todayUsd: 0 } as EmberBoard, {
  shape: 'board-1',
})
const isBoardOpen = atom({ plugin: 'ember', key: 'isBoardOpen' } as const, false)
const handoff = atom({ plugin: 'ember', key: 'handoff' } as const, NO_HANDOFF, { shape: 'handoff-1' })

type Settings = { ttlMin: number | null; autoKeepTokens: number; keepWarmHours: number }

function settingsOf(options: PluginOptions): Settings {
  const ttl = String(options.ttl ?? 'auto')
  const auto = Number(options.autoKeepTokens ?? 300_000)
  const hours = Number(options.keepWarmHours ?? 4)
  return {
    ttlMin: ttl === '5' ? 5 : ttl === '60' ? 60 : null,
    autoKeepTokens: Number.isFinite(auto) && auto > 0 ? auto : 0,
    keepWarmHours: Number.isFinite(hours) && hours > 0 ? Math.min(24, hours) : 4,
  }
}

function nameOf(l: EmberLive): string {
  return l.name || basename(l.cwd) || words().chat
}

let settings: Settings = settingsOf({})
// Module variables start over on a reload; everything drawn is in $.state.
const names = { board: 'board', ember: 'ember' }
let turnId = ''
let isPinging = false
let isTicking = false
let isAfterCompact = false
let ticks = 0

async function heartbeat($: $, t: number): Promise<void> {
  const l = await read($, live)
  if (l.sessionId === '') return
  const chat: EmberChat = {
    sessionId: l.sessionId,
    name: nameOf(l),
    model: l.model,
    lastActivity: l.lastActivity,
    ctx: l.ctx,
    window: l.window,
    ttlMin: l.ttlMin,
    isKept: l.keep !== null,
    isWorking: l.isWorking,
    seenAt: t,
  }
  await $.store.set('hb:' + l.sessionId, chat)
}

// Today's spend, per session under its own key so two sessions never race:
// `spent:<date>:<session>` holds what that session spent that day.
async function countSpend($: $, costUsd: number, startedAt: number, t: number): Promise<void> {
  const day = dayKey(t)
  const l = await read($, live)
  if (l.sessionId === '') return
  let base = l.day === day ? l.dayBase : -1
  const key = `spent:${day}:${l.sessionId}`
  if (base < 0) {
    const kept = (await $.store.get(key)) as { base?: number } | undefined
    const midnight = new Date(t).setHours(0, 0, 0, 0)
    base = typeof kept?.base === 'number' ? kept.base : startedAt >= midnight ? 0 : costUsd
  }
  const spent = Math.max(0, costUsd - base)
  await $.store.set(key, { base, usd: spent })
  await update($, live, x => ({ ...x, costUsd, day, dayBase: base }))
}

async function readUsage($: $): Promise<void> {
  try {
    const usage = await $.session.usage()
    const t = await $.clock.now()
    await update($, live, x => ({
      ...x,
      ctx: usage.context.tokens ?? x.ctx,
      window: usage.context.window || x.window,
    }))
    if (usage.cost !== undefined) await countSpend($, usage.cost.usd, usage.startedAt, t)
  } catch {
    // No figures this time: the last ones stand.
  }
}

async function readBoard($: $, t: number): Promise<void> {
  const mine = await read($, live)
  const day = dayKey(t)
  const chats: EmberChat[] = []
  let todayUsd = 0
  for (const key of await $.store.keys()) {
    if (key.startsWith('spent:')) {
      if (!key.startsWith(`spent:${day}:`)) {
        await $.store.delete(key)
        continue
      }
      const spent = (await $.store.get(key)) as { usd?: number } | undefined
      todayUsd += typeof spent?.usd === 'number' ? spent.usd : 0
      continue
    }
    if (!key.startsWith('hb:')) continue
    const chat = (await $.store.get(key)) as EmberChat | undefined
    if (chat === undefined || typeof chat.seenAt !== 'number') continue
    if (chat.sessionId === mine.sessionId) continue
    if (t - chat.seenAt > FORGET_MS) await $.store.delete(key)
    if (t - chat.seenAt > SILENT_MS) continue
    chats.push(chat)
  }
  chats.push({
    sessionId: mine.sessionId,
    name: nameOf(mine),
    model: mine.model,
    lastActivity: mine.lastActivity,
    ctx: mine.ctx,
    window: mine.window,
    ttlMin: mine.ttlMin,
    isKept: mine.keep !== null,
    isWorking: mine.isWorking,
    seenAt: t,
  })
  await update($, board, () => ({ chats: boardOrder(chats, t), todayUsd }))
}

async function startKeep($: $, isAuto: boolean): Promise<void> {
  const t = await $.clock.now()
  const keep: EmberKeep = { until: t + settings.keepWarmHours * 60 * MIN, pings: 0, usd: 0, isAuto }
  await update($, live, x => ({ ...x, keep, problem: '' }))
  if (isAuto) {
    $.ui.toast(words().autoKept(Math.round(settings.autoKeepTokens / 1000)))
  }
  await heartbeat($, t)
}

async function stopKeep($: $, why: 'press' | 'time' | 'remote', problem = ''): Promise<void> {
  const l = await read($, live)
  const keep = l.keep
  if (keep === null) return
  await update($, live, x => ({ ...x, keep: null, releasedAt: x.lastActivity, problem }))
  if (why === 'time') {
    $.ui.toast(words().released(settings.keepWarmHours, pings(keep.pings), usd(keep.usd)))
  }
  await heartbeat($, await $.clock.now())
}

// A ping shortly before the TTL ends: a read of the cache restarts it.
async function keepStep($: $, t: number): Promise<void> {
  const l = await read($, live)
  if (l.keep === null || isPinging) return
  if (t >= l.keep.until) return stopKeep($, 'time')
  if (l.isWorking || l.lastActivity <= 0) return
  const left = l.ttlMin * MIN - (t - l.lastActivity)
  if (left <= 0) return stopKeep($, 'press', words().coldBeforePing)
  if (left > (l.ttlMin >= 60 ? 6 * MIN : MIN)) return

  isPinging = true
  let reply: Awaited<ReturnType<$['model']['fork']>>
  try {
    reply = await $.model.fork({ prompt: PING })
  } catch {
    reply = { isAnswered: false, reason: 'nothing-to-fork' }
  } finally {
    isPinging = false
  }
  const done = await $.clock.now()
  const cost = 'usage' in reply && reply.usage ? requestUsd(reply.usage, l.model, l.ttlMin) : 0
  if (!reply.isAnswered) {
    await update($, live, x => (x.keep === null ? x : { ...x, keep: { ...x.keep, usd: x.keep.usd + cost } }))
    return stopKeep($, 'press', words().pingFailed)
  }
  const u = reply.usage
  const rewrote = u.cache_creation_input_tokens > 0.1 * Math.max(1, u.cache_read_input_tokens)
  await update($, live, x =>
    x.keep === null
      ? x
      : {
          ...x,
          lastActivity: rewrote ? x.lastActivity : done,
          keep: { ...x.keep, pings: x.keep.pings + 1, usd: x.keep.usd + cost },
        },
  )
  if (rewrote) await stopKeep($, 'press', words().pingRewrote)
}

// A big chat's cache is kept by itself in its last minutes, unless the
// owner let it go since its last request.
async function autoKeep($: $, t: number): Promise<void> {
  const l = await read($, live)
  if (settings.autoKeepTokens === 0 || l.keep !== null || l.isWorking) return
  if (l.ctx < settings.autoKeepTokens || l.releasedAt === l.lastActivity) return
  if (liveWarmth(l, t).kind === 'cooling') await startKeep($, true)
}

// Another session's board asked this one to keep or release its cache.
async function remoteAsk($: $): Promise<void> {
  const l = await read($, live)
  const key = 'ask:' + l.sessionId
  const ask = (await $.store.get(key)) as { keep?: boolean } | undefined
  if (ask === undefined) return
  await $.store.delete(key)
  if (ask.keep === true && l.keep === null) await startKeep($, false)
  if (ask.keep === false) await stopKeep($, 'remote')
}

async function tick($: $): Promise<void> {
  if (isTicking) return
  isTicking = true
  try {
    ticks += 1
    const t = await $.clock.now()
    const isOpen = await read($, isBoardOpen)
    // The band counts minutes; the board counts seconds while it is open.
    if (isOpen || ticks % 10 === 0) await update($, now, () => t)
    if (ticks % 15 === 0) {
      await remoteAsk($)
      await autoKeep($, t)
      await keepStep($, t)
      await readUsage($)
      await heartbeat($, t)
    }
    if (isOpen && ticks % 3 === 0) await readBoard($, t)
  } finally {
    isTicking = false
  }
}

async function registerCommand($: $, name: string, description: string, argumentHint?: string) {
  const spec = { name, description, ...(argumentHint ? { argumentHint } : {}), immediate: true as const }
  try {
    await $.command.register(spec)
    return name
  } catch {
    // Another plugin holds the name (cache-keeper has /board).
    try {
      await $.command.register({ ...spec, name: 'ember-' + name })
      return 'ember-' + name
    } catch {
      return name
    }
  }
}

// --- Handoff -------------------------------------------------------------

async function armHandoff($: $, isInsideTurn: boolean): Promise<void> {
  const l = await read($, live)
  await update($, handoff, () => ({
    phase: 'asked',
    text: '',
    skipTurn: !isInsideTurn && l.isWorking ? turnId : '',
  }))
}

function askHandoff($: $): void {
  // Off the hook: a command run inside a hook the session waits on is refused.
  $.clock.after(30, async () => {
    const h = await read($, handoff)
    if (h.phase === 'asked' || h.phase === 'writing' || h.phase === 'clearing') return
    const commands = await $.command.list()
    if (!commands.some(c => c.name === HANDOFF_SKILL)) {
      $.ui.toast(words().noSkill(HANDOFF_SKILL), { timeoutMs: 8000 })
      return
    }
    await armHandoff($, false)
    try {
      await $.command.run({ command: HANDOFF_SKILL, args: '' })
    } catch {
      await update($, handoff, () => NO_HANDOFF)
      $.ui.toast(words().handoffNotStarted, { timeoutMs: 8000 })
    }
  })
}

function continueFresh($: $): void {
  $.clock.after(30, async () => {
    const h = await read($, handoff)
    if (h.phase !== 'ready') return
    if ((await read($, live)).isWorking) {
      $.ui.toast(words().stillAnswering, { timeoutMs: 6000 })
      return
    }
    const text = words().continuePrefix + h.text
    await update($, handoff, (x): EmberHandoff => ({ ...x, phase: 'clearing' }))
    try {
      await $.command.run({ command: 'clear', args: '' })
    } catch {
      await update($, handoff, (x): EmberHandoff => ({ ...x, phase: 'ready' }))
      $.ui.toast(words().clearFailed, { timeoutMs: 8000 })
      return
    }
    await update($, handoff, () => NO_HANDOFF)
    try {
      await $.prompt.submit({ text, asUser: true })
    } catch {
      const filled = await $.prompt.fill({ text }).catch(() => undefined)
      $.ui.toast(
        filled ? words().clearedFilled : words().clearedNotSent,
        { timeoutMs: 10000 },
      )
    }
  })
}

async function onBandPress($: $, action: BandAction): Promise<void> {
  if (action === 'keep') await startKeep($, false)
  if (action === 'release') await stopKeep($, 'press')
  if (action === 'handoff') askHandoff($)
  if (action === 'continue') continueFresh($)
  if (action === 'drop') await update($, handoff, () => NO_HANDOFF)
}

async function toggleKeep($: $, chat: EmberChat, mine: string): Promise<void> {
  if (chat.sessionId === mine) {
    if (chat.isKept) await stopKeep($, 'press')
    else await startKeep($, false)
  } else {
    await $.store.set('ask:' + chat.sessionId, { keep: !chat.isKept })
    $.ui.toast(words().remoteKeep(chat.name, chat.isKept))
  }
  await readBoard($, await $.clock.now())
}

export const register: Register = (on, options) => {
  settings = settingsOf(options)
  setLanguage(options?.language)

  // --- Session -------------------------------------------------------------

  on('session.start', async ($, e, next) => {
    const t = await $.clock.now()
    const id = await $.session.id()
    const cwd = await $.session.cwd()
    const model = await $.session.model()
    await update($, live, x =>
      x.sessionId === id
        ? { ...x, cwd, model: x.model || model }
        : { ...EMPTY_LIVE, sessionId: id, cwd, model },
    )
    if (settings.ttlMin !== null) {
      const ttlMin = settings.ttlMin
      await update($, live, (x): EmberLive => ({ ...x, ttlMin, ttlSource: 'setting' }))
    }
    await update($, now, () => t)
    names.board = await registerCommand($, 'board', 'ember: every local chat and how warm its cache is')
    names.ember = await registerCommand(
      $,
      'ember',
      'ember: the cache of this chat; keep it warm, release it, name the chat',
      '[keep [hours] | release | name <name>]',
    )
    $.clock.every(1000, () => {
      tick($).catch(() => {})
    })
    await readUsage($)
    await heartbeat($, t)
    return next(e)
  })

  // /clear, /resume and /branch go on under a new session id with an
  // unknown cache, and raise no session.start.
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') {
      const before = await read($, live)
      if (before.sessionId !== '' && before.sessionId !== e.session_id) {
        await $.store.delete('hb:' + before.sessionId)
      }
      await update($, live, x => ({
        ...EMPTY_LIVE,
        sessionId: e.session_id,
        cwd: x.cwd,
        model: x.model,
        ttlMin: x.ttlMin,
        ttlSource: x.ttlSource,
        name: e.session_title ?? '',
      }))
      await update($, handoff, h => (h.phase === 'clearing' ? h : NO_HANDOFF))
      await heartbeat($, await $.clock.now())
    } else if (e.session_title) {
      const name = e.session_title
      await update($, live, x => ({ ...x, name: x.name || name }))
    }
    return next(e)
  })

  // The app's title for the chat names it on the board, unless /ember name did.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    const title = e.session_title
    if (title) await update($, live, x => (x.name === '' || x.name === basename(x.cwd) ? { ...x, name: title } : x))
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    const l = await read($, live)
    if (l.sessionId !== '') await $.store.delete('hb:' + l.sessionId)
    return next(e)
  })

  // A message typed in this chat makes a waiting handoff out of date.
  on('prompt.submit', async ($, e, next) => {
    const h = await read($, handoff)
    if (h.phase === 'ready' && e.origin.kind === 'composer' && e.command === undefined) {
      await update($, handoff, () => NO_HANDOFF)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      turnId = e.turnId
      await update($, live, x => ({ ...x, isWorking: true }))
      await update($, handoff, (h): EmberHandoff =>
        h.phase === 'asked' && e.turnId !== h.skipTurn ? { ...h, phase: 'writing' } : h,
      )
    }
    return next(e)
  })

  // Each main-loop request: did it read the cache or write it again?
  on('turn.step', async function* ($, e, next) {
    const startedAt = await $.clock.now()
    const result = yield* next(e)
    if (e.agentId !== undefined || isPinging || result.usage === null) return result
    const usage = result.usage
    const endedAt = await $.clock.now()
    const wasAfterCompact = isAfterCompact
    isAfterCompact = false
    await update($, live, x => afterRequest(x, usage, startedAt, endedAt, wasAfterCompact))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    await update($, live, x => ({ ...x, isWorking: false }))
    await readUsage($)
    const h = await read($, handoff)
    if (h.phase === 'writing' && e.turnId !== h.skipTurn) {
      const at = e.answer.indexOf('# Handoff')
      const text = (at > 0 ? e.answer.slice(at) : e.answer).trim()
      if (e.reason === 'answer' && text.length >= 200) {
        await update($, handoff, () => ({ phase: 'ready', text, skipTurn: '' }))
      } else {
        await update($, handoff, () => NO_HANDOFF)
        $.ui.toast(words().handoffMissing, { timeoutMs: 8000 })
      }
    }
    await heartbeat($, await $.clock.now())
    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    isAfterCompact = true
    return result
  })

  on('session.measure', async ($, e, next) => {
    const tokens = e.context.tokens
    const window = e.context.window
    await update($, live, x => ({ ...x, ctx: tokens ?? x.ctx, window: window || x.window }))
    return next(e)
  })

  // Claude calling the handoff skill itself: this turn's answer is the handoff.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    if (e.agentId === undefined && String(e.skill) === HANDOFF_SKILL) await armHandoff($, true)
    return next(e)
  })

  // The skill typed as /ember:handoff.
  on('command.run', { command: HANDOFF_SKILL }, async ($, e, next) => {
    const h = await read($, handoff)
    if (h.phase === 'none' || h.phase === 'ready') await armHandoff($, false)
    return next(e)
  })

  // --- Commands ------------------------------------------------------------

  on('command.run', { command: ['board', 'ember-board'] }, async ($, e, next) => {
    if (e.command !== names.board) return next(e)
    const t = await $.clock.now()
    await readBoard($, t)
    const surfaces = await $.session.surfaces()
    if (surfaces.length === 0) return { text: boardText(await read($, board), t) }
    await update($, isBoardOpen, () => true)
    await update($, now, () => t)
    await $.ui.open({ id: PANE, title: words().chats, closeOnEscape: true, columns: 44 })
    return { text: '' }
  })

  on('command.run', { command: ['ember', 'ember-ember'] }, async ($, e, next) => {
    if (e.command !== names.ember) return next(e)
    const [word = '', ...rest] = e.args.trim().split(/\s+/)
    const verb = word.toLowerCase()
    if (verb === 'keep') {
      await startKeep($, false)
      const hours = Number(rest[0])
      if (Number.isFinite(hours) && hours > 0) {
        const t = await $.clock.now()
        await update($, live, x =>
          x.keep === null ? x : { ...x, keep: { ...x.keep, until: t + Math.min(24, hours) * 60 * MIN } },
        )
      }
    } else if (verb === 'release') {
      await stopKeep($, 'press')
    } else if (verb === 'name') {
      const name = rest.join(' ').slice(0, 60)
      await update($, live, x => ({ ...x, name }))
      await heartbeat($, await $.clock.now())
    }
    return { text: statusText(await read($, live), await $.clock.now(), settings) }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) await update($, isBoardOpen, () => false)
    return next(e)
  })

  // --- Drawing -------------------------------------------------------------

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey || e.props.view.agentId !== undefined) return below
    const model = bandModel(await read($, live), await read($, handoff), await read($, now))
    if (model === null) return below
    const press = (action: BandAction) => () => {
      onBandPress($, action).catch(() => {})
    }
    const mine = e.surface === 'terminal' ? bandTerminal($, e, model, press) : bandGraphic($, e, model, press)
    if (below === null || below === undefined) return mine
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {mine}
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const data = await read($, board)
    const t = await read($, now)
    const mine = (await read($, live)).sessionId
    const toggle = (chat: EmberChat) => () => {
      toggleKeep($, chat, mine).catch(() => {})
    }
    return e.surface === 'terminal'
      ? boardTerminal($, e, data, t, mine, toggle)
      : boardGraphic($, e, data, t, mine, toggle)
  })

}

// --- Drawings, per surface ---------------------------------------------------

type RenderInput = Parameters<EngineInterface['ui']['resolve']>[0]
type Press = (action: BandAction) => () => void

const ACCENT = { ok: 'success', warn: 'warning', idle: undefined } as const
const HOTKEY: Record<BandAction, string> = { keep: 'w', release: 'w', handoff: 'h', continue: 'c', drop: 'x' }

function bandTerminal($: $, e: RenderInput, m: BandModel, press: Press) {
  const { Box, Text, Button } = $.ui.resolve(e)
  const color = ACCENT[m.tone]
  return (
    <Box flexDirection="row" columnGap={2} width="100%">
      <Box flexShrink={1} flexGrow={1}>
        <Text wrap="truncate-end">
          <Text color={color} dimColor={color === undefined}>
            {m.ringWords}
          </Text>
          {'  '}
          <Text color={m.tone === 'idle' ? undefined : color}>{m.lead}</Text>
          {m.rest}
          <Text dimColor>{m.detail === '' ? '' : ' · ' + m.detail}</Text>
        </Text>
      </Box>
      <Box flexDirection="row" columnGap={2} flexShrink={0}>
        {m.note !== '' && <Text dimColor>{m.note}</Text>}
        {m.buttons.map(b => (
          <Button
            key={b.action}
            label={b.label.toLowerCase()}
            hotkey={HOTKEY[b.action]}
            plain
            dimColor={!b.isMain}
            onPress={press(b.action)}
          />
        ))}
      </Box>
    </Box>
  )
}

function bandGraphic($: $, e: RenderInput, m: BandModel, press: Press) {
  const table = $.ui.resolve(e)
  const { Box, Text, Button } = table
  const Svg = 'Svg' in table ? table.Svg : undefined
  const color = ACCENT[m.tone]
  return (
    <Box flexDirection="row" alignItems="center" columnGap="sm" paddingX="xs" width="100%">
      {Svg !== undefined && (
        <Svg source={ringSvg(m.share, m.minutes, m.tone)} alt={m.alt} width={RING_PX} height={RING_PX} />
      )}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Text size="footnote" wrap="truncate-end">
          <Text weight="medium" color={m.tone === 'idle' ? undefined : color}>
            {m.lead}
          </Text>
          {m.rest}
        </Text>
        <Text size="caption" dimColor tabular wrap="truncate-end">
          {m.detail}
        </Text>
      </Box>
      <Box flexDirection="row" columnGap="xs" alignItems="center" flexShrink={0}>
        {m.note !== '' && (
          <Text size="caption" dimColor>
            {m.note}
          </Text>
        )}
        {m.buttons.map(b => (
          <Button key={b.action} label={b.label} dimColor={!b.isMain} onPress={press(b.action)} />
        ))}
      </Box>
    </Box>
  )
}

type Toggle = (chat: EmberChat) => () => void

function rowFacts(chat: EmberChat, t: number) {
  const w = warmthOf(chat, t)
  const pct = percent(chat.ctx, chat.window)
  const dot = w.kind === 'warm' || w.kind === 'kept' ? 'success' : w.kind === 'cooling' ? 'warning' : undefined
  const time = w.kind === 'cold' ? words().coldWord : w.kind === 'unknown' ? '—' : mmss(w.leftMs)
  const canKeep = w.kind === 'warm' || w.kind === 'cooling' || w.kind === 'kept'
  return { w, pct: pct === undefined ? '' : `${pct}%`, dot, time, canKeep }
}

function boardHead(data: EmberBoard): string {
  return words().boardHead(data.chats.length, usd(data.todayUsd))
}

function boardTerminal($: $, e: RenderInput, data: EmberBoard, t: number, mine: string, toggle: Toggle) {
  const { Box, Text, Button } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold>{words().chats}</Text>
        <Text dimColor>{boardHead(data)}</Text>
      </Box>
      {data.chats.map((chat, i) => {
        const f = rowFacts(chat, t)
        return (
          <Box key={'row-' + chat.sessionId} flexDirection="row" columnGap={1}>
            <Text color={f.dot} dimColor={f.dot === undefined}>
              ●
            </Text>
            <Box flexGrow={1} flexShrink={1}>
              <Text wrap="truncate-end" bold={chat.sessionId === mine}>
                {chat.name}
                {chat.isKept ? <Text dimColor>{words().keeping}</Text> : ''}
              </Text>
            </Box>
            <Text dimColor>{f.pct.padStart(4)}</Text>
            <Text dimColor>{f.time.padStart(8)}</Text>
            {f.canKeep && i < 9 ? (
              <Button
                key={'keep-' + chat.sessionId}
                label={chat.isKept ? words().releaseLower : words().keepLower}
                hotkey={String(i + 1)}
                plain
                dimColor
                onPress={toggle(chat)}
              />
            ) : (
              <Text> </Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

function boardGraphic($: $, e: RenderInput, data: EmberBoard, t: number, mine: string, toggle: Toggle) {
  const { Box, Text, Button } = $.ui.resolve(e)
  return (
    <Box flexDirection="column" paddingX="xs">
      <Box flexDirection="row" justifyContent="space-between" alignItems="flex-end" marginBottom="xs">
        <Text size="footnote" weight="semibold">
          {words().chats}
        </Text>
        <Text size="caption" dimColor tabular>
          {boardHead(data)}
        </Text>
      </Box>
      {data.chats.map(chat => {
        const f = rowFacts(chat, t)
        return (
          <Box key={'row-' + chat.sessionId} flexDirection="row" alignItems="center" columnGap="sm" paddingY="xs">
            <Text size="caption" color={f.dot ?? 'subtle'}>
              ●
            </Text>
            <Box flexGrow={1} flexShrink={1} minWidth={0}>
              <Text size="footnote" wrap="truncate-end" weight={chat.sessionId === mine ? 'medium' : 'regular'}>
                {chat.name}
                {chat.isKept ? <Text dimColor>{words().keeping}</Text> : ''}
              </Text>
            </Box>
            {f.canKeep && (
              <Box display="none" hover={{ display: 'flex' }}>
                <Button key={'keep-' + chat.sessionId} dimColor onPress={toggle(chat)}>
                  {chat.isKept ? words().release : words().keep}
                </Button>
              </Box>
            )}
            <Text size="caption" dimColor tabular>
              {f.pct}
            </Text>
            <Box minWidth={6} justifyContent="flex-end">
              <Text size="caption" dimColor mono tabular>
                {f.time}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function boardText(data: EmberBoard, t: number): string {
  const rows = data.chats.map(chat => {
    const f = rowFacts(chat, t)
    return `${f.w.kind.padEnd(8)} ${chat.name.slice(0, 40).padEnd(41)} ${f.pct.padStart(4)} ${f.time.padStart(8)}`
  })
  return [words().chats + ' · ' + boardHead(data), ...rows].join('\n')
}

function statusText(l: EmberLive, t: number, settings: Settings): string {
  const W = words()
  const w = liveWarmth(l, t)
  const state = w.kind === 'unknown' ? W.notCreated : w.kind === 'cold' ? W.cold : W.toCold(mmss(w.leftMs), l.keep !== null)
  const keep = l.keep === null ? '' : ` · ${pings(l.keep.pings)}, ${usd(l.keep.usd)}`
  const auto = settings.autoKeepTokens > 0 ? W.autoKeepFrom(Math.round(settings.autoKeepTokens / 1000)) : W.noAutoKeep
  return [
    `ember · ${nameOf(l)}: ${state}${keep}`,
    W.tokensLine(Math.round(l.ctx / 1000), W.ttl(l.ttlMin, l.ttlSource), auto),
    W.coldRestarts(l.coldRestarts, usd(l.coldUsd), usd(l.costUsd)),
    W.usage,
  ].join('\n')
}
