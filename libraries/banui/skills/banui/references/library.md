# Library: add, update or delete a reference

A reference is finished work kept inside this skill for the next agent to copy: a screen is a folder in `examples/`, a control is a section in `references/controls.md`. `kit/` is not a reference: it is a copy of the built library, written by its build, and is never edited by hand. Paths here are from the skill folder, where `SKILL.md` is.

Rules, tokens and values of the language do not change while references are worked on. They change only on the owner's decision, never as a side effect.

## Add

Only work the owner has seen and accepted, and that passes "Before showing" in `SKILL.md`.

- **A screen**: a new folder `examples/<kind>-<name>/` (lowercase letters, digits and hyphens, like `screen-settings`) with its `index.html` and its own CSS and JS. It links the kit as `../../kit/banui.css` and holds no copy of it. Leave out everything that belongs to the product: real data, names, network calls.
- **A control**: a new section in `references/controls.md` (states table, which signs carry them, glyph offsets) and its line in the Contents list there.
- If a folder or section with that name exists, this is an update: say so and switch.

## Update

1. Show the owner what will change in the stored reference before you write.
2. Change only that reference.
3. If the change makes another reference or a line of `SKILL.md` untrue, name it and ask.

## Delete

1. Name exactly what goes: the folder path, or the section title. Wait for the owner's yes.
2. Move the folder to the Trash, do not erase it. Cut a section out of `references/controls.md` together with its Contents line.
3. Search `SKILL.md`, `references/` and the other examples for mentions of it and fix or report each one. `examples/screen-settings/` is named in `SKILL.md` and in the Design playbook: if it goes, name another working screen there.

## After any of the three

Run `node scripts/check.mjs examples/` and open every changed example in a browser. Say what you checked.
