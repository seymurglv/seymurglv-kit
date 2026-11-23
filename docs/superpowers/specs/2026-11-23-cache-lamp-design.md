# cache-lamp: design

Date: 2026-11-23. Status: draft for the owner's approval.

## Intent

Every message re-reads the whole session context. From the prompt cache that is cheap; once the cache goes cold
(1 hour idle on the owner's subscription, 5 minutes on the API TTL and in usage overage) the next message rebuilds
the whole context and eats the usage limit. The owner usually walks away from the computer or works in a
neighbouring session, so a warning drawn only in the idle session would not be seen.

cache-lamp shows the cache state of every open session in banui's quiet language, and keeps big caches warm on
its own while the owner is away, so coming back costs a cache read instead of a rebuild.

## Goals

1. **Lamp over the prompt box** (`AbovePrompt`, Claude Desktop and terminal): one line for this session.
   A banui lamp dot plus words: state, minutes left, context size in tokens.
2. **Board of sessions.** Each session writes a heartbeat to the shared mod store; every session reads the others.
   The line under this session's lamp lists other sessions only while they need a look: cooling, or kept warm.
   A cold session leaves the line (its own lamp still says so); `/cache-lamp` prints the full list, cold ones
   included. *(Builder's call: otherwise every old idle session stays above the prompt for good.)*
3. **Warning 5 minutes before a big cache goes cold**, only for a cache that will not be kept warm (see 4),
   once per cooling, as one toast in one session: the session where the owner sent his most recent own prompt
   (each heartbeat carries `lastOwnPrompt`; the session with the latest one shows it, the others don't).
   *(Builder's call: the mod API has no focus signal; the latest prompt is the best guess of where the owner is,
   and it avoids stacked copies.)*
4. **Auto keep-warm.** For a session whose context is at least `bigTokens` (default 100k) **and whose TTL is
   1 hour**: about 5 minutes before the TTL runs out, while no turn runs, the mod sends a hidden `$.model.fork`
   ping that reads the cache and restarts its timer. Nothing is written into the chat. It stops after
   `keepWarmHours` (default 3) since the owner's last own prompt in that session, then the normal warning applies.
   On the 5-minute TTL (API, usage overage) there is no keep-warm: 12 pings an hour for 3 hours would cost
   more than the rebuild they avoid. *(Builder's call.)*
5. Settings as plugin `userConfig` (like waypoints): `bigTokens`, `keepWarmHours`, `language` (`en` | `ru`).

## Lamp states (banui lamp map, no fifth color)

| State | Dot | Words (ru) |
|---|---|---|
| warm, more than 5 min left | rest dot, ink, unlit | `кэш тёплый · 42 мин · 180k` |
| kept warm by the mod | rest dot, ink | `держу тёплым до 17:40 · 180k` |
| cooling, 5 min or less, not kept | `attention` lamp, breathing | `кэш остынет через 4 мин · 180k` |
| cold | rest dot, ink, dimmed | `кэш остыл · следующее сообщение перечитает 180k` |
| unknown (no request yet) | nothing drawn | |

Small sessions (under `bigTokens`) show only the line, never the blue lamp and never a toast: their rebuild is cheap.
Numbers are tokens, not dollars: the owner is on a subscription, so tokens are what the limit counts.
Anthropic does not publish exactly how the subscription limit weighs a cache read against a rebuild; per the
Claude Code team a high cache hit rate is what keeps limits generous, so a read is assumed to count far less.
On the 5-minute TTL the line still shows the timer and the warning works; it just never says "kept warm".

## Non-goals

- No guard that blocks a cold send, no handoff flow, no screen-recording masking, no plan-limit display,
  no dollar accounting (all present in Nate Herk's cache-keeper; deliberately left out).
- No system or phone notifications: the mod API has only in-app toasts, and auto keep-warm makes them unneeded.
- No keep-warm button in the UI for now; auto keep-warm is the only mode.

## Anti-goals (a failure even if it works)

- A forgotten session silently spending the limit for hours: keep-warm is bounded by `keepWarmHours`.
- A ping that rebuilds instead of reading: if a ping's `cache_creation_input_tokens` exceeds 10% of its
  `cache_read_input_tokens`, keep-warm stops for that session and the line says why.
- Anything loud: no colors outside the lamp, no red, no toast stacks, no more than one line per other session.
- Anything in the chat transcript.

## Approaches considered

- **A. Lamp and board only.** Covers the neighbouring-session case; does nothing when the owner is away.
- **B. A plus auto keep-warm (picked by the owner).** Covers both cases with no action from the owner; costs a
  ping of roughly 1/40 of a rebuild per hour of absence, bounded in time.
- **C. A plus phone or macOS notifications** through a shell hook or the Telegram plugin. More moving parts, the
  Telegram plugin does not connect today, and away from the computer the owner could only come back anyway.

## How it is built (decided)

- A function-hooks plugin in `plugins/cache-lamp/` of seymurglv-kit, shaped like `plugins/waypoints/`
  (`.claude-plugin/plugin.json` with `userConfig`, `hooks/hooks.json`, `hooks/register.tsx`, `types/`, `tests/`,
  `README.md`), and an entry in `.claude-plugin/marketplace.json` and in `AGENTS.md`'s install list.
  The kit is restructured later as a separate project; cache-lamp moves with it.
- Written fresh in TypeScript/TSX like waypoints. Nate Herk's cache-keeper
  (`~/.claude/plugins/marketplaces/nateherk-mods/cache-keeper/hooks/register.mjs`, MIT) is a reference for
  the mechanics: `$.clock.every` tick, heartbeats under `hb:<sessionId>` in `$.store`, stale heartbeats dropped
  after an hour, `$.model.fork` ping with the write-vs-read check, `$.session.usage()` after `turn.complete`
  for context size, resetting state on `/clear`, `/resume`, fork.
- The lamp in Desktop is an `Svg` 3 px dot in the banui token color (attention `#2F6BFF` on page, the dark-theme
  value swapped as banui does); in the terminal a `●` in the nearest named color. Breathing in Desktop if the
  renderer animates; otherwise a steady lamp.
- The lamp line sits in `AbovePrompt` together with waypoints' rows; it yields to surveys and stays out while a
  turn runs only if waypoints' band needs the space (the builder checks how two `AbovePrompt` renders stack).

## Left to the builder

- TTL detection (1 h vs 5 min), as cache-keeper does it, with a fallback of 60 min.
- Exact tick interval (cache-keeper uses 30 s) and the ping margin before expiry.
- How "last own prompt" is tracked (`prompt.submit` on the main loop).
- Test layout, following `plugins/waypoints/tests/`.
- Wording in English for `language: en`.
