# cache-lamp: a "time to /compact" hint

## Intent

The owner compacts by hand with the built-in `/compact`, at moments they choose. They want the lamp to say when a session has grown big enough that it is time. Nothing compacts on its own: an automatic compaction can land in the middle of work and break it.

## Goals

- When this session's context is at or over a threshold, the lamp line shows a hint: `· пора /compact` (ru) or `· time to /compact` (en).
- The threshold is an option, `compactHint`, default `400000` tokens. `0` turns the hint off.
- After `/compact` the context drops under the threshold and the hint goes away by itself.

## Non-goals

- No compaction by the mod, no button. `/compact` is what the owner uses.
- No changes to the summary prompt or to the engine's auto-compact window.
- No hint on neighbours' rows and none in `/cache-lamp`'s list.
- No toast, no sound.

## Anti-goals

- The hint must never trigger or delay anything: it is text only.
- It must not change the lamp's colour: the lamp stays about the cache.

## Approaches

1. **Mod compacts by itself between turns** at a threshold. Rejected by the owner: they want to choose the moment.
2. **A button in the lamp line** that runs the compaction. Rejected: it does what `/compact` does, adds code, and loses `/compact`'s focus text.
3. **A text hint in the lamp line** (picked). Cheapest, cannot interfere with work, leaves the moment to the owner.

## Decided

- Hint text: `пора /compact` / `time to /compact`, after the line's own text and after a stopped keep-warm reason, joined with ` · `.
- Drawn not dimmed, so it stands out on the grey line. Same on terminal and desktop.
- Shown in any lamp state (warm, kept, cooling, cold) while `ctx >= compactHint` and `compactHint > 0`. Before the first request the whole line is hidden, as now.
- Option in `plugin.json` `userConfig` and in the README options table.

## Left to the builder

- Exact JSX placement, as long as the hint is its own `Text` after the line's text.
- A non-number option falls back to the default, as the other options do; a negative one counts as off.
