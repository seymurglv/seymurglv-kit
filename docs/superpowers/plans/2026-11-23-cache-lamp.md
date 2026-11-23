# cache-lamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A function-hooks plugin that draws a banui lamp line over the prompt box with this session's cache state, shows other sessions that need a look, warns once 5 minutes before a big cache goes cold, and keeps big 1-hour caches warm with hidden fork pings while the owner is away.

**Architecture:** Pure decision logic in `hooks/state.ts` (no `$`), words in `hooks/words.ts`, and `hooks/register.tsx` wiring engine events, a 30 s `$.clock.every` tick, heartbeats in the shared `$.store`, `$.model.fork` pings and the `AbovePrompt` render. Shaped like `plugins/waypoints/`.

**Tech Stack:** TypeScript/TSX on Claude Code's function-hooks engine (`claude-code`, `claude-code/testing`); tests run with `claude plugin test`.

**Spec:** `docs/superpowers/specs/2026-11-23-cache-lamp-design.md`

## Global Constraints

- Plugin folder `plugins/cache-lamp/`, plugin name `cache-lamp`, command `/cache-lamp`.
- `userConfig`: `bigTokens` number, default `100000`; `keepWarmHours` number, default `3`; `language` `en` | `ru`, default `en`.
- banui lamp map only, no fifth color: lit lamp = `attention`, `#2F6BFF` on a light page, `#5C8DFF` on a dark one. Everything else (rest dot, text) is ink or dim. No red, no amber, no dollars.
- Numbers are tokens (`180k`), times are 24-hour `HH:MM`, minutes rounded up.
- Keep-warm only when context ≥ `bigTokens` **and** TTL is 60 min; never on the 5-min TTL.
- Keep-warm stops `keepWarmHours` after the owner's last own prompt in that session.
- A ping whose `cache_creation_input_tokens` > 0.1 × `cache_read_input_tokens` stops keep-warm for that session.
- Nothing is ever written into the chat; the plugin never submits a prompt.
- One toast per cooling, in one session only: the live session with the latest `lastOwnPrompt`.
- A cold session is not listed in the line; `/cache-lamp` lists every live session.
- Small sessions (< `bigTokens`): line only, never the lit lamp, never a toast, never a ping.

## Review Focus

1. A turn running past the warning point (a long tool call): no ping and no toast while that session `working`; its own requests keep `lastActivity` fresh.
2. `/clear`, `/resume`, `/branch` and `/compact`: the cache state becomes unknown (nothing drawn) and keep-warm re-arms only after the next own prompt.
3. The session that would show the toast has gone stale or ended: the next live session with the latest `lastOwnPrompt` shows it instead; a closed session's heartbeat is deleted on `session.end`.
4. A fork ping that throws or is not answered: keep-warm stops with a reason on the line; no retry loop.
5. Subagent turns (`agentId` set): they neither count as the owner's prompt nor move this session's `lastActivity`.

---

### Task 1: Scaffold and pure cache logic

**Files:**
- Create: `plugins/cache-lamp/.claude-plugin/plugin.json`, `plugins/cache-lamp/hooks/hooks.json` (`{ "modules": ["./register.tsx"] }`), `plugins/cache-lamp/types/index.d.ts`, `plugins/cache-lamp/hooks/state.ts`
- Test: `plugins/cache-lamp/tests/state.test.ts`

**Interfaces:**
- Produces, in `types/index.d.ts`:
  ```ts
  export type Heartbeat = {
    id: string; label: string; ctx: number; ttlMin: 5 | 60
    lastActivity: number   // ms; 0 = unknown
    lastOwnPrompt: number  // ms; 0 = none yet
    working: boolean
    keepWarm: 'on' | 'off' | 'stopped'   // 'stopped' = turned off by a failed or rebuilding ping
    stopReason?: 'rebuilt' | 'noAnswer'
    updatedAt: number
  }
  export type LampState =
    | { kind: 'unknown' }
    | { kind: 'warm'; leftMs: number }
    | { kind: 'kept'; untilMs: number }
    | { kind: 'cooling'; leftMs: number }
    | { kind: 'cold'; sinceMs: number }
  export type Options = { bigTokens: number; keepWarmHours: number }
  ```
  plus `declare module 'claude-code' { interface PluginState { 'cache-lamp': { self: Shaped<Heartbeat>; warned: Shaped<string[]> } } }`.
