#!/usr/bin/env python3
"""seymurglv-kit installer: merges a settings fragment into ~/.claude/settings.json."""
import argparse
import copy
import json
import datetime
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable


def expand_home(obj, home):
    if isinstance(obj, str):
        return home + '/' + obj[2:] if obj.startswith('~/') else obj
    if isinstance(obj, list):
        return [expand_home(x, home) for x in obj]
    if isinstance(obj, dict):
        return {k: expand_home(v, home) for k, v in obj.items()}
    return obj


def script_name(hook):
    args = hook.get('args')
    if args:
        return os.path.basename(str(args[-1]))
    words = str(hook.get('command', '')).split()
    return os.path.basename(words[-1]) if words else ''


def _entry_scripts(entry):
    return {script_name(h) for h in entry.get('hooks', []) if isinstance(h, dict)} - {''}


def _show(value):
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def _merge_hooks(cur_events, frag_events):
    out = copy.deepcopy(cur_events)
    for event, entries in frag_events.items():
        existing = out.setdefault(event, [])
        present = set()
        for e in existing:
            present |= _entry_scripts(e)
        for entry in entries:
            names = _entry_scripts(entry)
            if names and names <= present:
                continue
            existing.append(copy.deepcopy(entry))
            present |= names
    return out


def _merge(cur, frag, force, path, msgs):
    out = copy.deepcopy(cur)
    for key, value in frag.items():
        here = path + [key]
        dotted = '.'.join(here)
        if key not in out:
            out[key] = copy.deepcopy(value)
        elif dotted == 'hooks' and isinstance(value, dict) and isinstance(out[key], dict):
            out[key] = _merge_hooks(out[key], value)
        elif isinstance(value, dict) and isinstance(out[key], dict):
            out[key] = _merge(out[key], value, force, here, msgs)
        elif dotted == 'permissions.allow' and isinstance(value, list) and isinstance(out[key], list):
            out[key] = out[key] + [x for x in value if x not in out[key]]
        elif isinstance(value, list):
            pass  # lists (incl. autoMode.soft_deny) are set only when absent
        elif out[key] != value:
            if force:
                out[key] = copy.deepcopy(value)
            else:
                msgs.append('kept yours: %s=%s (kit: %s)' % (dotted, _show(out[key]), _show(value)))
    return out


def merge_settings(current, fragment, force=False):
    msgs = []
    return _merge(current, fragment, force, [], msgs), msgs


def order_plugins(enabled, order):
    out = {k: enabled[k] for k in order if k in enabled}
    out.update({k: v for k, v in enabled.items() if k not in out})
    return out


@dataclass
class Part:
    id: str
    title: str
    kind: str
    default: bool
    plugin: str = None
    alias: list = field(default_factory=list)


def load_kit(root):
    root = Path(root)
    manifest = json.loads((root / 'kit.json').read_text(encoding='utf-8'))
    fragments = json.loads((root / 'settings' / 'claude.json').read_text(encoding='utf-8'))
    parts, seen = [], set()
    for entry in manifest['parts']:
        part = Part(entry['id'], entry['title'], entry['kind'], entry['default'],
                    entry.get('plugin'), list(entry.get('alias', [])))
        if part.id in seen:
            raise ValueError('repeated part id: ' + part.id)
        seen.add(part.id)
        if part.id not in fragments:
            raise ValueError('no settings fragment for part: ' + part.id)
        parts.append(part)
    return parts, fragments


ITERM_APP_CC_STATUS = '/Applications/iTerm.app/Contents/Resources/utilities/cc-status'
MARKET = 'seymurglv'
MARKET_SOURCE = 'seymurglv/seymurglv-kit'
HOOK_FILES = ('block_rm.py', 'trash.py')

Runner = Callable[[list], tuple]


def run_cmd(cmd):
    try:
        done = subprocess.run(cmd, capture_output=True, text=True)
    except OSError as e:
        return 127, str(e)
    return done.returncode, (done.stdout + done.stderr).strip()


def _read_json(path):
    try:
        text = Path(path).read_text(encoding='utf-8')
    except FileNotFoundError:
        return {}
    if not text.strip():
        return {}
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError('not a JSON object')
    return data


