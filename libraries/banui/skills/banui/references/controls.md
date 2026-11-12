# banui controls and glyphs

Recipes for the controls that exist. All use the tokens and primitives from `../banui.css`.

## Contents

- Glyphs from lines
- Status drop
- Text field
- Toggle
- Dropdown list
- Navigation
- Buttons
- Tray
- Progress
- Pen layer
- Settings window
- Mockup conventions

## Glyphs from lines

Every glyph is two or three `.ban-ln` elements in one `position:relative` box. Values are for the 14 px base line. Lines stay ink: never give them a lamp color.

| Glyph | Lines |
|---|---|
| Dot (rest) | one line, nothing set |
| Line (on, typing) | `--k:.72` (28 px control) or `--k:1` |
| Check, in a 28 px control | `--x:-2.6px;--y:1.3px;--r:-45deg;--k:.34` and `--x:2px;--r:45deg;--k:.64` |
| Check, in a 36 px control | `--x:-3px;--y:1.5px;--r:-45deg;--k:.4` and `--x:2.4px;--r:45deg;--k:.75` |
| Cross (close, clear) | `--r:45deg;--k:.5` and `--r:-45deg;--k:.5` |
| Chevron down | `--x:-2.2px;--r:-45deg;--k:.34` and `--x:2.2px;--r:45deg;--k:.34` |
| Chevron up (open) | the same two lines with the rotations swapped |
| Plus | `--k:.7` and `--r:90deg;--k:.7`; rotate the box 45° for a cross |
| Minus | `--r:90deg;--k:.7`; disabled: it collapses into a dot |
| Three dots (thinking, more) | three dots at `--x:-7px`, `0`, `7px`; thinking adds `.ban-breathe` with delays 0, .18s, .36s |
| Recording wave | three lines at `--x:-5px`, `0`, `5px`, `--k:.7`, `.ban-wave` with delays −.1s, −.35s, −.2s |

Rest dots take the ink of their container: `text` in a field, `muted` inside a toggle that is off.

A glyph changes by moving its lines: three dots become a cross (outer dots travel to the center and rotate, the third fades), a chevron flips, a dot stretches into a line. Never swap one drawing for another.

## Status drop

One per window, in its top right corner. It says only what a control cannot show by itself: a toggle and a field answer with their own state, so the drop stays silent for them.

| State | Look |
|---|---|
| Rest | filled capsule 24 × 24 with a rest dot in the center |
| Thinking | 44 px wide, three breathing dots, no lamp |
| Message | lamp at the left (center 12 px from the edge), 12 px text from 24 px, cross in a 24 px box at the right; width = 24 + text width + 26 |

- Grows leftward from the right edge, 420 ms spring. Maximum width: window width − 112 px.
- One message at a time. A new message replaces the old: text changes by shared letters, the lamp color fades.
- Never closes by itself. The cross closes it. Pressing the text reports "open" to the product; in a mockup it may reveal the detail in the window and fold the drop.
- An attention lamp breathes until the person hovers, focuses or presses the drop.
- All four meanings look the same: lamp, text, cross. Only the attention lamp breathes.
- Screen readers: keep the full message in a visually hidden `aria-live="polite"` element; the letter-by-letter change is visual only.

## Text field

Outlined capsule, 28 px high. Sign slot at the left (center 14 px from the edge), result slot at the right (center 15 px from the edge), text padding 26 px left and 28 px right.

| State | Left slot | Right slot | Below |
|---|---|---|---|
| Rest | dot | | |
| Typing (focused) | the dot stretched into a line, outline 1.5 px `text` | | |
| Done (only where confirming makes sense, such as an email) | lamp `done` | check | |
| Error | lamp `error` | | pen stroke under the text, hand note under the field |

- A settings field commits on blur and on Enter; there is no Save button next to it. A field that feeds an action (invite, search, send) has that action's main button, and Enter presses it. Validation comes from outside: a function returns nothing or a short reason.
- Saving: three breathing dots in the right slot. They become the check there, while the left dot lights as the `done` lamp.
- An error stays, even while the field is focused, until the person edits the text. Then the lamp goes back to the typing line.
- Unavailable field: outline `line`, text `muted`, rest dot.
- The pen stroke goes under the wrong part when it is known, otherwise under the whole typed text. It draws from its start (400 ms). Its wave is fixed for a given text, not random on every show. A path that works for width `w`: `M1 5 C{w*.25} 2 {w*.5} 8 {w*.72} 4 S{w-5} 6 {w-1} 3` in an 8 px high `svg.ban-pen` placed 20 px below the field's top, with `pathLength="1"` on the path.
- The hand note says what is wrong in two or three words ("нужна @"). The row grows from 44 to 66 px (300 ms spring) to make room.
- The outline and the text never change color on error.
- `aria-invalid`, and `aria-describedby` pointing at the note (`role="status"`).
- An input never has zero width at the moment it takes focus. If its container is still opening, give the input its full width at once and let the container clip it.

## Toggle

36 × 20 px, `role="switch"`. Base line for its sign: 2 × 10 px (`--b:10`).

| State | Look |
|---|---|
| Off | outlined capsule (1.5 px `muted`), ink `muted`, dot at `--x:-8px` (`--k` unset) |
| On | filled capsule, line at `--x:8px` (`--k:1`) |

200 ms spring. Space and Enter switch it. Sized for a mouse.

## Dropdown list

Outlined capsule 28 px high showing the value and a chevron.

