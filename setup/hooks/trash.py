#!/usr/bin/env python3
"""Move files or folders to the Trash (macOS) or the Recycle Bin (Windows); never deletes (2026-10-25).

  python3 ~/.claude/hooks/trash.py <path> [<path> ...]     after the user's yes on the list
  python3 ~/.claude/hooks/trash.py --check                 self-test: one small temp file to the Trash, TRASH-CHECK PASS
  python3 ~/.claude/hooks/trash.py --help                  this text

macOS: moves each path to ~/.Trash/<name>-<YYYY-MM-DD> (a number is added if that name is taken), the same as
the old `mv <path> ~/.Trash/<name>-<YYYY-MM-DD>` rule. Windows: sends it to the Recycle Bin through
Microsoft.VisualBasic.FileIO (Restore puts it back where it was). The user empties the Trash or Recycle Bin.

Windows guard: .NET recycles with FOF_ALLOWUNDO + FOF_NOCONFIRMATION and no FOF_WANTNUKEWARNING, so Windows destroys,
without asking, an item it can't recycle; and .NET deletes for good when the process is not user-interactive. So each
move is refused when the process is not interactive (SSH, a service), the drive has no Recycle Bin (network, USB),
the bin is off (NukeOnDelete, the NoRecycleFiles policy), or the item does not fit in the bin's free room: its
MaxCapacity minus what <drive>\\$Recycle.Bin\\<SID> holds on disk, 1% kept spare. --check also proves the temp
file is in the bin and prints the room.
"""
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import date
from functools import lru_cache
from pathlib import Path

BITBUCKET = r"Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket\Volume"
POLICIES = r"Software\Microsoft\Windows\CurrentVersion\Policies\Explorer"
SPARE = 0.01      # share of the bin's limit kept free: room for the $I files and rounding
_bin_used = {}    # bytes in each volume's Recycle Bin: measured once per run, then grown by each move


def _gib(n):
    return f"{n / 2**30:.2f} GiB" if abs(n) >= 2**30 else f"{n / 2**20:.1f} MiB"


def _tree_size(p):
    """Bytes of a file or folder on disk; links, junctions and sockets count as themselves, not their targets."""
    s = os.lstat(p)
    if not stat.S_ISDIR(s.st_mode) or s.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
        return s.st_size
    total, todo = 0, [p]
    while todo:
        with os.scandir(todo.pop()) as it:
            for e in it:
                s = e.stat(follow_symlinks=False)
                if e.is_dir(follow_symlinks=False) and not s.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                    todo.append(e.path)
                else:
                    total += s.st_size
    return total


def _reg(key, name):
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key) as k:
            return winreg.QueryValueEx(k, name)[0]
    except OSError:
        return None


@lru_cache(None)
def _sid():
    whoami = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "whoami.exe")
    out = subprocess.run([whoami, "/user", "/fo", "csv", "/nh"], capture_output=True, text=True, errors="replace",
                         check=True).stdout
    return out.strip().rsplit(",", 1)[-1].strip('"')


def _recycle_bin(p):
    """(volume GUID, this user's bin folder, limit in bytes) for the drive of p; RuntimeError where Windows would
    delete instead of recycle."""
    import ctypes
    if _reg(POLICIES, "NoRecycleFiles") == 1:
        raise RuntimeError("the Recycle Bin is off by policy (NoRecycleFiles=1): Windows would delete it for good")
    mount, vol = ctypes.create_unicode_buffer(1024), ctypes.create_unicode_buffer(64)
    k32 = ctypes.windll.kernel32
    if not (k32.GetVolumePathNameW(str(p), mount, len(mount))
            and k32.GetVolumeNameForVolumeMountPointW(mount.value, vol, len(vol))):
        raise RuntimeError("not on a local drive (a network drive has no Recycle Bin): Windows would delete it for good")
    guid = vol.value[vol.value.index("{"):vol.value.index("}") + 1]    # \\?\Volume{...}\ -> {...}
    limit_mb = _reg(rf"{BITBUCKET}\{guid}", "MaxCapacity")
    if limit_mb is None:
        raise RuntimeError(f"no Recycle Bin on {mount.value} (a USB stick has none): Windows would delete it for good")
    if _reg(rf"{BITBUCKET}\{guid}", "NukeOnDelete") == 1:
        raise RuntimeError(f"the Recycle Bin on {mount.value} is set to delete at once (NukeOnDelete=1)")
    return guid, os.path.join(mount.value, "$Recycle.Bin", _sid()), limit_mb * 2**20


