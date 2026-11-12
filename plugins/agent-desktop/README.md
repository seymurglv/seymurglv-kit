# agent-desktop

Desktop control for an agent through the OS accessibility tree, using the
[agent-desktop](https://github.com/vercel-labs/agent-desktop) CLI by Vercel Labs: snapshot an app, act on a ref,
re-read to verify.

| Skill | What it covers |
|---|---|
| `agent-desktop` | The core loop, refs and commands |
| `agent-desktop-macos` | Permissions, headed mode, menus, sheets, Chromium and Electron apps |
| `agent-desktop-windows` | What works and what refuses, PowerShell quoting, elevation |
| `agent-desktop-linux` | X11 and Wayland, the AT-SPI bus, first-contact gotchas |

The skills are copied unchanged from upstream at the release in [`upstream.json`](upstream.json);
[`NOTICE.md`](NOTICE.md) has the details and the license.

## Install

```
/plugin install agent-desktop --marketplace seymurglv/seymurglv-kit
```

The CLI is not shipped. Install it once per machine:

```sh
npm install -g agent-desktop@latest
agent-desktop status
```

On each session start `hooks/check-cli.mjs` says so when the CLI is missing or older than the skills.

## Update the skills

```sh
node plugins/agent-desktop/scripts/sync.mjs
```