- Radius 14 at every height (`ban-grown`), never a full pill once open. Value label 12 px from the left; chevron in a 20 px box, 4 px from the right.
- Open: the same capsule grows downward into its own list over the rows below (height = 28 + 26 × rows + 4 bottom padding, 300 ms spring), the chevron flips, `--ban-shadow` appears.
- Rows are inset 4 px from the sides; hover is `surface2` with radius 7; keyboard focus on a row is the ring drawn inward.
- Row 26 px, text `muted`; the selected row is `text` with a line at the left (`--k:.6`, center 10 px from the edge). No sign on the other rows.
- On choice the value label changes by shared letters.
- Keyboard: Enter, Space or Arrow Down opens; arrows move; Home and End; Enter chooses; Esc closes and returns focus; a click outside closes.

## Navigation

A track: capsule 28 px high, `card` with a 1 px `line` outline, 3 px padding. Buttons 22 px high, 12 px text, `muted`.

- Every section is labeled and visible.
- The selected one is marked by a filled capsule that slides to it and takes its width (300 ms spring); its label turns `cap-ink`.
- Tab semantics: Left and Right move, Home and End jump; panels that are not selected are `inert`.
- The panel area follows the height of the selected section (300 ms ease-out, no overshoot). Clip overflow only while the height is moving, so open lists are never cut.

## Buttons

| Button | Look |
|---|---|
| Main action | filled capsule 28 px high, 13 px text, 14 px side padding |
| Quiet (secondary, in a row, in a tray) | outlined capsule 24 px high, 12 px text, 10 px side padding |
| With a sign | the sign sits in a slot at the left, center 14 px from the edge (12 px in a 24 px button); text starts at 26 px (22 px) |
| Unavailable | outlined with a `line` outline and `muted` text (`:disabled` in `banui.css`); a sign in it collapses into a dot |

- At most one main action in a window. Everything else is quiet.
- Press: shrinks to 0.97 (120 ms). Hover: nothing changes but the cursor.
- A button that waits shows three breathing dots in place of its label and keeps its width; the dots become a check, then the new label.

## Tray

A tray is how banui asks, confirms or collects a little input. It is the pressed control itself, grown.

- The pressed button grows (300 ms spring) into an outlined container, radius 14, padding 12, inside its own row; the row grows with it and pushes the rows below. It never covers the window and has no backdrop or shadow.
- As wide as the row's control column (220 px), or the whole row when the sentence needs it. Other controls in that row fade out while it is open. Text 13 px, buttons quiet.
- One thought per tray: a sentence, at most one field, two buttons.
- A trigger with no glyph simply becomes the tray; a trigger with a glyph turns it into a cross.
- Confirmation of a destructive action: the safe choice ("Оставить") takes focus and is listed first; the destructive one is a quiet button like any other, told apart by its words.
- Esc and the safe choice fold it back into the button and return focus there. A click outside does nothing.
- Classes from `banui.css`: `ban-grown` for the radius, `ban-clip` while it grows so rings inside are drawn inward, `ban-ring` on the safe choice so its focus shows after a mouse press.
- When the confirmed action removes its row, the row collapses (300 ms) and the control itself has said it: the drop stays silent.

## Progress

- Unknown duration: three breathing dots where the result will appear.
- Known progress: the same three dots plus a number in text ("42 %"). No bar, no ring.
- The result replaces the dots in place: a check and words, or the error state. A long result (a paragraph) simply appears where the dots were.
- Where the dots go: where the result will appear. If a field owns the result, in the field's right slot, and the action's button offers the way out ("Отменить"). If nothing but the button owns it and it cannot be cancelled, in the button in place of its label.
- A finished state stays (address and check) until the person edits or acts again.

## Pen layer

The pen appears only for a cause: an error, a record, a first time. It is never decoration.

- Underline: under the exact words to read. An error with no wrong part (no network, no microphone) underlines the control's own label or status words, and the hand note says the reason.
- Hand note: `.ban-note`, two or three words, near what it points at.
- For an error: the underline and the note stay hidden until an ancestor carries `data-state="error"`; then the stroke draws and the note appears.
- For a record or a first time: put `data-pen` on the `.ban-pen` or `.ban-note` itself; it shows drawn and visible with no error state.
- Embed Caveat (SIL OFL, has Cyrillic) in a product. In a single-file mockup the fallback stack is acceptable, even where it has no handwriting face for the script.
- Use `--ban-t-pen` for the drawing time.

## Settings window

Width up to 540 px, radius 14, 1 px `line` border, background `bg`. Header 48 px with the title at the left (13 px, weight 600) and the drop at the right. Navigation below the header. Rows 44 px separated by `line`; label at the left, control at the right, all controls in a 220 px column except toggles.

## Mockup conventions

- The page behind a window is `bg`. `surface2` is for the hover of a list row and for a plate under a specimen; `faint` is decoration only, never text.
- Controls that exist only to drive the demo (state triggers, a theme switch) sit outside the window, under it, as quiet buttons or a toggle.
- With no navigation, the header is separated from the rows by a 1 px `line`.
- A window has 16 px side padding. Row dividers are inset by it; the divider under the header or the navigation spans the whole window. A row is at least 44 px and may grow.
- After the drop's cross, focus returns to where it was before the message.

## Changing a label by shared letters

Keep the common beginning of the two strings, erase the tail one letter per 16 ms, then type the new tail at the same pace. A new call interrupts the old one.

```js
function morphLabel(el, to) {
  clearInterval(el._ban);
  el._ban = setInterval(() => {
    const cur = el.textContent;
    let k = 0;
    while (k < cur.length && k < to.length && cur[k] === to[k]) k++;
    if (cur.length > k) el.textContent = cur.slice(0, -1);
    else if (cur.length < to.length) el.textContent = to.slice(0, cur.length + 1);
    else clearInterval(el._ban);
  }, 16);
}
```
