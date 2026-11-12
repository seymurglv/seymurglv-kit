# setup

Files a machine needs once. They are not plugins: nothing installs them for you.

## The rm guard

`hooks/block_rm.py` is a Claude Code PreToolUse hook that denies every command that deletes files (rm,
find -delete, git clean, Remove-Item, delete calls in interpreter one-liners and the rest; the list is in its
docstring). A delete then goes through `hooks/trash.py`, which moves the path to the macOS Trash or the Windows
Recycle Bin, and only after the owner's yes in chat.

Install on a Mac:

```sh
mkdir -p ~/.claude/hooks
cp setup/hooks/block_rm.py setup/hooks/trash.py ~/.claude/hooks/
python3 ~/.claude/hooks/block_rm.py --self-test
python3 ~/.claude/hooks/trash.py --check
```

Then register the hook in `~/.claude/settings.json`, under `hooks` (merged with what is there):

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "python3 ~/.claude/hooks/block_rm.py" }]
    }
  ]
}
```

On Windows the matcher is `Bash|PowerShell` and the command is the full path to `python.exe` with the script as
its argument.

The copies that run are the ones in `~/.claude/hooks/`. The ones here are the source: change them here, then
copy them over again.

For OpenCode the guard is a list of deny rules; see [`AGENTS.md`](../AGENTS.md).
