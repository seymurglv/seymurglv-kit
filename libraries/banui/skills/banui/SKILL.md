---
name: banui
description: Use when designing, mocking up, prototyping, reviewing or fixing any UI, screen, control or state in the banui design language, or when someone mentions banui, the five signs (capsule, line, dot, lamp, pen stroke), "наш стиль", "пять знаков", капля, лампа. Also when someone wants to add finished banui work to the skill as a reference, or update or delete one ("добавь в референсы", "сохрани как пример", "обнови референс", "удали пример"), and when a banui design drifts into generic UI - invented colors or sizes, red errors, spinners, modals, toasts, a meaning told by color alone.
---

# banui

A quiet interface where everything is built from five signs, and a state is a new position of the same lines.

**The values below are fixed.** Agents who know only the idea of banui get its spirit right and its numbers wrong: 6 px dots, 8 px lamps with a halo, 1.5 px lines, a red error, an invented palette. Do not pick sizes, colors or timings: copy them.

## Four modes

The skill does one of four things. When the request does not say which, ask once, with these four options, before doing anything else.

| Mode | The person says | What happens |
|---|---|---|
| **Create** | what they want: a screen, a control, a state | You build it new, by the rules below |
| **Add a reference** | "save this", "добавь в референсы" | The finished work we made together is stored in the skill |
| **Update a reference** | "обнови референс", or a stored one is out of date | The stored work is brought in line with the current one |
| **Delete a reference** | "удали пример" | The stored work is taken out of the skill |

A reference is finished work kept inside this skill for the next agent to copy: a screen is a folder in `examples/`, a control is a section in `references/controls.md`. `kit/` is not a reference: it is a copy of the built library, made by `npm run build`, and is never edited by hand.

Talk to the owner in the language they write in. UI copy follows the product's language.

### Create

1. Copy the `kit/` folder (next to this file) beside the page and link `kit/banui.css` unchanged. It holds every token, the sign primitives and the ready controls; `kit/index.js` builds the controls (`mount()`). Do not rename or re-pick its values.
2. Start from the closest reference: a screen in `examples/` (`examples/screen-settings/` is a working one), a control recipe in `references/controls.md`. Read the recipe before building a field, toggle, list, navigation, status drop or pen mark.
3. What no reference covers, build from the signs: see "Inventing a control".
4. Run the self-check at the end of this file before you show the work.

### Add a reference

Only work the owner has seen and accepted, and that passes the self-check.

- **A screen**: a new folder `examples/<kind>-<name>/` (lowercase letters, digits and hyphens, like `screen-settings`) with its `index.html` and its own CSS and JS. It links the kit as `../../kit/banui.css` and holds no copy of it. Leave out everything that belongs to the product: real data, names, network calls.
- **A control**: a new section in `references/controls.md` (states table, which signs carry them, glyph offsets) and its line in the Contents list there.
- If a folder or section with that name exists, this is an update: say so and switch modes.

### Update a reference

1. Show the owner what will change in the stored reference before you write.
2. Change only that reference. Rules, tokens and values in this file change only on the owner's decision, never as a side effect.
3. If the change makes another reference or a line of this file untrue, name it and ask.

### Delete a reference

1. Name exactly what goes: the folder path, or the section title. Wait for the owner's yes.
2. Move the folder to the Trash, do not erase it. Cut a section out of `references/controls.md` together with its Contents line.
3. Search this file, `references/` and the other examples for mentions of it and fix or report each one. `examples/screen-settings/` is named in Create: if it goes, name another working screen there.

After adding, updating or deleting, open every changed example in a browser and say what you checked.

## The five signs

| Sign | Means | Geometry |
|---|---|---|
| Capsule | a container, and what is selected | radius = half its height |
| Line | on, action in progress | rounded stroke, **2 px** thick |
| Dot | rest, off, unavailable | circle, **3 px** |
| Lamp | a signal: one color, one meaning | the same 3 px dot, lit |
| Pen stroke | "look here", drawn by hand | 1.75 px, pen color |

- A control is made only of these signs, text and numbers. No icons from a set, no boxes with shadows, no new shapes.
- A dot and a line are one element: the line collapses into the dot and stretches back (`.ban-ln`). A check, a cross and a chevron are two lines in new positions. "Thinking" is three dots.
- The lamp is the rest dot that lit up. Its size never changes, it has no halo, no ring and no hollow state: only its color changes.
- Filled capsule (`cap` with `cap-ink`) = on or selected. Outlined capsule (`card` with a 1 px `muted` outline) = off or not selected.

## Lamp map

| Meaning | Token | On a filled capsule | On card or page | What stands next to the color |
|---|---|---|---|---|
| Done | `done` | `#33C27A` | `#0B6B5B` | a check where there is room |
| Error | `error` | `#F5B82E` | `#BD7313` | a pen stroke and words that say what is wrong |
| Recording | `rec` | `#FF5A2E` | `#9E1708` | a wave of lines |
| Attention | `attention` | `#5C8DFF` | `#2F6BFF` | the lamp breathes until the person looks |

The values above are for the light theme; in the dark theme the two columns swap, and `banui.css` does that for you. `data-theme="light"` or `"dark"` on any element sets the theme of its subtree; inside `.ban` that element also takes `bg` and `text`.

