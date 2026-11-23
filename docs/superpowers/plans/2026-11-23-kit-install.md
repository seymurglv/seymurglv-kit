# seymurglv-kit install.py Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild seymurglv-kit so `python3 install.py` installs only the parts ticked in a menu (or named in flags) and carries this Mac's Claude Code settings without anything personal; banui becomes optional.

**Architecture:** One standard-library Python 3 file `install.py` at the repo root: a pure settings-merge core, a manifest loader (`kit.json` + `settings/claude.json`), installer actions that call the `claude` CLI through an injectable runner, and a CLI with a curses menu. Tests in `tests/` with `unittest`, a temporary HOME and a fake runner.

**Tech Stack:** Python 3 standard library only (json, argparse, curses, shutil, subprocess, pathlib, re, unittest); Claude Code CLI (`claude plugin …`).

**Spec:** `docs/superpowers/specs/2026-11-23-kit-install-design.md`

## Global Constraints

- One file `install.py`, Python 3 standard library only.
- Part ids (menu order = this order): `cache-lamp`, `waypoints`, `taste-skill`, `banui`, `rm-guard`, `settings`. Default ticked: all but `banui`.
- Menu header `seymurglv-kit — что ставим`; titles: `лампа кэша над полем ввода`, `подсказки следующего шага`, `дизайн сайтов (из репозитория Leonxlnx)`, `дизайн-язык banui (необязательно)`, `удаление только в Корзину`, `настройки Claude Code этого Mac`.
- Flags: `--all` (every part, banui included), `--only a,b`, `--skip a,b`, `--dry-run`, `--list`, `--local`, `--force-settings`.
- Backup before any write: `<name>.before-kit-<YYYY-MM-DD>.json` beside the file (a number is added if taken).
- Never carried: `autoMode.environment`, any `/Users/<name>` path (fragment uses `~`, expanded at install), global CLAUDE.md, keys, `permissions.defaultMode`, `cc-plugin-you-should-know@builtin`, `statusLine`.
- Scalars: set only when absent; equal → nothing; different → keep and print `kept yours: <key>=<value> (kit: <value>)` unless `--force-settings`.
- `autoMode.soft_deny` written only when the key is absent.
- Hooks: a hook is present when an existing entry's command (or its last arg) ends with the same script name (`cc-status`, `block_rm.py`).
- Plugin install ids: `cache-lamp@seymurglv`, `waypoints@seymurglv`, `taste-skill@seymurglv` (`taste-skill@taste-skill` already enabled counts as installed), `banui@seymurglv`.
- `enabledPlugins` after install: kit plugins first in manifest order, others after in their old order.
- cc-status hooks merged only if `~/.config/iterm2/cc-status` or `/Applications/iTerm.app/Contents/Resources/utilities/cc-status` exists.
- Marketplace source `seymurglv/seymurglv-kit` (GitHub); `--local` uses the clone's path; already registered → `claude plugin marketplace update seymurglv`.
- Nothing is deleted.

## Review Focus

1. `~/.claude/settings.json` missing or empty → created from the picked fragments.
2. `~/.claude/settings.json` that is not valid JSON → install.py stops before any change and says so.
3. Re-run after the owner changed a carried scalar (e.g. `theme`) → his value kept, `kept yours:` printed, file untouched otherwise.
4. `claude` not on PATH while a plugin part is picked → stops before any change, one-line reason.
5. An existing rm-guard entry using another interpreter path (`/usr/local/bin/python3` + args) → not duplicated.

---

### Task 1: Settings merge core

**Files:**
- Create: `install.py` (merge section only, plus `if __name__ == '__main__': main()` stub)
- Test: `tests/test_merge.py`

**Interfaces:**
- Produces:
  - `expand_home(obj: object, home: str) -> object` — every string starting with `~/` becomes `home + '/' + rest`, recursively.
  - `merge_settings(current: dict, fragment: dict, force: bool = False) -> tuple[dict, list[str]]` — returns a new dict and messages; never mutates inputs. Rules: dicts merge key by key; `hooks.<Event>` lists: add a fragment entry only if no existing entry in that event has a hook whose script name matches (see Global Constraints); `permissions.allow`: union, order kept, new ones appended; `autoMode.soft_deny`: set only when absent; other lists: set only when absent; scalars per Global Constraints.
  - `order_plugins(enabled: dict, order: list[str]) -> dict`.
  - `script_name(hook: dict) -> str` — basename of the last arg if `args` present, else of the command's last word.

