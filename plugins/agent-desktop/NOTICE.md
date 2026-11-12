# Notice

The four skills here are copied unchanged from **agent-desktop** by Vercel Labs,
https://github.com/vercel-labs/agent-desktop, at the release recorded in
[`upstream.json`](upstream.json) (tag and commit):

| Here | Upstream |
|---|---|
| `skills/agent-desktop/` | `skills/agent-desktop/`: the core loop, refs, commands |
| `skills/agent-desktop-windows/` | `skills/agent-desktop-windows/` |
| `skills/agent-desktop-macos/` | `skills/agent-desktop-macos/` |
| `skills/agent-desktop-linux/` | `skills/agent-desktop-linux/` |

agent-desktop is licensed under the Apache License, Version 2.0; the full text is in [`LICENSE`](LICENSE),
refreshed with each sync. The upstream repository has no NOTICE file. The FFI (C library) and JEV skills are
not taken. Our own files are `README.md`, `scripts/sync.mjs`, `hooks/` and `upstream.json`.

## Keeping it current

- **The skills** follow upstream's latest *release* (not `main`), so they match the CLI npm installs.
  They are synced by hand with `scripts/sync.mjs`: `node plugins/agent-desktop/scripts/sync.mjs`.
- **The CLI** is not shipped. Install it once per machine, and again after a sync:

  ```sh
  npm install -g agent-desktop@latest
  agent-desktop status
  ```

  On each session start `hooks/check-cli.mjs` compares the installed CLI with `upstream.json` and says so
  when it is missing or older; it is silent when they match.