def _installed_ids(home):
    try:
        plugins = _read_json(Path(home) / '.claude' / 'plugins' / 'installed_plugins.json').get('plugins', {})
    except (ValueError, OSError):
        return set()
    return set(plugins) if isinstance(plugins, dict) else set()


def _plugin_installed(part, ids):
    return bool(part.plugin) and (part.plugin in ids or any(a in ids for a in part.alias))


def installed(parts, home):
    home = Path(home)
    ids = _installed_ids(home)
    try:
        settings = _read_json(home / '.claude' / 'settings.json')
    except (ValueError, OSError):
        settings = {}
    out = {}
    for part in parts:
        if part.kind == 'plugin':
            out[part.id] = _plugin_installed(part, ids)
        elif part.kind == 'hook':
            out[part.id] = all((home / '.claude' / 'hooks' / n).exists() for n in HOOK_FILES)
        else:
            out[part.id] = MARKET in settings.get('extraKnownMarketplaces', {})
    return out


def _installed_as(part, ids):
    """The id the part's plugin is installed under: its own, else an alias, else its own."""
    if part.plugin in ids:
        return part.plugin
    return next((a for a in part.alias if a in ids), part.plugin)


def _rename_plugin(frag, old, new):
    if old == new:
        return frag
    out = dict(frag)
    for key in ('enabledPlugins', 'pluginConfigs'):
        if isinstance(out.get(key), dict):
            out[key] = {(new if k == old else k): v for k, v in out[key].items()}
    return out


ID_MAPS = ('enabledPlugins', 'pluginConfigs', 'extraKnownMarketplaces')


def _changes(cur, new, path=()):
    out = []
    for key, value in new.items():
        dotted = '.'.join(path + (key,))
        if key not in cur:
            if isinstance(value, dict) and dotted in ID_MAPS:
                out.extend('add %s.%s' % (dotted, k) for k in value)
            else:
                out.append('add ' + dotted)
        elif isinstance(value, dict) and isinstance(cur[key], dict):
            out.extend(_changes(cur[key], value, path + (key,)))
        elif value != cur[key]:
            out.append('change ' + dotted)
    return out


def _reordered(cur, new):
    old = cur.get('enabledPlugins')
    now = new.get('enabledPlugins')
    if not isinstance(old, dict) or not isinstance(now, dict):
        return False
    return [k for k in now if k in old] != list(old)


def _backup_path(path, today):
    path = Path(path)
    n = 1
    while True:
        tag = '.before-kit-%s%s' % (today, '' if n == 1 else '-%d' % n)
        cand = path.with_name(path.stem + tag + path.suffix)
        if not cand.exists():
            return cand
        n += 1


def _drop_cc_status(fragment):
    hooks = fragment.get('hooks')
    if not hooks:
        return fragment, False
    dropped, kept = False, {}
    for event, entries in hooks.items():
        left = []
        for entry in entries:
            if any(script_name(h) == 'cc-status' for h in entry.get('hooks', [])):
                dropped = True
            else:
                left.append(entry)
        if left:
            kept[event] = left
    out = dict(fragment)
    if kept:
        out['hooks'] = kept
    else:
        del out['hooks']
    return out, dropped


def install(picked, fragments, root, home, run, dry_run=False, local=False, force=False,
            which=shutil.which):
    lines = _install(picked, fragments, root, home, run, dry_run, local, force, which)
    if dry_run:
        lines = [l if l.startswith(('would:', 'stop:')) else 'would: ' + l for l in lines]
    return lines