- [ ] **Step 1: Write failing tests** (`unittest`), names and assertions:
  - `test_absent_scalar_is_set` — `merge_settings({}, {'theme': 'auto'})[0] == {'theme': 'auto'}`
  - `test_equal_scalar_no_message` — messages `== []`
  - `test_different_scalar_kept` — `({'theme':'dark'}, {'theme':'auto'})` → result theme `'dark'`, message `'kept yours: theme=dark (kit: auto)'`; with `force=True` → `'auto'`
  - `test_nested_scalar_path_in_message` — `pluginConfigs.waypoints@seymurglv.options.language` differing → message starts `kept yours: pluginConfigs.waypoints@seymurglv.options.language=`
  - `test_allow_union` — `['A','B']` + `['B','C']` → `['A','B','C']`
  - `test_soft_deny_only_when_absent` — current `['x']`, fragment `['$defaults']` → `['x']`; current absent → `['$defaults']`
  - `test_hook_not_duplicated_by_script_name` — current PreToolUse `[{'matcher':'Bash','hooks':[{'type':'command','command':'/usr/local/bin/python3','args':['/Users/x/.claude/hooks/block_rm.py']}]}]`, fragment same script via `python3` → event list length stays 1
  - `test_hook_added_to_existing_event` — current Stop has another hook → fragment cc-status entry appended, length 2
  - `test_inputs_not_mutated`, `test_idempotent` — merging the result again gives an equal dict and no messages
  - `test_expand_home` — `{'a':['~/.x', 'y']}` → `{'a':['/h/.x','y']}`
  - `test_order_plugins` — `{'w':True,'x':True,'c':True}`, order `['c','w']` → keys `['c','w','x']`
- [ ] **Step 2: Run** `python3 -m unittest discover -s tests -v` — FAIL (names missing).
- [ ] **Step 3: Implement** the four functions in `install.py`.
- [ ] **Step 4: Run** the same command — all PASS.
- [ ] **Step 5: Commit** `git add install.py tests/test_merge.py && git commit -m "kit: settings merge core for install.py"`

### Task 2: Manifest, settings fragment, privacy check