def _guard(p):
    """Refuse unless p surely fits in its Recycle Bin; returns (volume GUID, size) to book the move."""
    guid, bin_dir, limit = _recycle_bin(p)
    try:
        if guid not in _bin_used:
            _bin_used[guid] = _tree_size(bin_dir) if os.path.lexists(bin_dir) else 0
        size = _tree_size(str(p))
    except OSError as e:
        raise RuntimeError(f"can't measure {e.filename} ({e.strerror}), so can't prove it fits in the Recycle Bin")
    room = limit - _bin_used[guid] - int(limit * SPARE)
    if size > room:
        raise RuntimeError(f"too big for the Recycle Bin: {_gib(size)}, room {_gib(max(room, 0))} (limit {_gib(limit)}, "
                           f"in use {_gib(_bin_used[guid])}, 1% kept spare), so Windows would delete it for good. "
                           "Empty the Recycle Bin or raise its size (Recycle Bin > Properties) and run it again")
    return guid, size


def to_trash(p):
    p = Path(p).resolve()
    if not p.exists():
        raise FileNotFoundError(p)
    if sys.platform == "darwin":
        trash = Path.home() / ".Trash"
        dest = trash / f"{p.name}-{date.today():%Y-%m-%d}"
        n = 2
        while dest.exists():
            dest = trash / f"{p.name}-{date.today():%Y-%m-%d}-{n}"
            n += 1
        shutil.move(str(p), str(dest))
        return str(dest)
    if sys.platform == "win32":
        guid, size = _guard(p)
        kind = "DeleteDirectory" if p.is_dir() else "DeleteFile"
        ps = ("[Console]::OutputEncoding = [Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue'; "
              "if (-not [Environment]::UserInteractive) { exit 3 }; "
              "try { Add-Type -AssemblyName Microsoft.VisualBasic; "
              f"[Microsoft.VisualBasic.FileIO.FileSystem]::{kind}($env:TRASH_PATH, 'OnlyErrorDialogs', 'SendToRecycleBin') }} "
              "catch { $m = $_.Exception.GetBaseException().Message; "
              "if ($m.Contains([ComponentModel.Win32Exception]::new(120).Message)) { $m = '0x78 ' + $m }; "
              "[Console]::Error.Write($m); exit 1 }")
        r = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", ps],
                           env={**os.environ, "TRASH_PATH": str(p)}, capture_output=True, encoding="utf-8", errors="replace")
        err = r.stderr.strip()
        if r.returncode == 3:
            raise RuntimeError("not a user-interactive session (SSH, a service, a task with no desktop), where .NET "
                               "deletes for good instead of recycling; nothing moved. Run it from the desktop")
        if r.returncode and err.startswith("0x78 "):
            # SHFileOperation's DE_ACCESSDENIEDSRC reaches .NET as Win32 error 120, which reads "not supported"
            raise RuntimeError(f"Windows refused: security settings deny access to it or to something inside "
                               f"(SHFileOperation 0x78, which Windows words as \"{err[5:]}\"). Seen with admin-only "
                               "folders and with some leftover app sockets (spokenly-crash-*.sock). Move the items "
                               "inside one by one to find it; an admin-only one needs an admin shell")
        if r.returncode:
            raise RuntimeError(f"Windows did not recycle it: {err or f'powershell exit {r.returncode}'}")
        if p.exists():
            raise RuntimeError(f"still there after the move: {p}")
        _bin_used[guid] += size
        return "Recycle Bin"
    raise SystemExit(f"no Trash support for {sys.platform}: move {p} by hand")


def check():
    mark = "trash check\n"
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "trash-check.txt"
        f.write_text(mark)
        if sys.platform == "win32":
            guid, bin_dir, limit = _recycle_bin(f)
            before = set(os.listdir(bin_dir)) if os.path.isdir(bin_dir) else set()
        where = to_trash(f)
        ok = not f.exists()
    if sys.platform == "win32":
        # proof it was recycled, not deleted: a new $R file in the bin with the same text
        new = [Path(bin_dir, n) for n in set(os.listdir(bin_dir)) - before if n.startswith("$R")]
        ok = ok and any(n.is_file() and n.read_text() == mark for n in new)
        used = _bin_used[guid]
        print(f"Recycle Bin on {Path(bin_dir).anchor}: limit {_gib(limit)}, in use {_gib(used)}, "
              f"room {_gib(limit - used - int(limit * SPARE))} (1% kept spare)")
    print(f"moved a temp file to {where}: " + ("TRASH-CHECK PASS" if ok else "TRASH-CHECK FAIL"))
    return 0 if ok else 1


def main(args):
    if args == ["--check"]:
        return check()
    if args in (["-h"], ["--help"]):
        print(__doc__)
        return 0
    if not args:
        print(__doc__)
        return 2
    bad = 0
    for a in args:
        try:
            print(f"{a} -> {to_trash(a)}")
        except (OSError, RuntimeError, subprocess.CalledProcessError) as e:
            print(f"FAILED {a}: {e}", file=sys.stderr)
            bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