- A new session's heartbeat starts with `keepWarm: 'off'`, `lastActivity: 0`, `lastOwnPrompt: 0`, `ttlMin: 60`.
- Produces, in `hooks/state.ts` (constants `MIN = 60_000`, `PING_AT_MS = 6 * MIN`, `STALE_MS = 3 * MIN`, `DROP_MS = 60 * MIN`; `warnMs(ttlMin) = ttlMin === 60 ? 5 * MIN : MIN`, since on the 5-min TTL a 5-min window would keep the lamp lit all the time):
  - `willKeepWarm(hb: Heartbeat, now: number, o: Options): boolean` — `ctx >= bigTokens && ttlMin === 60 && keepWarm === 'on' && lastOwnPrompt > 0 && now - lastOwnPrompt < keepWarmHours * 60 * MIN`
  - `lampState(hb: Heartbeat, now: number, o: Options): LampState` — `unknown` if `lastActivity === 0`; `cold` if left ≤ 0; `kept` (until `lastOwnPrompt + keepWarmHours·h`) if `willKeepWarm`; `cooling` if left ≤ `warnMs(ttlMin)` and `ctx >= bigTokens`; else `warm`
  - `shouldPing(hb: Heartbeat, now: number, o: Options): boolean` — `willKeepWarm && !working && lastActivity > 0 && 0 < left <= PING_AT_MS`
  - `pingVerdict(u: ModelUsage): 'read' | 'rebuilt'` — `'rebuilt'` when creation > 0.1 × max(1, read)
  - `nextTtl(current: 5 | 60, gapMs: number, u: ModelUsage): 5 | 60` — cache-keeper's rule: total input > 30 000 and written/total > 0.5 and 5.5 min < gap < current·min → `5`; total > 30 000 and gap > 5.5 min and read/total > 0.8 → `60`; else `current`
  - `boardOthers(fleet: Heartbeat[], selfId: string, now: number, o: Options): Heartbeat[]` — not self, not stale (`now - updatedAt > STALE_MS`), state `cooling` or `kept`
  - `warnTargetId(fleet: Heartbeat[], now: number): string | undefined` — non-stale heartbeat with the largest `lastOwnPrompt` (> 0)
  - `toWarn(fleet: Heartbeat[], now: number, o: Options): Heartbeat[]` — non-stale, `lampState(...).kind === 'cooling'`

- [ ] **Step 1: Write the failing tests** in `tests/state.test.ts` (`import { expect, test } from 'claude-code/testing'`), with `const o = { bigTokens: 100_000, keepWarmHours: 3 }` and a `hb(over: Partial<Heartbeat>)` helper (defaults: `ctx 180_000, ttlMin 60, lastActivity 0, lastOwnPrompt 0, working false, keepWarm 'on', updatedAt now`):
  - `lampState is unknown before any request` → `{ kind: 'unknown' }`
  - `big session idle 50 min with an own prompt 1 h ago is kept` → kind `kept`, `untilMs === lastOwnPrompt + 3·60·MIN`
  - `big session 56 min idle, own prompt 4 h ago, is cooling with 4 min left` → `{ kind: 'cooling', leftMs: 4 * MIN }`
  - `small session 56 min idle stays warm, never cooling`
  - `session on the 5-min TTL is never kept` (`ttlMin: 5`, recent prompt, 2 min idle → `warm`; 4 min idle → `cooling` with 1 min)
  - `61 min idle is cold` → `{ kind: 'cold', sinceMs: MIN }`
  - `shouldPing fires at 6 min left, not at 7, not while working, not when stopped`
  - `pingVerdict`: read 180 000 / creation 300 → `'read'`; read 0 / creation 180 000 → `'rebuilt'`
  - `nextTtl`: rewrite after 20 min gap → `5`; hit after 20 min gap → `60`; small total → unchanged
  - `boardOthers drops self, stale, warm and cold; keeps cooling and kept`
  - `warnTargetId picks the latest own prompt among live sessions, skipping a stale one`
