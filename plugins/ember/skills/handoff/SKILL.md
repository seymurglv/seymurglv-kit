---
name: handoff
description: Write a handoff of this chat so a fresh chat can carry on from it alone. Use when the person says "handoff", "хэндофф", "передай в новый чат", "подведи итог перед очисткой", "wrap up", or is about to /clear a long chat. ember's Handoff button on the band and /ember:handoff run it, then the band offers to clear the chat and send the handoff as the new chat's first message.
---

# Handoff

A note from you to the next instance of you. The person clears this chat, the
new chat reads only this note, and it must be able to go on without asking what
happened. It is not a report for the person and not a retrospective.

ember reads your answer from the line that starts with `# Handoff`, so begin
the handoff with that heading and put nothing after its last section.

## Gather

1. Go through the whole conversation, not its last turns: the ask and its
   constraints usually sit at the start.
2. Take what this session itself did and saw: the files it changed or wrote,
   the plan file it followed, the tasks it left open, the background shells and
   servers it started (their ids and how to stop them), the questions left
   unanswered on either side.
3. Do not search the disk, read git history or run tools to rebuild the
   picture. What this chat did not touch does not belong in the note.

## Write

In English, unless the person asks for the handoff in another language. Every
section, every time; a section with nothing to say holds `none`.

```
# Handoff: <what this chat was about, one line>

## Goal
<the ask and the constraints that matter, two or three sentences>

## Done and decided
- <decision or change>: <why>; <absolute path when it is a file>

## Read first
- `<absolute path>`: <why the next chat needs it>

## Still running
- <shell id, server and port, worktree or branch>: <how to stop it>

## How to check
- `<command>`: <what it should show>

## Open
- <question or deferred item>: <what it waits on>

## Next step
<the one most likely next action, one or two sentences>
```

## Rules

- In this chat only: no file, no memory. ember keeps the text until it is sent
  and writes it nowhere.
- Never invent state, a path or an id. Unsure: leave it out or say so.
- Absolute paths, so the next chat can open them from any folder.
- A plan file that drove the work goes first under Read first.
- Plain and short: no praise, no emoji, no list of everything said.
