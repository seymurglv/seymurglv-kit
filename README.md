# seymurglv

My own tools in one place: plugins and skills for coding agents, the banui UI library, and the guard that keeps
an agent from deleting files. Clone it on a new computer, open it in an agent, say "install everything", and the
working environment is back.

## What is here

| Name | Kind | Claude Code | OpenCode | What it is |
|---|---|---|---|---|
| [`agent-desktop`](plugins/agent-desktop) | plugin, 4 skills | yes | skills | Desktop control through the OS accessibility tree: snapshot an app, act on a ref, re-read to verify. Guides for macOS, Windows and Linux |
| [`banui`](libraries/banui/skills/banui) | skill | yes | yes | The banui design language: every control built from five signs (capsule, line, dot, lamp, pen stroke), with a lamp color map, starter styles and control recipes |
| [`banui`](libraries/banui) | library | | | The same language as code: framework-free TypeScript and CSS, with a demo and its tests |
| [`ember`](plugins/ember) | plugin | yes | handoff skill only | How warm this chat's prompt cache is, keep-warm on a press, a board of local chats, and a handoff to a fresh chat |
| [`waypoints`](plugins/waypoints) | plugin | yes | no | Up to three likely next prompts as quiet rows above the prompt box after each turn |
| [`rm guard`](setup) | hook | yes | deny rules | Blocks every command that deletes files; a delete goes to the Trash or Recycle Bin instead, after a yes in chat |

## Install

Open this folder in your agent and say:

> Install everything from this repository.

The agent follows [`AGENTS.md`](AGENTS.md): it finds out which agent and system it runs on, installs what works
there, and checks the result.

By hand, in Claude Code:

```
/plugin marketplace add seymurglv/seymurglv
/plugin install agent-desktop@seymurglv
/plugin install banui@seymurglv
/plugin install ember@seymurglv
/plugin install waypoints@seymurglv
```

Then the rm guard from [`setup/`](setup), and a restart.

The `banui` skill alone, for any agent that reads skills:

```sh
npx skills add seymurglv/seymurglv --skill banui
```

## Adding something

One thing is one folder with its own README, plus one row in the table above.

| Folder | For |
|---|---|
| `plugins/` | plugins and skills for agents; a Claude Code plugin also gets an entry in `.claude-plugin/marketplace.json` |
| `libraries/` | code libraries |
| `setup/` | files a machine needs once: hooks, settings |

## Notes

- The repository is private. Git needs GitHub credentials first: `gh auth login`, then `gh auth setup-git`.
- The steps were run on macOS. The Windows steps in `AGENTS.md` have not been run yet.
- In OpenCode the deny rules were written and parse; a refused `rm` in a live OpenCode chat has not been seen yet.
- `ember` and `waypoints` draw in Claude Code's own interface, so they stay Claude Code only.
