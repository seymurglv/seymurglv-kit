# language: auto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cache-lamp and waypoints default to `language: auto`, which follows the system locale (`ru*` → Russian, else English); an explicit `en`/`ru` wins.

**Architecture:** Each mod's `hooks/words.ts` gains a pure `pickLanguage(option, locale)` and a `systemLocale()` that reads `Intl`; `wordsFor(option, locale)` uses them, and `register` passes `systemLocale()`. Same code in both mods, no shared module.

**Tech Stack:** Claude Code function-hooks mods (TS/TSX), `claude-code/testing`.

**Spec:** `docs/superpowers/specs/2026-11-24-language-auto-design.md`

## Global Constraints

- `plugin.json` `language`: `"options": ["auto", "en", "ru"]`, `"default": "auto"` in both mods.
- `'ru'` → Russian, `'en'` → English, anything else (`'auto'`, `undefined`, `'fr'`) → by locale.
- Locale rule: `/^ru([-_]|$)/i` → Russian; no locale or any other → English.
- `systemLocale()` never throws: any error → `undefined`.
- Tests never depend on the machine's locale: a test asserting English words states `language: 'en'`.

## Review Focus

- `Intl` missing or throwing: the mod loads and speaks English.
- A locale like `ru_RU`, `RU`, `ru`: Russian; `uk-UA`, `en-US`, `''`: English.
- A stored value outside the options (`"fr"`): treated as `auto`, never a crash.
- The suite run on a Russian-locale machine and on an English one gives the same result.
- waypoints' suggestions still follow the conversation's language (its suggester prompt is untouched).

---

### Task 1: cache-lamp

**Files:**
- Modify: `plugins/cache-lamp/hooks/words.ts` (`wordsFor`, new `pickLanguage`, `systemLocale`)
- Modify: `plugins/cache-lamp/hooks/register.tsx` (the `wordsFor(...)` call in `register`)
- Modify: `plugins/cache-lamp/.claude-plugin/plugin.json`, `plugins/cache-lamp/README.md` (Options row)
- Test: `plugins/cache-lamp/tests/words.test.ts`, `plugins/cache-lamp/tests/lamp.test.tsx`

**Interfaces:**
- Produces: `pickLanguage(option: unknown, locale: string | undefined): Language`; `systemLocale(): string | undefined`; `wordsFor(option: unknown, locale?: string): Words` (locale left out = English for `auto`).

- [ ] **Step 1: Write the failing tests** in `tests/words.test.ts`, replacing `wordsFor falls back to en`:

```ts
test('an explicit language wins over the locale', () => {
  expect(pickLanguage('ru', 'en-US')).toBe('ru')
  expect(pickLanguage('en', 'ru-RU')).toBe('en')
})
test('auto, missing or unknown follow the locale', () => {
  for (const o of ['auto', undefined, 'fr']) {
    expect(pickLanguage(o, 'ru-RU')).toBe('ru')
    expect(pickLanguage(o, 'en-US')).toBe('en')
  }
})
test('ru locales in any spelling, others English', () => {
  for (const l of ['ru', 'RU', 'ru_RU', 'ru-RU']) expect(pickLanguage('auto', l)).toBe('ru')
  for (const l of ['uk-UA', 'rus', '', undefined]) expect(pickLanguage('auto', l)).toBe('en')
})
test('wordsFor follows pickLanguage', () => {
  expect(wordsFor('auto', 'ru-RU').none).toBe('cache-lamp: открытых сессий нет')
  expect(wordsFor('fr', 'en-US').none).toBe('cache-lamp: no open sessions')
  expect(wordsFor(undefined).command).toBe('Cache of every open session')
})
test('systemLocale returns a string or undefined, never throws', () => {
  const l = systemLocale()
  expect(l === undefined || typeof l === 'string').toBe(true)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test plugins/cache-lamp`
Expected: the new tests FAIL (`pickLanguage` / `systemLocale` not exported).

- [ ] **Step 3: Implement** in `hooks/words.ts` the three signatures above (`systemLocale` wraps `Intl.DateTimeFormat().resolvedOptions().locale` in try/catch); `register.tsx` calls `wordsFor(options?.language, systemLocale())`; `plugin.json` `language` gets the Global Constraints options and default and a description naming `auto`; README row: `` | `language` | `auto` | Language of the lamp's own words: `auto` (the system's), `en` or `ru` | ``.

- [ ] **Step 4: Pin English where tests assert it**

Run: `claude plugin test plugins/cache-lamp`. On a Russian-locale machine every test that now fails only because the words came out Russian gets `language: 'en'` in its options (merged into existing `options`, or a new `{ options: { language: 'en' } }`). Expected after: all pass. Then validate (`claude plugin validate plugins/cache-lamp`, passes with the ICON_MISSING warning only) and type-check (`tsc` over `hooks` and `types` with the engine's `claude-code.d.ts`: no errors).

- [ ] **Step 5: Commit**

```bash
git add plugins/cache-lamp
git commit -m "cache-lamp: language auto follows the system locale"
```

### Task 2: waypoints

**Files:**
- Modify: `plugins/waypoints/hooks/words.ts`, `plugins/waypoints/hooks/register.tsx` (the `wordsFor(...)` call), `plugins/waypoints/.claude-plugin/plugin.json`, `plugins/waypoints/README.md` (line 33 and the Options row)
- Test: new `plugins/waypoints/tests/words.test.ts`; `plugins/waypoints/tests/band.test.tsx`

**Interfaces:**
- Produces: the same three signatures as Task 1, in waypoints' `words.ts`, with waypoints' own `Words`.

- [ ] **Step 1: Write the failing tests** in a new `tests/words.test.ts`: the first three tests of Task 1 verbatim (they test `pickLanguage` alone), the `systemLocale` test, and `wordsFor('auto', 'ru-RU')` vs `wordsFor('fr', 'en-US')` giving different words (compare one field of waypoints' `Words`).

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test plugins/waypoints`
Expected: FAIL (not exported).

- [ ] **Step 3: Implement** as in Task 1, in waypoints' files. README line 33: the band's own words follow the system's language by default (`auto`), or `en`/`ru` when set; suggestions still follow the conversation. Options row: `` | `language` | `auto` | Language of the band's own words: `auto` (the system's), `en` or `ru` | ``.

- [ ] **Step 4: Pin English where tests assert it, then run, validate and type-check** as Task 1 Step 4, for `plugins/waypoints`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/waypoints
git commit -m "waypoints: language auto follows the system locale"
```