def _install(picked, fragments, root, home, run, dry_run, local, force, which):
    root, home = Path(root), Path(home)
    claude = home / '.claude'
    settings_path = claude / 'settings.json'
    lines = []
    today = datetime.date.today().isoformat()

    def say(real, would):
        lines.append('would: ' + would if dry_run else real)

    def step(cmd):
        if dry_run:
            lines.append('would: ' + ' '.join(cmd))
            return True
        code, out = run(cmd)
        if code != 0:
            last = out.strip().splitlines()[-1] if out.strip() else 'exit %d' % code
            lines.append('failed: %s: %s' % (' '.join(cmd), last))
            return False
        lines.append('ran: ' + ' '.join(cmd))
        return True

    # 1. preflight
    try:
        current = _read_json(settings_path)
    except (ValueError, OSError) as e:
        return ['stop: %s is not valid JSON (%s); nothing was changed' % (settings_path, e)]
    original = settings_path.read_bytes() if settings_path.exists() else None  # the owner's file, before the CLI touches it
    plugin_parts = [p for p in picked if p.kind == 'plugin']
    pre_ids = _installed_ids(home)  # before the CLI runs, so a dry run agrees with a real one
    if plugin_parts and not which('claude'):
        return ['stop: the claude command was not found; install Claude Code first, nothing was changed']

    # 2-3. marketplace and plugins
    if plugin_parts:
        try:
            known = _read_json(claude / 'plugins' / 'known_marketplaces.json')
        except (ValueError, OSError):
            known = {}
        if MARKET in known:
            cmd = ['claude', 'plugin', 'marketplace', 'update', MARKET]
        else:
            cmd = ['claude', 'plugin', 'marketplace', 'add', str(root) if local else MARKET_SOURCE]
        if not step(cmd):
            return lines
        for part in plugin_parts:
            if _plugin_installed(part, pre_ids):
                lines.append('already installed: ' + part.plugin)
            elif not step(['claude', 'plugin', 'install', part.plugin]):
                return lines

    # 4. rm guard files
    if any(p.kind == 'hook' for p in picked):
        hooks_dir = claude / 'hooks'
        for name in HOOK_FILES:
            src, dst = root / 'setup' / 'hooks' / name, hooks_dir / name
            if dst.exists() and dst.read_bytes() == src.read_bytes():
                lines.append('already in place: %s' % dst)
                continue
            if dst.exists():
                bak = _backup_path(dst, today)
                say('backup: %s' % bak, 'back up %s to %s' % (dst, bak))
                if not dry_run:
                    shutil.copy2(dst, bak)
            say('copied: %s' % dst, 'copy %s to %s' % (src, dst))
            if not dry_run:
                hooks_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
        if not step(['python3', str(hooks_dir / 'block_rm.py'), '--self-test']):
            return lines
        if sys.platform in ('darwin', 'win32'):
            if not step(['python3', str(hooks_dir / 'trash.py'), '--check']):
                return lines
        else:
            lines.append('skipped trash.py --check: no Trash route on this system')

    # 5-6. settings
    has_iterm = (home / '.config' / 'iterm2' / 'cc-status').exists() or Path(ITERM_APP_CC_STATUS).exists()
    try:
        current = _read_json(settings_path)  # the CLI may have changed it since preflight
    except (ValueError, OSError) as e:
        lines.append('failed: %s is not valid JSON after the plugin steps (%s)' % (settings_path, e))
        return lines
    merged = current
    for part in picked:
        frag = fragments.get(part.id)
        if not frag:
            continue
        if not has_iterm:
            frag, dropped = _drop_cc_status(frag)
            if dropped:
                lines.append('skipped cc-status: iTerm2 not found')
        if part.kind == 'plugin':
            frag = _rename_plugin(frag, part.plugin, _installed_as(part, pre_ids))
        merged, msgs = merge_settings(merged, expand_home(frag, str(home)), force)
        lines.extend(msgs)
    order = [_installed_as(p, pre_ids) if p.kind == 'plugin' else p.plugin for p in picked if p.plugin]
    if isinstance(merged.get('enabledPlugins'), dict):
        merged['enabledPlugins'] = order_plugins(merged['enabledPlugins'], order)
    if json.dumps(merged) == json.dumps(current):
        lines.append('already in place')
        return lines
    lines.extend(_changes(current, merged))
    if _reordered(current, merged):
        lines.append('reorder enabledPlugins')
    bak = _backup_path(settings_path, today) if original is not None else None
    if dry_run:
        if bak:
            lines.append('would: back up %s to %s' % (settings_path, bak))
        lines.append('would: write %s' % settings_path)
        return lines
    target = settings_path.resolve()  # a symlinked settings.json stays a symlink
    if bak:
        bak.write_bytes(original)
        shutil.copymode(target, bak)
        lines.append('backup: %s' % bak)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(target.name + '.kit-tmp')
    tmp.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    if target.exists():
        shutil.copymode(target, tmp)
    os.replace(tmp, target)
    try:
        _read_json(settings_path)
    except (ValueError, OSError) as e:
        lines.append('failed: %s does not parse after writing (%s)%s' % (
            settings_path, e, '; your copy is ' + str(bak) if bak else ''))
        return lines
    lines.append('written: %s' % settings_path)
    return lines


