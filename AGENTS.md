# Instructions for an agent

When the person says "install everything" (or anything like it) in this repository, set this machine up from it.
The result matters, not the exact commands: adapt them to the system you are on, and say what you did.

## Rules

- Copy a settings file, or a hook file that is already there, before you change or replace it (same folder, the
  date in the name). After the change a settings file must still parse: JSON, or JSONC for a `.jsonc` file.
- Merge into what is there. Never replace a settings file, a hook list or a skills folder as a whole.
- Delete nothing. If something is in the way, say so and stop on that step.
- Say plainly which steps you skipped and why.

## 1. Find out where you are

Which agent runs you (Claude Code or OpenCode), and which system (macOS, Windows, Linux). Do only the section
for your agent. If both agents are installed and the person asked for both, do both.

## 2. Claude Code

The installer does the work. From this folder:

```sh
python3 install.py --list
```

It prints the parts (`cache-lamp`, `waypoints`, `taste-skill`, `banui`, `rm-guard`, `settings`) and whether each is
installed. Ask the person which parts they want; banui is optional and off by default. Then run:

```sh
python3 install.py --only <ids>      # for example --only cache-lamp,waypoints,rm-guard
```

`--all` takes every part, `--skip a,b` takes the defaults except those, `--dry-run` shows the steps without
changing anything. Report the installer's output as it is: what it installed, what it kept, what it skipped.

The installer backs up `~/.claude/settings.json`, merges into it, installs the rm guard files and checks them.
`taste-skill` needs Node 22+ and Chrome, Edge or Chromium (`CHROME_PATH` if it is somewhere unusual; ffmpeg is
optional): check them and say what is missing. Its skill adds a `Stop` hook that runs its finish gate in projects
where it built a page.

On Linux the installer installs the rm guard files and the hook but skips `trash.py --check`: there is no Trash route
there yet, so tell the person that a blocked delete cannot be moved to a Trash on that system.

The person restarts Claude Code; plugins load in a new session.

## 3. OpenCode

OpenCode reads skills, not Claude Code plugins. `waypoints` and `cache-lamp` draw in Claude Code's interface and are skipped here;
say so.

Skills go into the global skills folder, next to the global `opencode.json`: `~/.config/opencode/skills/`
(on Windows look for `opencode.json` under `%USERPROFILE%\.config\opencode` first). Link each folder on macOS
and Linux, copy it on Windows:

| From this repository | Name in the skills folder |
|---|---|
| `optional/banui/skills/banui` (only if the person wants banui) | `banui` |
| `skills/taste-skill` of the original repository (see below) | `design-taste-frontend` |

`taste-skill` is not kept in this repository. Clone it,
`git clone https://github.com/Leonxlnx/taste-skill ~/.config/opencode/vendor/taste-skill`, check out its latest
release tag, and link or copy its `skills/taste-skill` folder. Its `Stop` hook is Claude Code only; in OpenCode the
finish gate runs only when the skill calls it.

A link points into a clone, so the clone has to stay where it is; if it moves, link again.

The rm guard. OpenCode has no hook like Claude Code's, so the guard is a list of deny rules in the global
`opencode.json` (or `opencode.jsonc`). This format is for OpenCode 2.x; version 1 uses other names, so check the
installed version and its permissions documentation before writing. Append to the `permissions` array, creating
it if it is missing:

```json
{ "action": "shell", "resource": "rm *", "effect": "deny" },
{ "action": "shell", "resource": "rmdir *", "effect": "deny" },
{ "action": "shell", "resource": "unlink *", "effect": "deny" },
{ "action": "shell", "resource": "shred *", "effect": "deny" },
{ "action": "shell", "resource": "git clean *", "effect": "deny" },
{ "action": "shell", "resource": "git reset --hard*", "effect": "deny" },
{ "action": "shell", "resource": "Remove-Item *", "effect": "deny" },
{ "action": "shell", "resource": "del *", "effect": "deny" },
{ "action": "shell", "resource": "rd *", "effect": "deny" }
```

These rules catch the plain commands. They do not catch a delete written inside a script or an interpreter
one-liner, which the Claude Code hook does; tell the person this.

A running OpenCode keeps the configuration it started with: the rules apply after the person restarts it. Do
not restart it yourself.

After a refused delete, and the person's yes, move the path to the Trash or Recycle Bin with
`python3 setup/hooks/trash.py <path>` from this clone (`python` on Windows; not on Linux).

## 4. Check

- List the skills the agent now sees and compare with the tables above.
- Create a temporary file and try to delete it with `rm`. The command must be refused. Leave the file; name its
  path so the person can remove it. In OpenCode the rules load only after a restart: run this check in a new
  session after it, and until then report it as pending.
- Claude Code only: `python3 ~/.claude/hooks/block_rm.py --self-test` passes, and
  `python3 ~/.claude/hooks/trash.py --check` prints `TRASH-CHECK PASS`.
- OpenCode only: `opencode api skill.list` names the linked skills, and `opencode debug config --standalone`
  shows the `permissions` rules as OpenCode parses them. With the desktop app alone, the `opencode` command is
  the CLI bundled inside the app's data folder.

Report: what was installed, what was skipped, what the checks showed, and what the person has to do (restart,
sign in).

## Working on a skill

When you add or change a skill kept in this repository, follow [`guides/skills/README.md`](guides/skills/README.md)
and finish with `node guides/skills/check-skill.mjs`: it must print no finding.
