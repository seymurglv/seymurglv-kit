# seymurglv-kit rebuild: pick-what-you-install and carry this Mac's settings

Date: 2026-11-23. Status: built and merged into main (approved by the owner).

## As built

- **Article domains out.** At the owner's request `permissions.allow` in `settings/claude.json` carries no article
  sites (NCBI, europepmc and the like); the only `WebFetch` domains left are `support.google.com` and
  `code.claude.com`.
- **The fragment is keyed by part.** `settings/claude.json` has one object per part id (`cache-lamp`, `waypoints`,
  `taste-skill`, `banui`, `rm-guard`, `settings`); a part's keys are merged only when that part is ticked.
- **Menu** in `curses`. `--list` reads `~/.claude/plugins/installed_plugins.json` for plugins, `~/.claude/hooks`
  for the rm guard and `settings.json` for the rest.
- **Flags** besides goal 1's: `--local` and `--force-settings` (see Builder's calls).
- **Tests** in `tests/` (`test_merge`, `test_manifest`, `test_install`, `test_cli`), run with
  `python3 -m unittest` against a temporary HOME.
- The installer has not been run on the owner's Mac yet; his settings were already in place by hand.

## Intent

Today "install everything" installs everything, and the kit still carries what the owner no longer uses
(`agent-desktop`, `modern-web-guidance`). The settings that make this Mac work the way he likes (the iTerm2
`cc-status` hook, plugin order so cache-lamp's lamp sits above waypoints, `language: ru` for the mods, the Concise
output style and the rest) live only in `~/.claude/settings.json` and would be lost on a new machine.

The rebuilt kit lets him tick what to install, carries his Claude Code settings with it, and keeps banui as a
separate, optional part.

## Goals

1. **`install.py` with a menu.** One Python 3 file at the repo root (no third-party packages). Run with no flags in
   a terminal, it shows a checklist of the kit's parts with the current pick, lets him toggle, then installs only the
   ticked ones:

   ```
   seymurglv-kit — что ставим            ↑↓ выбор · пробел отметить · Enter поставить · q выход
    [x] cache-lamp        лампа кэша над полем ввода
    [x] waypoints         подсказки следующего шага
    [x] taste-skill       дизайн сайтов (из репозитория Leonxlnx)
    [ ] banui             дизайн-язык banui (необязательно)
    [x] rm guard          удаление только в Корзину
    [x] settings          настройки Claude Code этого Mac
   ```

   Flags for agents and repeat runs: `--all`, `--only a,b`, `--skip a,b`, `--dry-run` (prints every step, changes
   nothing), `--list` (parts and whether each is installed). Without a terminal (an agent running it) and without
   flags it refuses with a one-line hint to pass `--all` or `--only`.
2. **A manifest, `kit.json`.** The menu, the flags and the README table all come from one list of parts: id, title
   (ru), kind (`plugin` | `hook` | `settings`), default ticked or not, and what installing it means.
