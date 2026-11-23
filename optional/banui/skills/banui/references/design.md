# Design: a screen, a control or a state

The result is a page that opens in a browser from a folder: plain HTML, CSS and a script, with the kit beside it. Paths here are from the skill folder, where `SKILL.md` is.

## Steps

1. Copy the `kit/` folder beside the page and link `kit/banui.css` unchanged. Wrap the page in `.ban`. Do not rename or re-pick anything in the kit.
2. Start from the closest finished work: a screen in `examples/` (copy the folder of `examples/screen-settings/` and change it), a recipe in the control recipes. Read the recipe before building a field, a toggle, a list, navigation, a button, a tray, the status drop or a pen mark.
3. Write one element per control with its `ban-*` class, then call `mount()` from `kit/index.js`: it builds every control on the page. What each control is written as, and what it reports, is in the control recipes and in the comments of `kit/index.d.ts`.
4. Your own CSS is layout only: sizes from the foundations, colors as `var(--ban-<token>)`, timings as `var(--ban-t-<name>)` with a curve `var(--ban-e-<name>)`.
5. What no reference covers, build from the signs: see "Inventing a control" below.
6. Show every state. Controls that exist only to drive the demo (state triggers, a theme switch) sit outside the window, under it, as quiet buttons or a toggle.
7. Finish with "Before showing" in `SKILL.md`: the checker, then the list, in a browser, in both themes.

## Inventing a control

The language has few ready controls. When you need a new one:

1. Write its states as a table: state, which sign carries it, where the lines stand.
2. Use positions, not new shapes: lying or standing lines, a dot that stretches, a capsule that slides or grows. The primitives are in the kit: `ban-cap` (a filled capsule), `ban-out` (an outlined one), `ban-ln` (the line and dot, placed with `--x`, `--y`, `--r`, `--k`), `ban-lamp`, `ban-breathe`, `ban-press`, `ban-grown`, `ban-fold`.
3. Unavailable is always a dot. Selected is always a capsule or a line.
4. A state change moves the same elements. Never swap one drawing for another.
5. Say in one line which signs it is made of. If you need a sixth sign, stop and ask the owner.

## What the owner decides

Stop and ask before any of these; none is a side effect of a design:

- a new lamp meaning or a fifth color;
- a sixth sign;
- a size, a timing or a token that is not in the foundations;
- an exception to "What banui never has".
