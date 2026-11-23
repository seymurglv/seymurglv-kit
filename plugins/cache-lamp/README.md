# cache-lamp

One quiet line above the prompt box shows the state of the session's prompt cache. A big cache is kept warm while you are away.

Every message re-reads the whole session. From a warm cache that is cheap. Once the cache goes cold (after 1 hour idle on a subscription, 5 minutes on the API's short TTL) the next message rebuilds the whole context and eats the usage limit.

This session on the left, the neighbours that need a look on the right:

```
● 42 min · 51k                      sglv 357k ●   unbluffed 226k ●
```

The dot is a banui lamp: it is blue and breathes only when a big cache is about to cool. In every other state it is a quiet grey dot. The line sits above waypoints' suggestions.

## States

| State | Dot | Line |
| --- | --- | --- |
| warm | grey | `42 min · 180k` |
| kept warm by the plugin | grey | `kept until 17:40 · 180k` |
| cooling (big session only) | blue, breathing | `cools in 4 min · 180k` |
| cold | grey | `cold · 180k` |
| no request yet | nothing is drawn | |

Numbers are tokens, not dollars: on a subscription tokens are what the limit counts. A session under `bigTokens` shows only the line: never the blue lamp, never a warning, never a ping. Its rebuild is cheap.

## Other sessions

Each session writes a heartbeat to the plugin's shared store, and every session reads the others.

- On the right of this session's line come the other sessions that need a look, cooling or kept warm: the folder, the context size and a lamp (blue when cooling). Sessions that share a folder are numbered (`sglv`, `sglv 2`). Only sessions seen in the last minute count, so a closed one leaves within a minute.
- A cold session leaves the line. Its own lamp still says so.
- `/cache-lamp` prints every open session, this one first, cold ones included.

## Warning

Before a big cache goes cold, one toast says so, once per cooling. The window is 5 minutes on the 1-hour TTL and 1 minute on the 5-minute TTL (a longer one would keep the lamp lit all the time).

A cache that will be kept warm gets no warning. The toast shows in one session only: the one where you sent your latest own prompt, as the best guess of where you are. This stops copies from stacking.

## Keep warm

A session is kept warm when all of this holds:

- its context is at least `bigTokens`;
- its TTL is 1 hour;
- your last own prompt in it was less than `keepWarmHours` ago.

When 6 minutes of the TTL are left and no turn is running, the plugin sends a hidden ping that reads the cache and restarts its timer. Nothing is written into the chat. After `keepWarmHours` without a prompt from you, keep-warm ends and the normal warning applies.

Limits:

- On the 5-minute TTL there is no keep-warm: 12 pings an hour would cost more than the rebuild they avoid.
- If a ping rebuilt the cache instead of reading it (more than 10% of its tokens written, not read), or got no answer, keep-warm stops for that session. The line says why.
- `/compact`, `/clear`, `/resume` and a fork reset the session's cache state: the lamp is dark until the next answer.
- The TTL is inferred from the session's own requests, 60 minutes until it learns otherwise.
- The plugin never sends a prompt of its own into the chat.

## How it works

It is a function-hooks plugin (`hooks/register.tsx`):

- `turn.step` (main loop only): each request's usage gives the cache's age, the context size and the TTL.
- `turn.complete`: reads the session's context size from `$.session.usage`.
- Every 30 seconds `$.clock.every` refreshes this session's heartbeat, pings a cache that is about to cool, and shows the warning.
- Heartbeats live in the plugin's `$.store` under `hb:<session>`. One silent for an hour is deleted.
- The ping is a `$.model.fork`, so it reads the session's cache.
- `ui.render` on `AbovePrompt` draws the lamp line and the neighbours. It stays out while a turn runs or a survey is up.
- `prompt.submit` from you (not a subagent, not a tool) marks your last own prompt.

## Install

```
/plugin install cache-lamp --marketplace seymurglv/seymurglv-kit
```

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `bigTokens` | `100000` | A session with at least this much context counts as big: it can be warned about and kept warm |
| `keepWarmHours` | `3` | Hours after your last own prompt that a big session is kept warm |
| `language` | `en` | Language of the lamp's own words: `en` or `ru` |

## Checks

```bash
claude plugin validate plugins/cache-lamp
claude plugin test plugins/cache-lamp
```

## Credits

Mechanics after Nate Herk's cache-keeper (MIT).
