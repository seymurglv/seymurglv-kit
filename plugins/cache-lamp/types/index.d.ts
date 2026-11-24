// cache-lamp: the values the lamp draws from, kept in $.state.

export type Heartbeat = {
  id: string
  label: string
  ctx: number
  ttlMin: 5 | 60
  /** ms; 0 = unknown */
  lastActivity: number
  /** ms; 0 = none yet */
  lastOwnPrompt: number
  working: boolean
  /** 'stopped' = turned off by a failed or rebuilding ping */
  keepWarm: 'on' | 'off' | 'stopped'
  stopReason?: 'rebuilt' | 'noAnswer'
  updatedAt: number
}

export type LampState =
  | { kind: 'unknown' }
  | { kind: 'warm'; leftMs: number }
  | { kind: 'kept'; untilMs: number }
  | { kind: 'cooling'; leftMs: number }
  | { kind: 'cold'; sinceMs: number }

export type Options = { bigTokens: number; keepWarmHours: number; compactHint: number }

declare module 'claude-code' {
  interface PluginState {
    'cache-lamp': {
      self: Shaped<Heartbeat>
      warned: Shaped<string[]>
    }
  }
}