**Files:**
- Create: `kit.json`, `settings/claude.json`, `tests/test_manifest.py`
- Modify: `install.py` (loader)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `kit.json`: `{"parts": [{"id", "title", "kind": "plugin"|"hook"|"settings", "default": bool, "plugin"?: "<id>@<market>", "alias"?: ["taste-skill@taste-skill"]}]}` in the Global Constraints order.
  - `settings/claude.json`: an object keyed by part id; each value is a settings fragment. `settings` holds: `includeCoAuthoredBy: false`, `permissions.allow` (copy today's list from `~/.claude/settings.json` verbatim), the `cc-status` hooks on `Notification, PermissionRequest, PostToolUse, PreToolUse, SessionEnd, SessionStart, Stop, StopFailure, SubagentStop, UserPromptSubmit` with command `~/.config/iterm2/cc-status`, `outputStyle: "Concise"`, `autoUpdatesChannel: "latest"`, `tui: "fullscreen"`, `theme: "auto"`, `skipWorkflowUsageWarning: true`, `switchModelsOnFlag: false`, `agentPushNotifEnabled: true`, `autoMode.soft_deny: ["$defaults"]`, `extraKnownMarketplaces.seymurglv` (github `seymurglv/seymurglv-kit`, `autoUpdate: true`). `cache-lamp`: `enabledPlugins` + `pluginConfigs` `{options:{language:"ru"}}`. `waypoints`: `enabledPlugins` + `pluginConfigs` `{options:{minAnswerChars:80, suggestSkills:true, language:"ru"}}`. `taste-skill`, `banui`: `enabledPlugins` only. `rm-guard`: `hooks.PreToolUse` `[{matcher:"Bash", hooks:[{type:"command", command:"python3", args:["~/.claude/hooks/block_rm.py"]}]}]`.
  - `Part` dataclass (`id, title, kind, default, plugin: str|None, alias: list[str]`) and `load_kit(root: Path) -> tuple[list[Part], dict]` (parts, fragments by id); raises `ValueError` if a part has no fragment entry or ids repeat.

- [ ] **Step 1: Write failing tests:**
  - `test_parts_order_and_defaults` — ids `== ['cache-lamp','waypoints','taste-skill','banui','rm-guard','settings']`; defaults all True except `banui`
  - `test_every_part_has_a_fragment`
  - `test_fragment_has_nothing_personal` — the raw text of `settings/claude.json` has no `/Users/`, no `"environment"`, no `defaultMode`, no `cc-plugin-you-should-know`, no `statusLine`, no e-mail (`[\w.+-]+@[\w-]+\.[\w.]+` outside `@seymurglv`/`@taste-skill` plugin ids), no key-like string (`sk-`, `AIza`, `ghp_`, 32+ hex)
  - `test_cache_lamp_before_waypoints` — index order in `kit.json`
- [ ] **Step 2: Run** `python3 -m unittest discover -s tests -v` — FAIL.
- [ ] **Step 3: Create** the two JSON files and `load_kit`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `kit: parts manifest and settings fragment without personal data`

### Task 3: Installer actions

**Files:**
- Modify: `install.py`
- Test: `tests/test_install.py`

**Interfaces:**
- Consumes: Task 1 functions, Task 2 `Part`, `load_kit`.
- Produces:
  - `Runner = Callable[[list[str]], tuple[int, str]]`; `run_cmd` default uses `subprocess.run`.
  - `install(picked: list[Part], fragments: dict, root: Path, home: Path, run: Runner, dry_run: bool = False, local: bool = False, force: bool = False) -> list[str]` — returns printed lines in order. Steps: (1) preflight — `~/.claude/settings.json` parses (or is missing/empty), `shutil.which('claude')` when a plugin part is picked (injectable as `which`), else return `['stop: …']` with no change; (2) marketplace add (`claude plugin marketplace add seymurglv/seymurglv-kit` or the root path with `local`) unless `seymurglv` is in `~/.claude/plugins/known_marketplaces.json`, else `… marketplace update seymurglv`; (3) per plugin part: skip with `already installed: <id>` if its id or an alias is in `~/.claude/plugins/installed_plugins.json`, else `claude plugin install <id>`; (4) rm-guard: copy `setup/hooks/block_rm.py` and `trash.py` to `~/.claude/hooks/` (backup an existing differing file first), run `python3 <hooks>/block_rm.py --self-test` and `python3 <hooks>/trash.py --check`; (5) settings: merge the picked parts' fragments (expand_home first; drop cc-status hooks with message `skipped cc-status: iTerm2 not found` when neither path exists), backup, write with indent 2 + newline, re-read to check it parses; nothing written and `already in place` printed when the merge changes nothing; (6) `order_plugins` with the kit plugins' ids in manifest order. With `dry_run` every step prints `would: …` and nothing is run or written.
  - `installed(parts, home) -> dict[str, bool]` for `--list`.

- [ ] **Step 1: Write failing tests** with a temp HOME, a fake runner recording commands, `which` stub:
  - `test_missing_settings_created` (Review Focus 1)
  - `test_invalid_settings_stops_before_any_change` (Review Focus 2) — no runner calls, file bytes unchanged
  - `test_rerun_keeps_owner_scalar` (Review Focus 3) — first install, edit theme to `dark`, second install → `kept yours: theme=dark (kit: auto)`, theme still `dark`
  - `test_no_claude_stops` (Review Focus 4)
  - `test_existing_rm_guard_entry_not_duplicated` (Review Focus 5)
  - `test_only_picked_parts` — pick `cache-lamp` only → runner saw one `plugin install cache-lamp@seymurglv`; settings gained only cache-lamp keys
  - `test_taste_alias_counts_as_installed`
  - `test_backup_written_before_change` — file `settings.before-kit-<today>.json` equals the old content
  - `test_cc_status_skipped_without_iterm`
  - `test_dry_run_changes_nothing` — no runner calls, no files, lines start `would:`
  - `test_second_run_already_in_place`
  - `test_plugin_order` — `cache-lamp@seymurglv` before `waypoints@seymurglv`, a foreign plugin after
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `install`, `installed`, `run_cmd`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `kit: installer actions with backups, dry run and plugin order`

### Task 4: Command line and menu

**Files:**
- Modify: `install.py`
- Test: `tests/test_cli.py`

**Interfaces:**
- Consumes: `load_kit`, `install`, `installed`.
- Produces: `parse_args(argv: list[str]) -> argparse.Namespace`; `pick(parts: list[Part], args, interactive: bool) -> list[Part] | None` (None = refuse); `menu(parts: list[Part]) -> list[Part] | None` (curses; ↑↓ move, space toggles, Enter installs, q quits → None); `main(argv=None) -> int`.
  - `--all` → all parts; `--only` → those ids; `--skip` → defaults minus those (with `--all`: all minus those); unknown id → exit 2 naming it; `--list` prints one line per part `[x] id  title` where x = installed; no flags and not a TTY → print `install.py: no terminal — pass --all or --only <ids>` and exit 2; no flags and a TTY → `menu`.
  - Exit codes: 0 done, 1 a step failed, 2 usage.

- [ ] **Step 1: Write failing tests:** `test_all_includes_banui`, `test_only`, `test_skip_from_defaults`, `test_all_with_skip`, `test_unknown_id_exit_2`, `test_no_tty_no_flags_refuses`, `test_list_marks_installed`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the four functions; `main` wires them and prints `install`'s lines.
- [ ] **Step 4: Run** — PASS; then by hand in iTerm2: `python3 install.py --dry-run` opens the menu with the Global Constraints header and ticks, Enter prints `would:` lines, `q` exits 0 with nothing done.
- [ ] **Step 5: Commit** `kit: install.py command line and menu`

### Task 5: Repository layout and docs

**Files:**
- Move: `libraries/banui` → `optional/banui` (`git mv`; `libraries/` disappears)
- Modify: `.claude-plugin/marketplace.json` (remove `agent-desktop`, `modern-web-guidance`; banui `source` `./optional/banui`), `README.md`, `AGENTS.md`, `setup/README.md`, `.gitignore` if it names the old path

- [ ] **Step 1:** `git mv libraries/banui optional/banui`; fix every path that names `libraries/banui` (`grep -rn "libraries/banui" --exclude-dir=node_modules .` must print nothing afterwards, docs/superpowers excluded).
- [ ] **Step 2:** README: Contents tree as in the spec's Layout; plugins table without agent-desktop and modern-web-guidance; an "Optional" section for banui; Install = `python3 install.py` (menu) and the flags; a "Settings it carries" list naming what `permissions.allow` allows and what is never carried; Notes keep the macOS/Windows/OpenCode lines.
- [ ] **Step 3:** AGENTS.md: Claude Code section becomes "run `python3 install.py --list`, ask which parts, run `python3 install.py --only <ids>`, report its output"; rules section stays; OpenCode section keeps banui (new path) and taste-skill and the rm guard deny rules, drops agent-desktop and modern-web-guidance.
- [ ] **Step 4: Verify:** `claude plugin validate .` passes; `claude plugin validate optional/banui` passes; `python3 -m unittest discover -s tests` passes; `claude plugin test plugins/cache-lamp` and `plugins/waypoints` pass.
- [ ] **Step 5: Commit** `kit: banui optional, clean plugin list, docs for install.py`

### Task 6: Run it on this Mac

- [ ] **Step 1:** `python3 install.py --dry-run --only cache-lamp,waypoints,taste-skill,rm-guard,settings` — read the `would:` lines; nothing changes (`git status` clean, `~/.claude/settings.json` unchanged).
- [ ] **Step 2:** Push `main`, then run the same without `--dry-run`. Expect `already installed` for the plugins, a backup file, and only `kept yours:` / `already in place` lines for settings that match; `~/.claude/settings.json` still parses and still has `cache-lamp@seymurglv` before `waypoints@seymurglv`.
- [ ] **Step 3:** Run it a second time: every line is `already installed` / `already in place`; no new backup file.
