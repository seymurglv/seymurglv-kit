# banui foundations

The values every branch uses. They are fixed: copy them, do not pick your own. Colors are not listed by value here: they are tokens in `kit/banui.css`, used as `var(--ban-<name>)`.

## Contents

- Tokens
- Sizes and type
- Motion

## Tokens

| Token | For |
|---|---|
| `bg` | the page, and a window on it |
| `card` | a raised surface; the inside of an outlined capsule |
| `surface2` | hover of a list row; the fill of a quiet button; a plate under a specimen |
| `text` | text, and the ink of signs |
| `muted` | secondary text; the outline of a control |
| `faint` | decoration only, never text |
| `line` | hairlines and dividers |
| `cap`, `cap-ink` | a filled capsule and what is written on it |
| `pen` | the pen stroke and the hand note |
| `done`, `error`, `rec`, `attention` | lamps only, through the `ban-lamp` class |
| `ui`, `hand` | the interface font and the hand note font |
| `e-spring`, `e-out`, `e-fold` | the three curves |
| `t-press`, `t-back`, `t-fast`, `t-mid`, `t-slow`, `t-fold`, `t-leave`, `t-pen`, `t-fade` | the timings of the motion table |
| `shadow` | under a list that has opened over the page |

`data-theme="light"` or `"dark"` on any element sets the theme of its subtree; with neither, the theme follows the system. Inside `.ban` that element also takes `bg` and `text`.

## Sizes and type

| What | Value |
|---|---|
| Control height | 28 px (capsule radius 14) |
| Toggle | 36 × 20 px |
| Status drop | 24 px high |
| Settings row | 44 px; right column of controls 220 px wide |
| Window | radius 14, padding 16, header 48 |
| Window shadow | `0 14px 32px -20px rgba(0, 0, 0, .35)`, on a window that stands on a page. Controls have no shadow; this one and the `shadow` token are the only two |
| Text | 13 px; 12 px in navigation, the drop, 24 px buttons, captions and meta lines |
| Reading text (a paragraph) | 13 px with line height 1.5 |
| Page behind a window | `bg`; the window is `bg` with a 1 px `line` border |
| Hand note | Caveat 600, 17 px, rotated −3° |
| Hairlines | 1 px `line`; control outline 1 px `muted`, 1.5 px `text` when a field is focused |

Two text sizes and the hand note. Hierarchy comes from weight (600 for a title) and space, never from a third size. System UI font; no web font for the interface.

## Motion

| What moves | Time | Curve | Token |
|---|---|---|---|
| Press (button shrinks to 0.97) | 120 ms | default | `t-press` |
| Release after a press (back to full size) | 260 ms | spring | `t-back` |
| Toggle | 200 ms | spring | `t-fast` |
| Navigation capsule, list height, field signs, row growing | 300 ms | spring | `t-mid` |
| Height of a window or panel | 300 ms | ease-out, no overshoot | `t-mid` |
| A card or row folding away after its answer (`ban-fold`) | 320 ms | fold: quick off the mark, no overshoot | `t-fold` |
| Leaving: what goes fades out | 180 ms | ease-in | `t-leave` |
| A quiet fade (a button stepping back) | 160 ms | default | `t-fade` |
| Status drop width | 420 ms | spring | `t-slow` |
| Label change by shared letters | 16 ms per letter | | |
| Pen stroke drawing | 400 ms | ease-out | `t-pen` |

- The shorter the path and the more frequent the action, the faster.
- Nothing moves by itself. Motion needs a cause: a press, or data arriving. A number that follows real progress (a percent, a timer) and a recording wave are data. The only decorative loops are the breathing of an attention lamp and of the three "thinking" dots.
- An attention lamp stops breathing once the person has looked: on hover, focus or press of its control.
- A message stays until the person closes it, acts on it, or a new one replaces it. No timer hides anything.
- Waiting is three breathing dots that become the result in place. Nothing rotates.
- A row or a control that grows uses the spring. The window around it has no transition of its own then: it simply follows. Ease-out without overshoot is for a window changing section.
- A label that changes by shared letters sits in a button whose width is fixed for the longest label.
- Leaving is quicker than arriving. What goes fades in 180 ms while its height folds; what arrives takes its 300 to 420 ms.
- A press goes down at once (120 ms) and comes back with the spring (260 ms). `ban-press` and `ban-button` do both.
- What did not move is not redrawn. Motion is a CSS transition wherever one can carry it. A view drawn by script draws only when something changed: every frame while it is dragged or travelling, at most 20 times a second for a slow drift at rest, not at all when still. After an answer the view is rebuilt once, when the last motion has ended.
- `prefers-reduced-motion: reduce` turns transitions and breathing off and makes label changes instant; states still change.
