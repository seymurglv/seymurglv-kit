# seymurglv-kit

My working kit in one repository: the things I use with coding agents, kept so that a new computer is one clone
away. Open the folder in an agent, say "install everything", and the working environment is back.

## Contents

```text
seymurglv-kit
├── plugins/      plugins and skills for coding agents
├── libraries/    code libraries
├── setup/        files a machine needs once
├── AGENTS.md     what an agent does on "install everything"
└── README.md
```

Open a folder to see what is inside.

<details>
<summary><b>plugins/</b> &nbsp;·&nbsp; 3 plugins for coding agents</summary>

<br>

| Plugin | Claude Code | OpenCode | What it is |
|---|---|---|---|
| [`agent-desktop`](plugins/agent-desktop) | yes | skills | Desktop control through the OS accessibility tree: snapshot an app, act on a ref, re-read to verify. Guides for macOS, Windows and Linux |
| [`ember`](plugins/ember) | yes | handoff skill only | How warm this chat's prompt cache is, keep-warm on a press, a board of local chats, and a handoff to a fresh chat |
| [`waypoints`](plugins/waypoints) | yes | no | Up to three likely next prompts as quiet rows above the prompt box after each turn |

</details>

<details>
<summary><b>libraries/</b> &nbsp;·&nbsp; 1 library with a skill for agents</summary>

<br>

| Name | Claude Code | OpenCode | What it is |
|---|---|---|---|
| [`banui`](libraries/banui) | skill | skill | A UI design language where every control is built from five signs (capsule, line, dot, lamp, pen stroke). The library is framework-free TypeScript and CSS with a demo and its tests; the [skill for an agent](libraries/banui/skills/banui) inside it carries the lamp color map, starter styles and control recipes |

</details>

<details>
<summary><b>setup/</b> &nbsp;·&nbsp; 1 guard for a new machine</summary>

<br>

| Name | Claude Code | OpenCode | What it is |
|---|---|---|---|
| [`rm guard`](setup) | hook | deny rules | Blocks every command that deletes files; a delete goes to the Trash or Recycle Bin instead, after a yes in chat |

</details>

## Install

Open this folder in your agent and say:

> Install everything from this repository.

The agent follows [`AGENTS.md`](AGENTS.md): it finds out which agent and system it runs on, installs what works
there, and checks the result.

<details>
<summary>By hand, in Claude Code</summary>

<br>

```
/plugin marketplace add seymurglv/seymurglv-kit
/plugin install agent-desktop@seymurglv
/plugin install banui@seymurglv
/plugin install ember@seymurglv
/plugin install waypoints@seymurglv
```

Then the rm guard from [`setup/`](setup), and a restart.

</details>

<details>
<summary>Only the banui skill, for any agent that reads skills</summary>

<br>

```sh
npx skills add seymurglv/seymurglv-kit --skill banui
```

</details>

## Adding something

One thing is one folder with its own README, plus one row in its section above.

| Folder | For |
|---|---|
| `plugins/` | plugins and skills for agents; a Claude Code plugin also gets an entry in `.claude-plugin/marketplace.json` |
| `libraries/` | code libraries |
| `setup/` | files a machine needs once: hooks, settings |

## Notes

- The steps were run on macOS. The Windows steps in `AGENTS.md` have not been run yet.
- In OpenCode the deny rules were written and parse; a refused `rm` in a live OpenCode chat has not been seen yet.
- `ember` and `waypoints` draw in Claude Code's own interface, so they stay Claude Code only.