- [ ] **Step 2: Run** `claude plugin test plugins/cache-lamp` — expect FAIL (module not found).
- [ ] **Step 3: Implement** `plugin.json` (as `plugins/waypoints/.claude-plugin/plugin.json`: name, description, author `seymurglv`, MIT, `"types": "./types/index.d.ts"`, the three `userConfig` entries from Global Constraints), `hooks.json`, `types/index.d.ts`, `hooks/state.ts`. `register.tsx` exports an empty `register` for now.
- [ ] **Step 4: Run** `claude plugin test plugins/cache-lamp` and `claude plugin validate plugins/cache-lamp` — expect all PASS.
- [ ] **Step 5: Commit** `git add plugins/cache-lamp && git commit -m "cache-lamp: scaffold and cache state logic"`

### Task 2: Words

**Files:**
- Create: `plugins/cache-lamp/hooks/words.ts`
- Test: `plugins/cache-lamp/tests/words.test.ts`

**Interfaces:**
- Produces: `wordsFor(language: unknown): Words` (ru when `'ru'`, else en), `tokens(n: number): string` (same as waypoints' `tokens`), `clock(ms: number): string` (24-hour `HH:MM`, local time), and
  ```ts
  type Words = {
    line: (s: LampState, ctx: number) => string   // '' for unknown
    other: (label: string, s: LampState, ctx: number) => string
    stopped: (reason: 'rebuilt' | 'noAnswer') => string
    toast: (label: string, isSelf: boolean, leftMs: number, ctx: number) => string
    command: string                                // /cache-lamp description
    list: (rows: { label: string; s: LampState; ctx: number; isSelf: boolean }[]) => string
    none: string                                   // /cache-lamp with no live session
  }
  ```
- Exact ru copy (en mirrors it): warm `кэш тёплый · {m} мин · {tok}`; kept `держу тёплым до {HH:MM} · {tok}`; cooling `кэш остынет через {m} мин · {tok}`; cold `кэш остыл · следующее сообщение перечитает {tok}`; other `{label}: {line}`; stopped rebuilt `подогрев выключен: пинг пересобрал кэш`, noAnswer `подогрев выключен: пинг не получил ответа`; toast self `этот чат: кэш {tok} остынет через {m} мин`, other `{label}: кэш {tok} остынет через {m} мин`; command `Кэш всех открытых сессий`; none `cache-lamp: открытых сессий нет`. Minutes are `Math.ceil(ms / MIN)`.
  en: `cache warm · {m} min · {tok}`, `keeping warm until {HH:MM} · {tok}`, `cache cools in {m} min · {tok}`, `cache cold · the next message re-reads {tok}`, `keep-warm off: the ping rebuilt the cache`, `keep-warm off: the ping got no answer`, `this chat: {tok} cache cools in {m} min`, `{label}: {tok} cache cools in {m} min`, `Cache of every open session`, `cache-lamp: no open sessions`.

- [ ] **Step 1: Write failing tests**: `ru line for each state` (exact strings above with `ctx 180_000` → `180k`, `leftMs 4·MIN - 1` → `4 мин`), `en toast for self and other`, `list marks this chat and includes cold sessions`, `wordsFor falls back to en`.
- [ ] **Step 2: Run** `claude plugin test plugins/cache-lamp` — FAIL.
- [ ] **Step 3: Implement** `hooks/words.ts`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `cache-lamp: words in ru and en`

### Task 3: Tracking and heartbeats

**Files:**
- Modify: `plugins/cache-lamp/hooks/register.tsx`
- Test: `plugins/cache-lamp/tests/lamp.test.tsx` (engine mocks as in `plugins/waypoints/tests/band.test.tsx`: `mock.clock(on)`, `mock.store(on)`, stub `ui.toast`, `ui.log`, `command.register`, `model.fork`, `session.usage`)

**Interfaces:**
- Consumes: Task 1 `Heartbeat`, `nextTtl`; constants.
- Produces: store keys `hb:<sessionId>` holding a `Heartbeat`; `$.state` atom `self` (shape tag `self-1`); exported `readFleet($: EngineInterface, now: number): Promise<Heartbeat[]>` (deletes heartbeats older than `DROP_MS`, returns the rest incl. self); `TICK_MS = 30_000`.
- Events: `session.start` (id, cwd, label = `basename(cwd)`, register `/cache-lamp`, start `$.clock.every(TICK_MS, tick)`, write heartbeat); `prompt.submit` with `origin.kind` `composer` or `bridge` and no `agentId` → `lastOwnPrompt = now`, `keepWarm = 'on'`, and on the first one label becomes `basename(cwd) · <first 30 chars>`; `turn.start`/`turn.complete` (main loop only) → `working`; `turn.step` (main loop only) → `ttlMin = nextTtl(...)`, `ctx = total input`, `lastActivity = now`; `turn.complete` → `ctx` from `$.session.usage().context.tokens` when present; `classic.SessionStart` source `clear|resume|fork` and `session.compact` → `lastActivity = 0`, `lastOwnPrompt = 0`; `session.end` → delete `hb:<id>`. Every change writes the heartbeat and calls `$.ui.invalidate('ui.render')`.

- [ ] **Step 1: Write failing tests**: `a composer prompt and a request write a heartbeat with ctx, lastActivity and lastOwnPrompt`; `a subagent prompt and step change nothing`; `clear resets the cache to unknown`; `session.end deletes the heartbeat`; `readFleet drops a heartbeat silent for over an hour`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the events above in `register.tsx`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `cache-lamp: track this session and share heartbeats`

### Task 4: Keep-warm ping and the warning

**Files:**
- Modify: `plugins/cache-lamp/hooks/register.tsx`
- Test: `plugins/cache-lamp/tests/lamp.test.tsx`

**Interfaces:**
- Consumes: `shouldPing`, `pingVerdict`, `toWarn`, `warnTargetId`, `readFleet`, `Words.toast`.
- Produces: `tick($)` = refresh own heartbeat → ping step → `readFleet` → warn step → invalidate.
  - Ping step: if `shouldPing(self)`, `await $.model.fork({ prompt: 'cache-lamp keep-alive. Reply with only: ok' })`; not answered or thrown → `keepWarm = 'stopped'`, `stopReason = 'noAnswer'`; `pingVerdict === 'rebuilt'` → `'stopped'`, `'rebuilt'`; else `lastActivity = now`.
  - Warn step: only when `warnTargetId(fleet) === self.id`; for each `toWarn` heartbeat whose key `${id}:${lastActivity}` is not in the `warned` atom, `$.ui.toast(words.toast(...), { timeoutMs: 15000 })` and record the key (keep the last 50 keys).

- [ ] **Step 1: Write failing tests**: `a big idle session pings at 6 min left and stays warm` (advance the mocked clock 54 min after a request; one fork; `lastActivity` moved); `no ping on the 5-min TTL`; `no ping 3 h after the last own prompt, and the warning toast follows`; `a rebuilding ping stops keep-warm with reason rebuilt and never pings again`; `a fork that throws stops keep-warm with reason noAnswer`; `only the session with the latest own prompt shows the toast, once` (two heartbeats in the store, two ticks → one toast in the target, none in the other); `no ping and no toast while working`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `tick`, ping and warn steps.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `cache-lamp: keep big caches warm, warn once before one goes cold`

### Task 5: The lamp line and /cache-lamp

**Files:**
- Modify: `plugins/cache-lamp/hooks/register.tsx`
- Test: `plugins/cache-lamp/tests/lamp.test.tsx`

**Interfaces:**
- Consumes: `lampState`, `boardOthers`, `Words.line`, `Words.other`, `Words.stopped`, `Words.list`.
- Produces:
  - `ui.render` `AbovePrompt`: return `below` untouched when `e.props.hasSurvey`, `e.props.isWorking` or own state `unknown`. Otherwise a column: own line (lamp + `words.line`, or `words.stopped(reason)` appended after ` · ` when `keepWarm === 'stopped'`), then one dim row per `boardOthers` entry, then `below` (so waypoints' rows sit under the lamp).
  - Lamp, desktop: an `Svg` 6×6 viewBox holding a 3 px circle; rest = fill `#808080`; lit (`cooling` and `ctx >= bigTokens`) = attention color by theme (`#2F6BFF` light, `#5C8DFF` dark; if the render event exposes no theme, `#2F6BFF`), with an SVG `<animate>` on opacity 1→0.35→1 over 2.4 s for the breath. Text `size="caption"`, `dimColor` for warm/kept/cold.
  - Lamp, terminal: `●` `dimColor` at rest, `●` `color="blue"` lit, then the text.
  - `command.run` `cache-lamp` → `{ text: words.list(rows) }` for every live heartbeat (self first), or `words.none`.

- [ ] **Step 1: Write failing tests** on both surfaces (loop over `['terminal', 'desktop']` as waypoints' band tests do): `nothing is drawn before the first request`; `a warm line reads "кэш тёплый · 42 мин · 180k"` with `language: 'ru'`; `the lamp lights only for a big cooling session`; `a cooling neighbour gets a row, a cold one does not`; `stopped keep-warm shows its reason`; `the line hides while a turn runs or a survey is open`; `/cache-lamp lists a cold neighbour too`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the render and the command.
- [ ] **Step 4: Run** `claude plugin test plugins/cache-lamp` and `claude plugin test plugins/waypoints` — both PASS.
- [ ] **Step 5: Commit** `cache-lamp: the lamp line and /cache-lamp`

### Task 6: Ship it in the kit and check it live

**Files:**
- Create: `plugins/cache-lamp/README.md` (shaped like waypoints' README: what it shows with a text sketch for desktop and terminal, the states table from the spec, keep-warm rules and limits, Options table, Checks, Credits: "Mechanics after Nate Herk's cache-keeper (MIT)")
- Modify: `.claude-plugin/marketplace.json` (entry `{ "name": "cache-lamp", "source": "./plugins/cache-lamp", "description": … }`), `README.md` (row in the plugins table next to waypoints; install line), `AGENTS.md` (`claude plugin install cache-lamp@seymurglv` in section 2; in section 3 a line that cache-lamp, like waypoints, is Claude Code only)

- [ ] **Step 1: Run** `claude plugin validate plugins/cache-lamp` and `claude plugin validate .` — PASS.
- [ ] **Step 2: Commit** `cache-lamp: README, marketplace entry, install notes` and push to `origin` (the kit's own private remote; the `seymurglv` marketplace on this machine reads it from GitHub).
- [ ] **Step 3: Install**: `claude plugin marketplace update seymurglv`, then `claude plugin install cache-lamp@seymurglv`. Copy `~/.claude/settings.json` to a dated copy first (AGENTS.md rule), then add `"cache-lamp@seymurglv": { "options": { "language": "ru" } }` under `pluginConfigs`; check it still parses.
- [ ] **Step 4: Live check in Claude Desktop**: a new session in any channel folder; after the first answer the line shows `кэш тёплый · 60 мин · …` above waypoints' rows; `/cache-lamp` lists the session. Screenshot for the owner.
