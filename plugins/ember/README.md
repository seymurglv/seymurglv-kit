# ember

How warm this chat's prompt cache is, in one quiet row above the prompt box.

Every message re-reads the whole context. From the prompt cache that costs a
tenth of input or less. Once the cache goes cold (an hour idle on a
subscription, five minutes on the API's default TTL) the next message writes the
whole context again at 1.25x to 2x input. A read restarts the TTL, so a one-word
ping just before it ends costs a small part of that rewrite.

| State | The row says | Buttons |
|---|---|---|
| Warm | green ring with the minutes left · `Warm · goes cold at 23:40` · tokens in the cache | quiet Handoff |
| Cooling (last 10 minutes) | amber ring · `Cold in 6 min` · cold-restart and ping cost | **Keep warm**, quiet Handoff |
| Kept warm | green ring · `Warm · keeping until 23:40` · pings so far and their cost | quiet Release, **Handoff** |
| Cold | empty ring · `Cache is cold · 12 min ago` · what the next message rewrites | **Handoff** |
| Something went wrong | amber `! ...` in place of the first words | as above |

The ring is an `Svg` (Claude Desktop, VS Code, mobile) with the digits drawn from
Bebas Neue outlines, so it needs no font and no network. The terminal draws it
as text: `41 min`.

## Commands

| Command | What it does |
|---|---|
| `/board` | A side pane with every local chat that runs ember: cache dot, name, context fill, warmth left, today's spend. Hovering a warm row offers Keep / Release for that chat. |
| `/ember` | This chat's figures. `/ember keep [hours]`, `/ember release`, `/ember name <name>` (the board's name for the chat). |
| `/ember:handoff` | ember's handoff skill (the band's Handoff button runs it too). When its answer is in, the row offers **Clear and continue** (runs `/clear`, then sends the handoff as the fresh chat's first message) and Keep chat. The handoff is written in English unless you ask for another language. |

When another plugin already holds `/board` (cache-keeper does), ember registers
`/ember-board` instead.

## Settings

| Option | Default | Meaning |
|---|---|---|
| `ttl` | `auto` | Cache lifetime: `auto` starts at 60 minutes and measures; or `5`, `60`. |
| `autoKeepTokens` | `300000` | A chat at least this big is kept warm by itself in its last minutes; `0`: never by itself. |
| `keepWarmHours` | `4` | How long keeping warm lasts before it stops by itself. |
| `language` | `en` | ember's own words (the band, the board, toasts, command answers): `en` or `ru`. |

Pings cost money (or plan usage): one ping reads the context from the cache,
about $0.08 for 412k tokens on Opus 5.5. A ping that writes the cache instead of
reading it stops the keeping, with a `!` on the row.

## What it keeps

- `$.state` (this session, survives a reload): the cache figures, the board, the
  handoff text until it is sent or dropped.
- `$.store` (across sessions): one heartbeat per running chat (`hb:<session>`:
  name, model, token counts, times; no message text) and today's spend per
  chat (`spent:<date>:<session>`). Other dates' keys are dropped.
- Nothing on disk, no secrets, no transcript text. The handoff never leaves the
  chat it is written in and the next one.

## Install

At the prompt of a terminal session:

```
/plugin install ember --marketplace seymurglv/seymurglv
```

From a shell:

```
claude plugin install ember --marketplace seymurglv/seymurglv
```

In Claude Desktop, where `/plugin` does not run: + next to the prompt box,
Plugins, Add marketplace `seymurglv/seymurglv`, then Add plugin.

## Develop

```
claude plugin validate plugins/ember
claude plugin test plugins/ember
```

Type-check with the `tsconfig.json` from the header of the API types file the
plugin-authoring skill writes (or `tsc -p plugins/ember` once the engine has
laid `.claude-plugin/types/`).

