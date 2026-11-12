// ember's values in $.state: what this session knows about its prompt cache,
// the board of local chats, and the handoff. They outlive a hot reload; what
// must outlive the session (the board's heartbeats, today's spend) is in $.store.

/** Keeping the cache warm with pings. */
export type EmberKeep = {
  /** When keeping stops by itself, in $.clock.now() milliseconds. */
  until: number
  pings: number
  /** What the pings cost so far, US dollars. */
  usd: number
  /** Turned on by itself for a big chat rather than by a press. */
  isAuto: boolean
}

/** This session's cache, as the main loop's requests reported it. */
export type EmberLive = {
  sessionId: string
  cwd: string
  /** The board's name for this chat; empty: the folder's name. */
  name: string
  model: string
  /** The last request that read or wrote the cache; 0 before the first. */
  lastActivity: number
  /** Tokens in the context, so in the cache. */
  ctx: number
  window: number
  ttlMin: number
  /** How the TTL is known: the setting, a measurement, or the default. */
  ttlSource: 'setting' | 'measured' | 'default'
  isWorking: boolean
  keep: EmberKeep | null
  /** The lastActivity at which the owner let a big chat's cache go. */
  releasedAt: number
  /** The session's cost so far, as /cost totals it. */
  costUsd: number
  /** The local date today's spend counts for, and the cost it counts from. */
  day: string
  dayBase: number
  coldRestarts: number
  coldUsd: number
  /** The last thing that went wrong, shown amber with "!"; empty when none. */
  problem: string
}

/** One chat on the board, as its session last wrote it to the store. */
export type EmberChat = {
  sessionId: string
  name: string
  model: string
  lastActivity: number
  ctx: number
  window: number
  ttlMin: number
  isKept: boolean
  isWorking: boolean
  /** When that session last wrote, in $.clock.now() milliseconds. */
  seenAt: number
}

export type EmberBoard = {
  chats: EmberChat[]
  /** Spent today by every chat that ran ember, closed ones included. */
  todayUsd: number
}

/** The handoff: asked for, being written, ready to continue with, clearing. */
export type EmberHandoff = {
  phase: 'none' | 'asked' | 'writing' | 'ready' | 'clearing'
  /** The handoff's text, held until it is sent or dropped; never stored. */
  text: string
  /** A turn already running when it was asked for: not the handoff's. */
  skipTurn: string
}

declare module 'claude-code' {
  interface PluginState {
    ember: {
      live: Shaped<EmberLive>
      /** The clock the drawings count from, moved by the module's timer. */
      now: number
      board: Shaped<EmberBoard>
      isBoardOpen: boolean
      handoff: Shaped<EmberHandoff>
    }
  }
}
