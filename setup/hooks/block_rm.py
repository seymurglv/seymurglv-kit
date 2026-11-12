#!/usr/bin/env python3
"""PreToolUse hook on Bash and PowerShell: deny any command that deletes files (2026-10-16; PowerShell 2026-10-25;
git, find, interpreters and the rest 2026-10-29, after the agent architecture audit found 11 ways around it).

A text rule ("never type rm or rmdir") slipped 9 times in one week, so this blocks it mechanically.
Claude Code sends the tool call as JSON on stdin; a match prints a "deny" decision whose reason Claude reads
(code.claude.com/docs/en/hooks, PreToolUse decision control). No match, or input it can't read: exit 0 and
the normal permission flow applies.

Caught: `rm x`, `cd d && rm -rf x`, `sudo rm`, `command rm`, `\\rm`, `/bin/rm`, `xargs rm`, `find -exec rm`,
`bash -c 'rm x'`, `eval "rm x"`, `$(rm x)`; `unlink`, `shred`, `truncate`, `find -delete`, `mv x /dev/null`;
`git clean` (not with -n or --dry-run), `git reset --hard`, `git checkout` with `--`, `.` or `-f`, `git restore`
(not `--staged` alone), `git stash drop|clear`; delete calls in `python -c`, `node -e`, `perl -e`, `ruby -e` code or in
an interpreter's heredoc (os.remove, os.unlink, shutil.rmtree, Path.unlink, fs.rmSync, fs.unlinkSync and the like);
`powershell -c '...'` run from Bash. Not caught on purpose: `git rm` (a git subcommand; the file stays in git history),
the word rm inside quoted text or heredoc bodies (data, not commands). Known gap: a script saved to a file and run
after (`python x.py`), which is how trash.py works too.
PowerShell (Windows): Remove-Item and its aliases (rm, rmdir, del, erase, rd, ri), Clear-Content (clc),
`cmd /c del`, .NET Delete() calls on files and folders, Clear-RecycleBin, the git and interpreter cases above, and
`bash -c '...'` run from PowerShell.
The copy that runs is ~/.claude/hooks/block_rm.py, registered in ~/.claude/settings.json (PreToolUse, matcher
Bash|PowerShell on Windows, Bash on the Mac); setup/README.md shows the lines.
Self-test: python3 ~/.claude/hooks/block_rm.py --self-test (every case in BLOCK and ALLOW at the bottom).
"""
import json
import re
import sys
from pathlib import Path

# trash.py is installed next to this hook, so one hint works in every project and on every machine.
TRASH = "$HOME/.claude/hooks/trash.py"
REASON = ("Blocked by the rm hook: deletes never run here. "
          "A delete needs the user's yes in chat on the list; then move it to the Trash instead: "
          f'python3 "{TRASH}" <path> (python on Windows; macOS Trash or Windows Recycle Bin). '
          "To undo your own edit, edit it back. Temp files stay in the session scratchpad.")

