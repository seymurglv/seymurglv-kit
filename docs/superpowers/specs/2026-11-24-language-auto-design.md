# cache-lamp and waypoints: `language: auto`

## Intent

Both mods draw words of their own (cache-lamp's lamp line, toasts and `/cache-lamp`; waypoints' hint and key line). Today they default to English and need `ru` set by hand, mod by mod. The owner wants them to speak the system's language out of the box, and always the same language in both.

## Goals

- A new `language` value `auto`, the default in both mods.
- `auto` follows the system locale read through `Intl.DateTimeFormat().resolvedOptions().locale`: a locale starting with `ru` gives Russian, anything else English.
- An explicit `en` or `ru` wins over `auto`. An existing stored `ru` (waypoints today) keeps working.
- Both mods resolve `auto` by the same rule, so on one machine they always agree.
- Changing the option mid-session keeps working as now (the config menu reloads the module).

## Non-goals

- No shared switch between the two mods; each keeps its own `language` option.
- No reading Claude Code's own `language` setting or `LANG`/`LC_ALL` (empty on Windows; `Intl` already covers the system locale).
- No new languages.
- waypoints' suggestions keep following the conversation's language; only the band's own words change.

## Anti-goals

- A broken or missing `Intl` must never stop a mod from loading: it falls back to English.
- Tests must not depend on the machine's locale.

## Approaches

1. **Same rule in each mod** (picked): each mod resolves `auto` itself with identical code. Simple, the mods stay independent (waypoints installs without cache-lamp), and they agree because they read the same system.
2. **One switch for both**: a shared source (Claude Code's `language` setting or a shared file). Rejected: couples the mods and ties their words to unrelated settings.

## Decided

- `plugin.json` `language`: `"options": ["auto", "en", "ru"]`, `"default": "auto"`, in both mods.
- An unknown or missing value counts as `auto` (it was English before).
- The locale is read once when the module loads, as the language is today.
- The resolver is a pure function of `(option, locale)` so tests pass the locale in; the `Intl` read is a separate one-line helper.
- Tests that assert English words state `language: 'en'` explicitly.
- READMEs: the options rows say `auto` and what it does.

## Left to the builder

- Where the two helpers sit in each `words.ts`.
- The exact README wording, within the decided meaning.
- Locale case and separators (`ru-RU`, `ru_RU`, `RU`): matched case-insensitively on the leading `ru`.
