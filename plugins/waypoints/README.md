# waypoints

After each turn, up to three likely next prompts show as quiet rows above the prompt box.

Claude Desktop, under ember's row, the pointer on row 1:

```
 (59)   Warm · goes cold at 00:52
        421k tokens in cache
░░[1]░░░Commit and push░░into the prompt box░░░░░
  [2]   Find why the test fails   systematic-debugging
  [3]   Review the branch         code-review

        1–3 insert                        [0] hide
```

Terminal:

```
1: Commit and push
2: Find why the test fails · systematic-debugging
3: Review the branch · code-review
1–3 insert · Tab takes the first · 0: hide
```

- `1`, `2` or `3` from an empty prompt box (or a click on the row) puts that prompt in the box as a draft. Edit it, then press Enter yourself.
- The first suggestion is also offered as the box's dim ghost text, for Tab to take. The terminal draws it; Claude Desktop's prompt box does not draw a plugin's ghost text yet (checked 1 Nov 2026: the engine answers `isShown: true`, nothing shows), so there the key line leaves Tab out.
- `0` hides the rows. A new turn hides them too.
- The plugin never sends a prompt on its own.

Suggestions come in the language of the conversation. The band's own words (the hover hint and the key line) are English by default; set `language` to `ru` for Russian.

The look is quiet: no bordered or accent buttons, the label, and under the pointer a muted note of what a pick does. In the terminal the rows read as a survey's do, `1: label`.

On Claude Desktop the rows sit on ember's grid. Desktop draws a Button's hotkey as its own small key badge, so each row holds two plain Buttons: one with the hotkey alone, in a column as wide as ember's ring, and one with the label, starting on ember's text line. The whole row lights under the pointer, once: both Buttons clear Desktop's own hover fill (`hover: { backgroundColor: '#0000' }`, which the app applies with `!important` over its `:hover`). Rows are padded so the app's 28 px button never reaches past its row, and the key line has air above it. Measured live on Claude Desktop 4.4212 (comfortable density, 2 Nov 2026): the key badge sits 4 px left of the ring's centre and the label 2 px right of ember's text, the closest a native button allows; the key line starts on the labels' line through a 54 px spacer (`LABEL_PX` in `register.tsx`). A Desktop that sizes buttons differently shifts both.

## How it works

It is a function-hooks plugin (`hooks/register.tsx`):

- `turn.complete` (main loop only, a real answer at least `minAnswerChars` long): forks the session with `$.model.fork` and asks for up to three next prompts as JSON. The fork reuses the session's prompt cache, so it costs about one short reply. It runs detached: the turn's end never waits for it.
- `$.command.list`: the session's plugin, user and MCP skills and slash commands go into the fork's question. For each step the fork names an installed skill when one fits (`"skill"` in its JSON); the row then carries a muted tag with the skill's short name (`systematic-debugging` for `superpowers:systematic-debugging`), and a pick puts `/skill task` in the box. A skill the session lacks drops the tag and keeps the step; a slash prompt naming a command the session lacks is dropped.
- Everything the fork answers is cleaned before it is shown or filled: escape sequences, invisible and control characters go, and text hiding Unicode tag characters is refused.
- `ui.render` on `AbovePrompt` draws the rows (desktop and terminal). It yields to surveys and stays out while a turn runs.
- A pick calls `$.prompt.fill`; the first suggestion goes to `$.prompt.suggest`.
- `turn.start` on the main loop hides the rows; a subagent's turn does not.
- A fork that answers after a newer turn began is dropped.
- The view lives in `$.state`, so a hot reload keeps what is on screen.

`/waypoints` shows how many forks ran in this session and in all sessions, with their tokens (read from cache, written to cache, new, output).

## Install

```
/plugin install waypoints --marketplace seymurglv/seymurglv
```

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `minAnswerChars` | `80` | No suggestions after an answer shorter than this |
| `suggestSkills` | `true` | Give the suggester the session's skills and slash commands |
| `language` | `en` | Language of the band's own words: `en` or `ru` |

## Checks

```bash
claude plugin validate plugins/waypoints
claude plugin test plugins/waypoints
```

The tests run every band check on both the terminal and the desktop surface.

## Credits

Rewritten from the idea of next-steps by Thariq Shihipar.