3. **Settings carried, personal parts removed.** `settings/claude.json` holds a fragment of `~/.claude/settings.json`
   that install.py merges in. It carries: `includeCoAuthoredBy`, `permissions.allow` (inside the `settings` part,
   no separate tick; README lists what it allows), the
   `cc-status` hooks, `enabledPlugins` (with cache-lamp before waypoints), `extraKnownMarketplaces` for the kit's
   plugins, `pluginConfigs` (`language: ru` for cache-lamp and waypoints, waypoints' other options), `outputStyle`,
   `autoUpdatesChannel`, `tui`, `theme`, `skipWorkflowUsageWarning`, `switchModelsOnFlag`, `agentPushNotifEnabled`,
   `autoMode.soft_deny`. It never carries `autoMode.environment`, any `/Users/<name>` path (paths are written with
   `~` and expanded at install time), the global `~/.claude/CLAUDE.md`, keys, or anything under `~/.claude/projects`.
4. **Merge, never replace.** Before any write install.py copies the file to `<name>.before-kit-<YYYY-MM-DD>.json`
   next to it. Objects merge key by key; lists of hooks and permissions are unioned without duplicates; an existing
   value the fragment also sets is replaced only for scalar keys, and every replaced value is printed. The result must
   parse as JSON. A second run with the same picks changes nothing (prints "already in place").
5. **Plugin order.** After installing plugins, install.py rewrites `enabledPlugins` so the kit's plugins appear in
   manifest order (cache-lamp before waypoints) and the others keep their relative order after them.
6. **`cc-status` only where iTerm2 is.** The `cc-status` hook entries are merged only if
   `~/.config/iterm2/cc-status` (or `/Applications/iTerm.app/Contents/Resources/utilities/cc-status`) exists;
   otherwise that part is skipped with a one-line reason.
7. **banui optional.** `libraries/banui` moves to `optional/banui`; its marketplace entry stays (path updated) and its
   menu item is unticked by default. README describes it in its own "Optional" section.
8. **Clean list.** `agent-desktop` and `modern-web-guidance` leave `marketplace.json`, README and AGENTS.md.
9. **AGENTS.md shrinks** to: "run `python3 install.py --list`, ask the person which parts, run with `--only`", plus the
   OpenCode section for the skills that work there (banui, taste-skill) and the rm guard deny rules, as today.

## Non-goals

- No GUI, no TUI library: the menu is plain ANSI on stdin (curses from the standard library is allowed).
- No uninstall command. Removing a part stays manual (`/plugin uninstall`).
- No sync back from the Mac to the kit (`--export`); the fragment is edited by hand when settings change.
- No Windows or Linux testing in this round; the code stays portable (pathlib, no shell-outs to macOS-only tools
  except where already used by trash.py).
- No change to the plugins themselves.

## Anti-goals

- Any personal data reaching the public repo: the fragment is checked by a test that fails on `/Users/`,
  `autoMode.environment`, an e-mail address, or a key-like string.
- A settings.json that no longer parses, or settings lost because a list was overwritten.
- Installing something that was not ticked.

## Constraints

- The repo `seymurglv/seymurglv-kit` is public.
- Owner rules: nothing deleted without his yes (Trash only), settings copied before change, merge not replace
  (AGENTS.md rules today).
- Plugins are installed through the Claude Code CLI: `claude plugin marketplace add|update` and
  `claude plugin install <name>@seymurglv` (or `@taste-skill`). install.py checks `claude` is on PATH first.
- The rm guard part copies `setup/hooks/block_rm.py` and `trash.py` to `~/.claude/hooks/`, runs both self-tests, and
  merges its `PreToolUse` entry (today's AGENTS.md steps, now in code).

## Approaches

- **A. The agent drives the pick** from a manifest and merges settings by the rules in AGENTS.md. No new code, but
  each run differs and the settings merge cannot be tested.
- **B. `install.py` with a menu and flags (picked by the owner).** One deterministic, testable installer; agents call
  it with flags; same result every run.
- **C. Manual `/plugin install` plus documented settings.** Cheapest, but settings would not carry over by
  themselves, which is the point; dropped.

## Layout after the rebuild

```text
seymurglv-kit
├── install.py            the installer (menu + flags)
├── kit.json              the parts list
├── plugins/              cache-lamp, waypoints
├── optional/banui/       banui library and skill, off by default
├── settings/claude.json  Claude Code settings fragment, nothing personal
├── setup/hooks/          rm guard
├── guides/skills/        the skill standard (unchanged)
├── tests/                install.py tests (merge, order, personal-data check, dry-run)
├── AGENTS.md · README.md
```

## Builder's calls (settled after the builder check)

- **taste-skill** installs as `taste-skill@seymurglv` (the kit's marketplace entry pointing at Leonxlnx's repo). If
  `taste-skill@taste-skill` is already enabled, it counts as installed and nothing is installed twice; the fragment
  does not carry the separate `taste-skill` marketplace.
- **Settings follow the picks.** Each plugin part in `kit.json` names the settings keys that belong to it
  (`enabledPlugins` entry, `pluginConfigs` entry); they are merged only when that part is ticked. The `settings` part
  covers only the general keys. `cc-plugin-you-should-know@builtin` is not carried.
- **`--all`** means every part, banui included. The menu's default ticks are a separate thing.
- **Marketplace source** is the GitHub repo `seymurglv/seymurglv-kit`; `--local` registers this clone instead, for
  testing before a push. If `seymurglv` is already registered, install.py runs `marketplace update` and leaves the
  source alone.
- **Hooks carried:** exactly the `cc-status` entries (the events they sit on today, no matcher) and the rm guard's
  `PreToolUse` entry. Nothing else, no `statusLine`. A hook counts as present when an existing entry's command ends
  with the same script name (`cc-status`, `block_rm.py`), whatever interpreter path it uses.
- **`autoMode.soft_deny`** is written only when the key is absent.
- **No `permissions.defaultMode`** (owner's decision): auto mode is Claude Code's default now, so the fragment
  does not set it.
- **Scalars on a re-run:** a scalar is written only when the key is absent or already equal. If the machine has a
  different value, install.py keeps it and prints `kept yours: theme=dark (kit: auto)`; `--force-settings` overwrites.
  So a second run never reverts the owner's own changes.

## Left to the builder

- Menu mechanics (curses vs raw ANSI), as long as it works in iTerm2 and Terminal.app.
- Exact merge helper shape, as long as goal 4's rules hold and are tested.
- How `--list` detects "installed" (installed_plugins.json, files in ~/.claude/hooks, keys present in settings).
- Test runner: `python3 -m unittest`, run against a temporary HOME.
