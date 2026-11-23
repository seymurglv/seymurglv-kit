import io
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

ROOT = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, str(ROOT))

import install  # noqa: E402
from install import load_kit, parse_args, pick  # noqa: E402


class CliTests(unittest.TestCase):
    def setUp(self):
        self.parts, _ = load_kit(ROOT)

    def ids(self, argv, interactive=False):
        got = pick(self.parts, parse_args(argv), interactive)
        return None if got is None else [p.id for p in got]

    def test_all_includes_banui(self):
        self.assertEqual(self.ids(['--all']), [p.id for p in self.parts])
        self.assertIn('banui', self.ids(['--all']))

    def test_only(self):
        self.assertEqual(self.ids(['--only', 'waypoints,banui']), ['waypoints', 'banui'])

    def test_skip_from_defaults(self):
        want = [p.id for p in self.parts if p.default and p.id != 'settings']
        self.assertEqual(self.ids(['--skip', 'settings']), want)
        self.assertNotIn('banui', want)

    def test_all_with_skip(self):
        want = [p.id for p in self.parts if p.id != 'rm-guard']
        self.assertEqual(self.ids(['--all', '--skip', 'rm-guard']), want)

    def test_unknown_id_exit_2(self):
        err = io.StringIO()
        with redirect_stderr(err):
            self.assertIsNone(self.ids(['--only', 'nope']))
        self.assertIn('nope', err.getvalue())
        with redirect_stderr(io.StringIO()), mock.patch('sys.stdin.isatty', return_value=True):
            self.assertEqual(install.main(['--only', 'nope']), 2)

    def test_exclusive_flags_exit_2(self):
        for argv in (['--only', 'banui', '--all'], ['--only', 'banui', '--skip', 'settings']):
            with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as cm:
                parse_args(argv)
            self.assertEqual(cm.exception.code, 2)

    def test_no_tty_no_flags_refuses(self):
        err = io.StringIO()
        with redirect_stderr(err), mock.patch('sys.stdin.isatty', return_value=False):
            self.assertEqual(install.main([]), 2)
        self.assertIn('install.py: no terminal — pass --all or --only <ids>', err.getvalue())

    def test_keyboard_interrupt_returns_130(self):
        with mock.patch.object(install, 'pick', side_effect=KeyboardInterrupt):
            self.assertEqual(install.main(['--dry-run']), 130)

    def test_menu_draw_clips_to_small_terminal(self):
        import curses

        class Scr:
            def __init__(self, h, w):
                self.h, self.w, self.rows = h, w, []

            def getmaxyx(self):
                return self.h, self.w

            def erase(self):
                pass

            def addstr(self, y, x, text, attr=0):
                if y >= self.h or x + len(text) >= self.w + 1:
                    raise curses.error('too big')
                self.rows.append(text)

        scr = Scr(4, 20)
        install._draw(scr, self.parts, [True] * len(self.parts), 0)
        self.assertTrue(scr.rows)
        install._draw(Scr(1, 5), self.parts, [True] * len(self.parts), 0)

    def test_list_marks_installed(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            (home / '.claude').mkdir()
            out = io.StringIO()
            with redirect_stdout(out), \
                    mock.patch.object(install, 'installed', return_value={'waypoints': True}), \
                    mock.patch.object(Path, 'home', return_value=home):
                self.assertEqual(install.main(['--list']), 0)
        lines = out.getvalue().splitlines()
        self.assertEqual(len(lines), len(self.parts))
        by = {l[4:].split()[0]: l for l in lines}
        self.assertTrue(by['waypoints'].startswith('[x] '))
        self.assertTrue(by['banui'].startswith('[ ] '))


if __name__ == '__main__':
    unittest.main()