HEADER = 'seymurglv-kit — что ставим'
HINT = '↑↓ выбор · пробел отметить · Enter поставить · q выход'


def _usage_error(msg):
    print('install.py: ' + msg, file=sys.stderr)
    raise SystemExit(2)


class _Parser(argparse.ArgumentParser):
    def error(self, message):
        _usage_error(message)


def parse_args(argv):
    ap = _Parser(prog='install.py', add_help=True)
    ap.add_argument('--all', action='store_true', help='every part, banui included')
    ap.add_argument('--only', metavar='a,b', help='only these parts')
    ap.add_argument('--skip', metavar='a,b', help='all defaults except these')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--local', action='store_true')
    ap.add_argument('--force-settings', action='store_true')
    args = ap.parse_args(argv)
    if args.only is not None and args.all:
        _usage_error('--only and --all exclude each other')
    if args.only is not None and args.skip is not None:
        _usage_error('--only and --skip exclude each other')
    return args


def _ids(text):
    return [i for i in (text or '').split(',') if i]


def pick(parts, args, interactive):
    """The parts to install; None = refuse (message already printed)."""
    known = [p.id for p in parts]
    for i in _ids(args.only) + _ids(args.skip):
        if i not in known:
            print('install.py: unknown part %s (have: %s)' % (i, ', '.join(known)), file=sys.stderr)
            return None
    if args.only is not None:
        want = _ids(args.only)
        return [p for p in parts if p.id in want]
    if args.all or args.skip is not None:
        skip = _ids(args.skip)
        return [p for p in parts if (args.all or p.default) and p.id not in skip]
    if not interactive:
        print('install.py: no terminal — pass --all or --only <ids>', file=sys.stderr)
        return None
    return menu(parts) or []


def _draw(scr, parts, ticked, cur):
    import curses
    height, width = scr.getmaxyx()

    def put(y, text, attr=0):
        if y >= height or width < 2:
            return
        try:
            scr.addstr(y, 0, text[:width - 1], attr)
        except curses.error:
            pass

    scr.erase()
    put(0, HEADER, curses.A_BOLD)
    put(1, HINT)
    for n, p in enumerate(parts):
        row = '[%s] %-14s  %s' % ('x' if ticked[n] else ' ', p.id, p.title)
        put(3 + n, row, curses.A_REVERSE if n == cur else 0)


def menu(parts):
    import curses

    def run(scr):
        curses.curs_set(0)
        ticked = [p.default for p in parts]
        cur = 0
        while True:
            _draw(scr, parts, ticked, cur)
            key = scr.getch()
            if key == curses.KEY_UP:
                cur = (cur - 1) % len(parts)
            elif key == curses.KEY_DOWN:
                cur = (cur + 1) % len(parts)
            elif key == ord(' '):
                ticked[cur] = not ticked[cur]
            elif key in (10, 13, curses.KEY_ENTER):
                return [p for p, t in zip(parts, ticked) if t]
            elif key in (ord('q'), 27):
                return None

    return curses.wrapper(run)


def main(argv=None):
    try:
        return _main(argv)
    except KeyboardInterrupt:
        print('interrupted', file=sys.stderr)
        return 130


def _main(argv):
    args = parse_args(sys.argv[1:] if argv is None else argv)
    root, home = Path(__file__).resolve().parent, Path.home()
    parts, fragments = load_kit(root)
    if args.list:
        have = installed(parts, home)
        for p in parts:
            print('[%s] %s  %s' % ('x' if have.get(p.id) else ' ', p.id, p.title))
        return 0
    picked = pick(parts, args, sys.stdin.isatty())
    if picked is None:
        return 2
    if not picked:
        print('nothing picked')
        return 0
    lines = install(picked, fragments, root, home, run_cmd, dry_run=args.dry_run,
                    local=args.local, force=args.force_settings)
    for line in lines:
        print(line)
    return 1 if any(l.startswith(('failed:', 'stop:')) for l in lines) else 0


if __name__ == '__main__':
    raise SystemExit(main())
