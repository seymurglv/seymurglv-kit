# Review: check a UI against banui

The result is a list of findings, and the fixes when the person asked for them. Paths here are from the skill folder, where `SKILL.md` is.

## Steps

1. Run `node scripts/check.mjs <files or folders>`. It finds what a pattern can find: colors written by hand, a third text size, dialogs, toasts, spinners, gradients, icon sets.
2. Open the UI in a browser and go through what no pattern sees, in this order:
   - **Signs.** Is every control made of capsule, line, dot, lamp and pen stroke? Dots and lamps 3 px, lines 2 px, no halo, no icon.
   - **Lamps.** Only the four meanings, only on dots, the tone for the surface. Does a sign or words stand next to every color?
   - **States.** Press through every state of every control. Does a state move the same lines, or swap a drawing? Is each state readable with the color taken away?
   - **Where a result is shown.** A control's own result stays on that control; the drop says only what no control can.
   - **Waiting and messages.** Three breathing dots that become the result in place; nothing rotates; no timer hides anything.
   - **Asking.** A confirmation is a tray grown from the pressed control, with the safe choice in focus; danger is told by words.
   - **Sizes and motion.** Against the tables in the foundations.
   - **Both themes, the keyboard, reduced motion.**
3. Report. One line per finding, the worst first: where it is, which rule it breaks, what stands there instead. Group by screen. Say what you checked and what you could not.
4. Fix only when the person asked for a fix, and only what the findings name. Then run step 1 again and "Before showing" in `SKILL.md`.

A finding is a broken rule of the language, not a taste. What the rules do not cover goes into the report as a question for the owner, apart from the findings.

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
| An icon from a set next to a label "for clarity" | The label is enough. A glyph, where one is needed, is two or three lines. |
| A confirmation in a dialog over the page | A tray inside the row of the pressed control. |
| A third text size for a heading | 13 px at weight 600, and space above it. |