- **Error is amber. Red means recording and nothing else.** Attention (nothing is broken, but look) is blue.
- **Working, saving, loading have no color.** They are three breathing dots in ink.
- Meaning color lives only in the 3 px lamp. Text, lines, glyphs, outlines and fills stay ink: an error never turns a field's outline or its text amber.
- Color never speaks alone: a sign or words stand next to it.
- A new meaning needs the owner's decision. Do not add a fifth color.
- **Danger has no color.** A destructive action is carried by its words and by a confirmation tray in which the safe choice takes focus.
- A control's own result (saved, invalid, failed) is shown on that control. The status drop is only for what no control on screen can show.

## Sizes and type

| What | Value |
|---|---|
| Control height | 28 px (capsule radius 14) |
| Toggle | 36 × 20 px |
| Status drop | 24 px high |
| Settings row | 44 px; right column of controls 220 px wide |
| Window | radius 14, padding 16, header 48 |
| Text | 13 px; 12 px in navigation, the drop, 24 px buttons, captions and meta lines |
| Reading text (a paragraph) | 13 px with line height 1.5 |
| Page behind a window | `bg`; the window is `bg` with a 1 px `line` border |
| Hand note | Caveat 600, 17 px, rotated −3° |
| Hairlines | 1 px `line`; control outline 1 px `muted` (1.5 px on a toggle that is off), 1.5 px `text` when a field is focused |

Two text sizes and the hand note. Hierarchy comes from weight (600 for a title) and space, never from a third size. System UI font; no web font for the interface.

## Motion

| What moves | Time | Curve |
|---|---|---|
| Press (button shrinks to 0.97) | 120 ms | default |
| Toggle | 200 ms | spring |
| Navigation capsule, list height, field signs, row growing | 300 ms | spring |
| Height of a window or panel | 300 ms | ease-out, no overshoot |
| Status drop width | 420 ms | spring |
| Label change by shared letters | 16 ms per letter | |
| Pen stroke drawing | 400 ms | ease-out |

- The shorter the path and the more frequent the action, the faster.
- Nothing moves by itself. Motion needs a cause: a press, or data arriving. A number that follows real progress (a percent, a timer) and a recording wave are data. The only decorative loops are the breathing of an attention lamp and of the three "thinking" dots.
- An attention lamp stops breathing once the person has looked: on hover, focus or press of its control.
- A message stays until the person closes it, acts on it, or a new one replaces it. No timer hides anything.
- Waiting is three breathing dots that become the result in place. Nothing rotates.
- A row or a control that grows uses the spring. The window around it has no transition of its own then: it simply follows. Ease-out without overshoot is for a window changing section.
- A label that changes by shared letters sits in a button whose width is fixed for the longest label.
- `prefers-reduced-motion: reduce` turns transitions and breathing off and makes label changes instant; states still change.

## What banui never has

| Never | Instead |
|---|---|
| Modal, dialog, overlay confirmation | A tray that grows out of the pressed control and folds back into it |
| Spinner, rotating glyph, skeleton shimmer | Three breathing dots that become the result |
| Toast stack, auto-hiding message | One status drop per window, one message at a time, closed by the person |
| Red error, colored field outline | Amber lamp, pen stroke under the wrong part, a hand note saying what is wrong |
| Sparkles, wands, gradients, purple for AI | Nothing: the answer simply appears |
| A third text size | Weight and space |
| Borrowed window chrome (traffic lights) | Own title and the drop |
| Dots-only navigation | Every section labeled and visible; the selected one is a filled capsule that slides |

## Inventing a control

The language has few ready controls. When you need a new one:

1. Write its states as a table: state, which sign carries it, where the lines stand.
2. Use positions, not new shapes: lying or standing lines, a dot that stretches, a capsule that slides or grows.
3. Unavailable is always a dot. Selected is always a capsule or a line.
4. Say in one line which signs it is made of. If you need a sixth sign, stop and ask the owner.

## Self-check before showing

- [ ] Tokens come from `banui.css` unchanged; no other hex values in the page.
- [ ] Every dot and lamp is 3 px, every sign line 2 px (pen stroke 1.75 px, outlines 1 to 1.5 px), no halo.
- [ ] Lamp colors are only the four from the map, only on dots, with the tone for their surface.
- [ ] Error is amber with words; nothing red except a recording lamp.
- [ ] Text sizes are 13 and 12 (plus the 17 px hand note).
- [ ] No timer hides a message; nothing rotates; no modal or toast.
- [ ] Every state is readable without color.
- [ ] Light and dark both checked; keyboard focus is visible on every control.
- [ ] Clicked through every state in a browser.

## Common mistakes

| Mistake | Fix |
|---|---|
| A destructive button made red, or "delete" told by color | Danger has no color: words, and a tray where the safe choice has focus. |
| A field's own error sent to the status drop | It stays on the field: lamp, pen stroke, hand note. |
| "A 3 px lamp is too small, I made it 8 px with a glow" | 3 px is the owner's decision. Separate colors by tone, never by size. |
| In-progress shown with an amber or blue lamp | Progress has no color: three breathing dots. |
| Check or cross drawn in green or red | Glyph lines are ink. Only the lamp carries color. |
| "Saved" disappears after a few seconds | It stays until the next action. |
| Own off-white and ink picked "to fit" | Use the tokens. |
| Lamp tone for the page used on a filled capsule (or the reverse) | Use the `ban-lamp` class: it picks the tone by surface. |