# Where a new command starts: line start, ; & | ( ` or $( ... and `-exec`-style options of find.
START = r"(?:^|[;&|(`\n{]|\$\(|\s-(?:exec|execdir|ok|okdir)\s)"
# Shell keywords and words that run the next word as a command.
PREFIX = r"(?:(?:then|do|else|if|while|until|!|sudo|doas|command|builtin|exec|nohup|time|nice|env|xargs)(?:\s+(?:-\S+|\w+=\S*))*\s+)*"
RM = re.compile(START + r"\s*" + PREFIX + r"(?:\\|[\w./~-]*/)?(?:rm|rmdir|unlink|shred|truncate)(?=$|[\s;&|)`])", re.M)
FIND_DEL = re.compile(START + r"\s*" + PREFIX + r"(?:[\w./~-]*/)?find\b[^;&|\n]*\s-delete(?=$|[\s;&|)`])", re.M)
MV_NULL = re.compile(START + r"\s*" + PREFIX + r"(?:[\w./~-]*/)?mv\b[^;&|\n]*\s/dev/null(?=$|[\s;&|)`])", re.M)
SHELL_C = re.compile(r"(?:\b(?:ba|z|da|k)?sh(?:\.exe)?\s+(?:-\w+\s+)*-c|\beval)\s+(['\"])(.*?)(?<!\\)\1", re.S)
PS_SHELL = re.compile(r"\b(?:pwsh|powershell)(?:\.exe)?\s+(?:-\w+\s+)*-(?:c|command)\s+(['\"])(.*?)(?<!\\)\1", re.S | re.I)
HEREDOC = re.compile(r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n.*?\n\s*\1\b", re.S)
QUOTED = re.compile(r"'[^']*'|\"(?:\\.|[^\"\\])*\"")
# git: global options (-C dir, --git-dir=...), then a subcommand that can throw away files or work; git_deletes() reads its args.
GIT = (r"(?:[\w./~-]*/)?git(?:\.exe)?((?:\s+-[Cc]\s+\S+|\s+--[\w-]+(?:=\S+)?)*)\s+(clean|reset|checkout|restore|stash)\b"
       r"([^;&|\n)}]*)")
GIT_SH = re.compile(START + r"\s*" + PREFIX + GIT, re.M)
# Code run by an interpreter (-c / -e / --eval, or a heredoc fed to it) is checked for delete calls by name.
INTERP = re.compile(r"\b(?:python[\d.]*|py|node|perl|ruby|deno|bun)(?:\.exe)?(?=\s)[^\n]*?(?:\s-(?:c|e|-eval)(?=\s)|<<)", re.I)
DEL_API = re.compile(r"\b(?:os\.(?:remove|unlink|rmdir|removedirs)|shutil\.rmtree|rmtree|rmSync|rmdirSync|unlinkSync|"
                     r"rm_rf|rm_r|fs\.(?:rm|rmdir|unlink)|unlink)\b|(?<![\w.])rm\s+-[rRf]")
# PowerShell: a delete cmdlet or alias as a command word, cmd's del/rd, .NET Delete() on files or folders.
PS_START = r"(?:^|[;|({}\n]|&&|\|\||\$\()"
PS_RM = re.compile(PS_START + r"\s*(?:&\s*)?(?:remove-item|rm|rmdir|del|erase|rd|ri|clear-recyclebin|clear-content|clc)"
                   r"(?=$|[\s;|)}])", re.I | re.M)
PS_CMD = re.compile(r"\bcmd(?:\.exe)?\s+/{1,2}[ck]\s+.*?\b(?:del|erase|rd|rmdir)\b", re.I)
PS_NET = re.compile(r"\[(?:System\.)?IO\.(?:File|Directory)\]::Delete\s*\(|\.Delete\s*\(\s*(?:\$true)?\s*\)", re.I)
PS_QUOTED = re.compile(r"'(?:[^']|'')*'|\"(?:`.|[^\"`])*\"")
PS_HERE = re.compile(r"@(['\"])\r?\n.*?\r?\n\1@", re.S)
GIT_PS = re.compile(PS_START + r"\s*(?:&\s*)?" + GIT, re.I | re.M)


def git_deletes(pattern, text):
    for m in pattern.finditer(text):
        sub, flags = m.group(2).lower(), m.group(3).split()
        if sub == "clean":
            hit = not any(f == "--dry-run" or re.fullmatch(r"-[a-zA-Z]*n[a-zA-Z]*", f) for f in flags)
        elif sub == "reset":
            hit = "--hard" in flags
        elif sub == "checkout":
            hit = any(f in ("--", ".", "-f", "--force") for f in flags)
        elif sub == "restore":
            # --staged alone only unstages; anything else rewrites the working tree.
            hit = not ({"--staged", "-S"} & set(flags)) or bool({"--worktree", "-W"} & set(flags))
        else:
            hit = bool(flags) and flags[0] in ("drop", "clear")
        if hit:
            return True
    return False


def interp_deletes(cmd):
    return any(DEL_API.search(cmd, m.start()) for m in INTERP.finditer(cmd))


def uses_rm(cmd, depth=0):
    if depth > 3:
        return False
    # Code passed to another shell is a command too: check it on its own.
    if any(uses_rm(m.group(2), depth + 1) for m in SHELL_C.finditer(cmd)):
        return True
    if any(ps_uses_rm(m.group(2), depth + 1) for m in PS_SHELL.finditer(cmd)):
        return True
    if interp_deletes(cmd) or PS_CMD.search(cmd):
        return True
    text = HEREDOC.sub("\n", cmd)
    # Command substitution inside double quotes still runs: keep $(...) bodies, drop the rest of quoted text.
    subs = re.findall(r"\$\(([^()]*)\)", text)
    if any(uses_rm(s, depth + 1) for s in subs):
        return True
    text = QUOTED.sub("''", text)
    return bool(RM.search(text) or FIND_DEL.search(text) or MV_NULL.search(text) or git_deletes(GIT_SH, text))


def ps_uses_rm(cmd, depth=0):
    if depth > 3:
        return False
    if any(uses_rm(m.group(2), depth + 1) for m in SHELL_C.finditer(cmd)):
        return True
    if interp_deletes(cmd):
        return True
    text = PS_HERE.sub("''", cmd)
    if PS_CMD.search(text) or PS_NET.search(text):
        return True
    text = PS_QUOTED.sub("''", text)
    return bool(PS_RM.search(text) or git_deletes(GIT_PS, text))


BLOCK = [
    ("Bash", "rm x"), ("Bash", "cd d && rm -rf x"), ("Bash", "find . -name x -exec rm {} \\;"),
    ("Bash", "find . -name x -delete"), ("Bash", "git clean -fdx"), ("Bash", "git -C projects/demo clean -fd"),
    ("Bash", "git reset --hard"), ("Bash", "git reset --hard HEAD~1"), ("Bash", "git checkout -- ."),
    ("Bash", "git checkout ."), ("Bash", "git checkout -f main"), ("Bash", "git restore x.md"),
    ("Bash", "git restore --staged --worktree x"), ("Bash", "git stash drop"), ("Bash", "git stash clear"),
    ("Bash", "python3 -c \"import os; os.remove('x')\""), ("Bash", "python -c \"import shutil; shutil.rmtree('d')\""),
    ("Bash", "python3 -c \"from pathlib import Path; Path('x').unlink()\""), ("Bash", "python3 -c \"import os; os.system('rm -rf d')\""),
    ("Bash", "node -e \"require('fs').rmSync('d', {recursive: true})\""), ("Bash", "node -e \"fs.unlinkSync('x')\""),
    ("Bash", "perl -e 'unlink \"x\"'"), ("Bash", "python3 - <<'EOF'\nimport os\nos.remove('x')\nEOF"),
    ("Bash", "unlink x"), ("Bash", "shred -u x"), ("Bash", "truncate -s 0 x"), ("Bash", "mv x /dev/null"),
    ("Bash", "bash -c 'git clean -fd'"), ("Bash", "powershell -Command \"Remove-Item x\""), ("Bash", "cmd //c del x"),
    ("PowerShell", "Remove-Item x"), ("PowerShell", "Get-ChildItem x | Remove-Item"), ("PowerShell", "del x"),
    ("PowerShell", "Clear-Content x"), ("PowerShell", "cmd /c rd /s /q d"), ("PowerShell", "[IO.File]::Delete('x')"),
    ("PowerShell", "Get-ChildItem x | ForEach-Object { $_.Delete() }"), ("PowerShell", "git clean -fd"),
    ("PowerShell", "git reset --hard"), ("PowerShell", "python -c \"import os;os.remove('x')\""),
    ("PowerShell", "bash -c 'rm x'"),
]
ALLOW = [
    ("Bash", "git status"), ("Bash", "git rm --cached x"), ("Bash", "git commit -m \"git clean -fdx and rm -rf are blocked\""),
    ("Bash", "git checkout main"), ("Bash", "git checkout -b fix/hook"), ("Bash", "git restore --staged x"),
    ("Bash", "git clean -n"), ("Bash", "git clean -fdn"), ("Bash", "git clean --dry-run -d"), ("Bash", "git reset --soft HEAD~1"),
    ("Bash", "git reset HEAD x"), ("Bash", "git stash list"), ("Bash", "git stash pop"), ("Bash", "git log --oneline -5"),
    ("Bash", "python3 ~/.claude/hooks/trash.py x"), ("Bash", "python3 -c \"import keys; print(bool(keys.get('X')))\""),
    ("Bash", 'python3 "$HOME/.claude/hooks/trash.py" --check'), ("Bash", f'python3 "{TRASH}" x'),
    ("Bash", "node -e \"console.log(1)\""), ("Bash", "python3 -c \"print([1, 2].remove(1))\""),
    ("Bash", "find . -name '*.py'"), ("Bash", "mv a.txt b.txt"), ("Bash", "echo \"rm -rf /\""),
    ("Bash", "cat <<'EOF' > notes.md\nrm x and os.remove(x) are just text here\nEOF"), ("Bash", "npm run build"),
    ("Bash", "ls -la /dev/null"), ("Bash", "grep -rn unlink src"),
    ("PowerShell", "Get-ChildItem"), ("PowerShell", "git status"), ("PowerShell", "git checkout main"),
    ("PowerShell", "Write-Output 'Remove-Item x'"), ("PowerShell", "python ~/.claude/hooks/trash.py x"),
    ("PowerShell", 'python3 "$HOME/.claude/hooks/trash.py" --check'), ("PowerShell", f'python3 "{TRASH}" x'),
    ("PowerShell", "git commit -m 'git reset --hard is blocked'"),
]


def blocked(tool, cmd):
    return (tool == "Bash" and uses_rm(cmd)) or (tool == "PowerShell" and ps_uses_rm(cmd))


def self_test():
    fails = [("should block", t, c) for t, c in BLOCK if not blocked(t, c)]
    fails += [("should allow", t, c) for t, c in ALLOW if blocked(t, c)]
    # The hint must work on any machine: it points at the installed trash.py, not at a project folder.
    if "git rev-parse" in REASON or "$HOME/.claude/hooks/trash.py" not in REASON:
        fails.append(("hint must point at ~/.claude/hooks/trash.py", "-", REASON))
    if "python on Windows" not in REASON:
        fails.append(("hint must name the Windows interpreter", "-", REASON))
    for kind, tool, cmd in fails:
        print(f"FAIL {kind}: {tool}: {cmd!r}")
    total = len(BLOCK) + len(ALLOW) + 2
    print(f"{total - len(fails)}/{total} passed")
    return 1 if fails else 0


def main():
    if sys.argv[1:] == ["--self-test"]:
        return self_test()
    try:
        data = json.load(sys.stdin)
        cmd = data.get("tool_input", {}).get("command", "")
    except (ValueError, AttributeError):
        return 0
    if isinstance(cmd, str) and blocked(data.get("tool_name"), cmd):
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                                 "permissionDecision": "deny",
                                                 "permissionDecisionReason": REASON}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
