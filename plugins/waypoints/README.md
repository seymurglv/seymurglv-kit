# waypoints

After each turn, up to three likely next prompts show as quiet rows above the prompt box.

Claude Desktop, the pointer on row 1:

```
░░[1]░░░Commit and push░░into the prompt box░░░░░
  [2]   Find why the test fails   systematic-debugging
  [3]   Review the branch         code-review

        1–3 insert              [9] other [0] hide
```

Terminal:

```
1: Commit and push
2: Find why the test fails · systematic-debugging
3: Review the branch · code-review
1–3 insert · Tab takes the first · 9: other · 0: hide
```

- `1`, `2` or `3` from an empty prompt box (or a click on the row) puts that prompt in the box as a draft. Edit it, then press Enter yourself.
- The first suggestion is also offered as the box's dim ghost text, for Tab to take. The terminal draws it; Claude Desktop's prompt box does not draw a plugin's ghost text yet (checked 1 Nov 2026: the engine answers `isShown: true`, nothing shows), so there the key line leaves Tab out.
- The three are different moves where they fit: one carries the work on, one checks it, one closes it. After an answer that asks you something, they are the answers you would most likely give.
- Under the pointer (Claude Desktop) a row shows the prompt the pick puts in the box, on what is left of the row; a prompt longer than that is cut with `…`. A prompt that is its own label shows `into the prompt box` instead.
- While the suggestions are on their way the band holds one line, `Looking for next steps…`.
- `9` asks for other ones. The offer stays on screen until they come, and stays if nothing new comes.
- `0` hides the rows. A new turn hides them too. `/waypoints show` brings the last offer back.
- The plugin never sends a prompt on its own.

Suggestions come in the language of the conversation. The band's own words (the hover hint and the key line) follow the system's language by default (`auto`), or `en`/`ru` when set; suggestions still follow the conversation.

The look is quiet: no bordered or accent buttons, the label, and under the pointer a muted note of what a pick does. In the terminal the rows read as a survey's do, `1: label`.

On Claude Desktop the grid is the band's own and needs no other plugin: a key column, then the labels, the key line starting on the labels' line. Desktop draws a Button's hotkey as its own small key badge, so each row holds two plain Buttons: one with the hotkey alone, 44 px wide, and one with the label. The whole row lights under the pointer, once: both Buttons clear Desktop's own hover fill (`hover: { backgroundColor: '#0000' }`, which the app applies with `!important` over its `:hover`). Rows are padded so the app's 28 px button never reaches past its row, and the key line has air above it. Measured live on Claude Desktop 4.4212 (comfortable density, 2 Nov 2026): the key badge's centre sits 19 px into the row and the label's text starts 54 px in; the key line starts on the labels' line through a 54 px spacer (`LABEL_PX` in `register.tsx`). A Desktop that sizes buttons differently shifts both.

## How it works

It is a function-hooks plugin (`hooks/register.tsx`):

- `turn.complete` (main loop only, a real answer at least `minAnswerChars` long): forks the session with `$.model.fork` and asks for up to three next prompts as JSON. The fork reuses the session's prompt cache, so it costs about one short reply. It runs detached: the turn's end never waits for it.
- `$.command.list`: the session's plugin, user and MCP skills and slash commands go into the fork's question. For each step the fork names an installed skill when one fits (`"skill"` in its JSON); the row then carries a muted tag with the skill's short name (`systematic-debugging` for `superpowers:systematic-debugging`), and a pick puts `/skill task` in the box. A skill the session lacks drops the tag and keeps the step; a slash prompt naming a command the session lacks is dropped.
- Everything the fork answers is cleaned before it is shown or filled: escape sequences, invisible and control characters go, and text hiding Unicode tag characters is refused.
- `ui.render` on `AbovePrompt` draws the rows (desktop and terminal). It yields to surveys and stays out while a turn runs.
- A pick calls `$.prompt.fill`; the first suggestion goes to `$.prompt.suggest`.
- `turn.start` on the main loop hides the rows; a subagent's turn does not.
- A fork that answers after a newer turn began is dropped.
- `9` forks again with the labels already offered, asking for other steps. Each press is one more request; `/waypoints` counts it.
- The view lives in `$.state`, so a hot reload keeps what is on screen.

`/waypoints show` puts the last offer back on the band (it is kept in `$.state` after its rows hide). `/waypoints` shows how many forks ran in this session and in all sessions, with their tokens (read from cache, written to cache, new, output).

## Install

```
/plugin install waypoints --marketplace seymurglv/seymurglv-kit
```

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `minAnswerChars` | `80` | No suggestions after an answer shorter than this |
| `suggestSkills` | `true` | Give the suggester the session's skills and slash commands |
| `language` | `auto` | Language of the band's own words: `auto` (the system's), `en` or `ru` |

## Checks

```bash
claude plugin validate plugins/waypoints
claude plugin test plugins/waypoints
```

The tests run every band check on both the terminal and the desktop surface.

## Credits

Rewritten from the idea of next-steps by Thariq Shihipar.
