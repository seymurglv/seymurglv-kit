# cache-lamp compact hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The lamp line shows `· пора /compact` / `· time to /compact` while this session's context is at or over `compactHint` tokens.

**Architecture:** A new `compactHint` option joins `Options`; `Words` gains a `hint` string; the `AbovePrompt` render appends one undimmed `Text` after the line's text when `me.ctx >= compactHint > 0`. Nothing else changes.

**Tech Stack:** Claude Code function-hooks mod (TSX), `claude-code/testing`.

**Spec:** `docs/superpowers/specs/2026-11-24-cache-lamp-compact-hint-design.md`

## Global Constraints

- Option name `compactHint`, type number, default `400000`; `0` or less = off; a non-number falls back to `400000`.
- Copy: ru `пора /compact`, en `time to /compact`; drawn as ` · ` + hint.
- The hint is text only: no compaction, no toast, no lamp colour change, not on neighbours, not in `/cache-lamp`.
- All paths below are relative to `plugins/cache-lamp/`.

## Review Focus

- Context exactly at the threshold (`ctx === compactHint`): the hint shows.
- `compactHint: 0`: never shown, even for a huge session.
- A stopped keep-warm reason and the hint together: the reason first, then the hint.
- A cooling (lit, amber) line over the threshold: the hint still shows.
- Context still unknown (`ctx` 0 before the first request): nothing drawn, as now.

---

### Task 1: The hint

**Files:**
- Modify: `types/index.d.ts` (`Options`)
- Modify: `hooks/words.ts` (`Words`, `Copy`, `COPY`, `build`)
- Modify: `hooks/register.tsx` (`opts` in `register`, the own-line `Box` in the `AbovePrompt` hook)
- Modify: `.claude-plugin/plugin.json` (`userConfig`)
- Modify: `README.md` (Options table)
- Test: `tests/lamp.test.tsx`

**Interfaces:**
- Produces: `Options = { bigTokens: number; keepWarmHours: number; compactHint: number }`; `Words.hint: string`.

- [ ] **Step 1: Write the failing tests** in `tests/lamp.test.tsx`, in the lamp-line section, each over `SURFACES` like the existing line tests:

```tsx
const HINT = /^ · пора \/compact$/

test('over compactHint the line says "пора /compact"', { options: { language: 'ru', compactHint: 150_000 } }, async ($, on) => {
  engine(on); await start($); await request($)          // ctx = CTX = 180k
  // ui.find({ type: 'Text', text: HINT }) is defined on terminal and desktop
})
test('at exactly compactHint the hint shows', { options: { language: 'ru', compactHint: CTX } }, ...)   // defined
test('under the default 400k there is no hint', RU, ...)                                                 // CTX 180k: undefined
test('compactHint 0 turns the hint off', { options: { language: 'ru', compactHint: 0 } }, ...)            // undefined
test('a stopped reason comes before the hint', { options: { language: 'ru', compactHint: 150_000 } }, ...)
  // idleBig, seen.fork = 'rebuild', advance 56 min; the own line's texts in order:
  // dump(ui) has the stopped reason's index < the hint's index
test('a cooling line over the threshold keeps the hint', { options: { language: 'ru', compactHint: 150_000 } }, ...)
  // request, advance 57 min (cooling, bigTokens default 100k): HINT defined
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test plugins/cache-lamp`
Expected: the four "shows/keeps/before" tests FAIL (no hint drawn); the two "no hint" tests PASS.

- [ ] **Step 3: Add the option, the word and the drawing**
  - `types/index.d.ts`: `compactHint: number` in `Options`.
  - `register.tsx` `opts`: `compactHint: typeof options?.compactHint === 'number' ? options.compactHint : 400_000`.
  - `words.ts`: `hint: string` on `Words` and `Copy`; ru `'пора /compact'`, en `'time to /compact'`; `build` passes `c.hint`.
  - `register.tsx` render: after the own-line text `Box`, when `opts.compactHint > 0 && me.ctx >= opts.compactHint`, a `<Text size={size}>{' · ' + words.hint}</Text>` (no `dimColor`), inside the same `flexShrink={0}` box so it is never truncated.
  - `plugin.json` `userConfig.compactHint`: `{ "type": "number", "title": "Compact hint, in tokens", "description": "From this much context the lamp line says it is time to /compact. 0 turns the hint off.", "required": false, "default": 400000 }`.
  - `README.md` Options table row: `` | `compactHint` | `400000` | From this much context the lamp line says it is time to `/compact`; `0` turns it off | ``.

- [ ] **Step 4: Run the tests, validate and type-check**

Run: `claude plugin test plugins/cache-lamp` → Expected: all pass (61).
Run: `claude plugin validate plugins/cache-lamp` → Expected: `Validation passed` (the existing ICON_MISSING warning only).
Run: `tsc -p <scratch tsconfig>` over `hooks` and `types` with the engine's `claude-code.d.ts` → Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add plugins/cache-lamp docs/superpowers
git commit -m "cache-lamp: hint 'time to /compact' over compactHint tokens"
```
