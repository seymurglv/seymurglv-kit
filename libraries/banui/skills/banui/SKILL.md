---
name: banui
description: The banui design language - quiet interfaces where every control is built from five signs (capsule, line, dot, lamp, pen stroke), with fixed tokens, a control library and finished examples. Use when designing, mocking up, prototyping, building, reviewing or fixing any UI, screen, control or state in banui, when putting banui into a React or Next.js project, or when someone mentions banui, "our style", the five signs, the status drop or the lamp. Also when someone wants to add, update or delete a stored banui reference ("add this to the references", "save this as an example", "update the reference", "delete the example"), and when a banui design drifts into generic UI - invented colors or sizes, red errors, spinners, modals, toasts, a meaning told by color alone.
---

# banui

A quiet interface where everything is built from five signs, and a state is a new position of the same lines.

**The values are fixed.** Agents who know only the idea of banui get its spirit right and its numbers wrong: 6 px dots, 8 px lamps with a halo, 1.5 px lines, a red error, an invented palette. Do not pick sizes, colors or timings: copy them.

## Pick the branch

The skill does one of four jobs. When the request does not say which, ask once, with these four options, before doing anything else. Read the files of the branch in the order given, before you write.

| Branch | The person wants | Read |
|---|---|---|
| **Design** | a screen, a control or a state as a page to look at | [foundations](references/foundations.md), [design](references/design.md), [controls](references/controls.md) |
| **Implement** | banui inside a React or Next.js product | [foundations](references/foundations.md), [implement](references/implement.md), [controls](references/controls.md) |
| **Review** | an existing UI checked against banui, or fixed | [foundations](references/foundations.md), [review](references/review.md) |
| **Library** | finished work stored in the skill, a stored one updated or deleted | [library](references/library.md) |

What lies next to this file:

| Folder | What it is |
|---|---|
| `kit/` | the built library: `banui.css` (every token, the signs, the controls) and `index.js` (`mount()` and the controls). A build writes it. Copy it whole, never edit it |
| `examples/` | finished screens to start from; `examples/screen-settings/` is a working one |
| `references/` | the values, the playbook of each branch, the control recipes |
| `scripts/check.mjs` | finds what the rules below forbid in a page or a component |

Talk to the owner in the language they write in. UI copy follows the product's language.

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

The values above are for the light theme; in the dark theme the two columns swap, and `banui.css` does that for you. The table is here to be recognized, not typed: in a page a lamp is the `ban-lamp` class, which picks the tone by surface.

- **Error is amber. Red means recording and nothing else.** Attention (nothing is broken, but look) is blue.
- **Working, saving, loading have no color.** They are three breathing dots in ink.
- Meaning color lives only in the 3 px lamp. Text, lines, glyphs, outlines and fills stay ink: an error never turns a field's outline or its text amber.
- Color never speaks alone: a sign or words stand next to it.
- A new meaning needs the owner's decision. Do not add a fifth color.
- **Danger has no color.** A destructive action is carried by its words and by a confirmation tray in which the safe choice takes focus.
- A control's own result (saved, invalid, failed) is shown on that control. The status drop is only for what no control on screen can show.

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

Every other number (sizes, type, motion) is in [foundations](references/foundations.md). Read it before you write a value.

## Before showing

Every branch ends here.

1. Run `node scripts/check.mjs <the files you wrote>` from this folder. Each hit is fixed, or shown to the owner with the reason it stays.
2. Open the work in a browser and go through the list:

- [ ] Tokens come from `banui.css` unchanged; no color written by hand.
- [ ] Every dot and lamp is 3 px, every sign line 2 px (pen stroke 1.75 px, outlines 1 to 1.5 px), no halo.
- [ ] Lamp colors are only the four from the map, only on dots, with the tone for their surface.
- [ ] Error is amber with words; nothing red except a recording lamp.
- [ ] Text sizes are 13 and 12 (plus the 17 px hand note).
- [ ] No timer hides a message; nothing rotates; no modal or toast.
- [ ] Every state is readable without color.
- [ ] Light and dark both checked; keyboard focus is visible on every control.
- [ ] Clicked through every state.
