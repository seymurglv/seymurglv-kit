import datetime
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, str(ROOT))

import install  # noqa: E402
from install import install as run_install, installed, load_kit  # noqa: E402

TODAY = datetime.date.today().isoformat()


class Fake:
    def __init__(self, code=0, out=''):
        self.calls, self.code, self.out = [], code, out

    def __call__(self, cmd):
        self.calls.append(cmd)
        return self.code, self.out


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        self.claude = self.home / '.claude'
        self.claude.mkdir()
        self.settings = self.claude / 'settings.json'
        self.parts, self.frags = load_kit(ROOT)
        self.by_id = {p.id: p for p in self.parts}
        self.run = Fake()
        self.iterm = mock.patch.object(install, 'ITERM_APP_CC_STATUS', str(self.home / 'none'))
        self.iterm.start()
        self.addCleanup(self.iterm.stop)

    def go(self, ids=None, **kw):
        picked = [p for p in self.parts if ids is None or p.id in ids]
        kw.setdefault('which', lambda name: '/usr/bin/claude')
        return run_install(picked, self.frags, ROOT, self.home, self.run, **kw)

    def read(self):
        return json.loads(self.settings.read_text(encoding='utf-8'))

    def test_missing_settings_created(self):
        self.go(['cache-lamp'])
        self.assertTrue(self.read()['enabledPlugins']['cache-lamp@seymurglv'])

    def test_invalid_settings_stops_before_any_change(self):
        self.settings.write_bytes(b'{ not json')
        lines = self.go()
        self.assertTrue(lines[0].startswith('stop:'))
        self.assertEqual(self.run.calls, [])
        self.assertEqual(self.settings.read_bytes(), b'{ not json')
        self.assertEqual(list(self.claude.iterdir()), [self.settings])

    def test_rerun_keeps_owner_scalar(self):
        self.go(['settings'])
        data = self.read()
        data['theme'] = 'dark'
        self.settings.write_text(json.dumps(data), encoding='utf-8')
        lines = self.go(['settings'])
        self.assertIn('kept yours: theme=dark (kit: auto)', lines)
        self.assertEqual(self.read()['theme'], 'dark')

    def test_no_claude_stops(self):
        lines = self.go(['cache-lamp'], which=lambda name: None)
        self.assertTrue(lines[0].startswith('stop:'))
        self.assertEqual(self.run.calls, [])
        self.assertFalse(self.settings.exists())

    def test_existing_rm_guard_entry_not_duplicated(self):
        guard = str(self.claude / 'hooks' / 'block_rm.py')
        entry = {'matcher': 'Bash', 'hooks': [{'type': 'command', 'command': '/usr/bin/python3', 'args': [guard]}]}
        self.settings.write_text(json.dumps({'hooks': {'PreToolUse': [entry]}}), encoding='utf-8')
        self.go(['rm-guard'])
        self.assertEqual(self.read()['hooks']['PreToolUse'], [entry])
        self.assertTrue((self.claude / 'hooks' / 'block_rm.py').exists())
        self.assertTrue((self.claude / 'hooks' / 'trash.py').exists())

    def test_rm_guard_runs_self_tests(self):
        self.go(['rm-guard'])
        h = str(self.claude / 'hooks')
        self.assertIn(['python3', h + '/block_rm.py', '--self-test'], self.run.calls)
        self.assertIn(['python3', h + '/trash.py', '--check'], self.run.calls)

    def test_only_picked_parts(self):
        self.go(['cache-lamp'])
        self.assertIn(['claude', 'plugin', 'install', 'cache-lamp@seymurglv'], self.run.calls)
        self.assertEqual([c for c in self.run.calls if 'install' in c and c[1] == 'plugin' and c[2] == 'install'],
                         [['claude', 'plugin', 'install', 'cache-lamp@seymurglv']])
        self.assertEqual(set(self.read()), {'enabledPlugins', 'pluginConfigs'})
        self.assertEqual(list(self.read()['enabledPlugins']), ['cache-lamp@seymurglv'])

    def test_marketplace_add_then_update(self):
        self.go(['cache-lamp'])
        self.assertEqual(self.run.calls[0], ['claude', 'plugin', 'marketplace', 'add', 'seymurglv/seymurglv-kit'])
        (self.claude / 'plugins').mkdir()
        (self.claude / 'plugins' / 'known_marketplaces.json').write_text('{"seymurglv": {}}', encoding='utf-8')
        self.run.calls.clear()
        self.go(['cache-lamp'])
        self.assertEqual(self.run.calls[0], ['claude', 'plugin', 'marketplace', 'update', 'seymurglv'])

    def test_local_uses_clone_path(self):
        self.go(['cache-lamp'], local=True)
        self.assertEqual(self.run.calls[0], ['claude', 'plugin', 'marketplace', 'add', str(ROOT)])

    def test_taste_alias_counts_as_installed(self):
        (self.claude / 'plugins').mkdir()
        (self.claude / 'plugins' / 'installed_plugins.json').write_text(
            json.dumps({'version': 2, 'plugins': {'taste-skill@taste-skill': [{}]}}), encoding='utf-8')
        lines = self.go(['taste-skill'])
        self.assertIn('already installed: taste-skill@seymurglv', lines)
        self.assertFalse([c for c in self.run.calls if c[:3] == ['claude', 'plugin', 'install']])
        self.assertTrue(installed(self.parts, self.home)['taste-skill'])

    def test_alias_install_enabled_under_alias(self):
        (self.claude / 'plugins').mkdir()
        (self.claude / 'plugins' / 'installed_plugins.json').write_text(
            json.dumps({'version': 2, 'plugins': {'taste-skill@taste-skill': [{}]}}), encoding='utf-8')
        self.settings.write_text(json.dumps({'enabledPlugins': {'other@x': True}}), encoding='utf-8')
        self.go(['cache-lamp', 'taste-skill'])
        enabled = self.read()['enabledPlugins']
        self.assertNotIn('taste-skill@seymurglv', enabled)
        self.assertEqual(list(enabled), ['cache-lamp@seymurglv', 'taste-skill@taste-skill', 'other@x'])

    def test_alias_dry_run_agrees(self):
        (self.claude / 'plugins').mkdir()
        (self.claude / 'plugins' / 'installed_plugins.json').write_text(
            json.dumps({'version': 2, 'plugins': {'taste-skill@taste-skill': [{}]}}), encoding='utf-8')
        lines = self.go(['taste-skill'], dry_run=True)
        self.assertIn('would: add enabledPlugins.taste-skill@taste-skill', lines)
        self.assertNotIn('seymurglv', ' '.join(l for l in lines if 'enabledPlugins' in l))

    def test_settings_mode_kept_and_backup_same_mode(self):
        self.settings.write_text('{"theme": "dark"}', encoding='utf-8')
        os.chmod(self.settings, 0o600)
        self.go(['cache-lamp'])
        self.assertEqual(self.settings.stat().st_mode & 0o777, 0o600)
        backup = self.claude / ('settings.before-kit-%s.json' % TODAY)
        self.assertEqual(backup.stat().st_mode & 0o777, 0o600)

    def test_symlinked_settings_stays_symlink(self):
        real = self.home / 'dotfiles' / 'settings.json'
        real.parent.mkdir()
        real.write_text('{"theme": "dark"}', encoding='utf-8')
        self.settings.symlink_to(real)
        self.go(['cache-lamp'])
        self.assertTrue(self.settings.is_symlink())
        self.assertTrue(json.loads(real.read_text(encoding='utf-8'))['enabledPlugins']['cache-lamp@seymurglv'])

    def test_settings_step_lists_changes(self):
        self.settings.write_text(json.dumps({'enabledPlugins': {'x@y': True}, 'theme': 'dark'}), encoding='utf-8')
        lines = self.go(['cache-lamp', 'settings'], force=True, dry_run=True)
        self.assertIn('would: add enabledPlugins.cache-lamp@seymurglv', lines)
        self.assertIn('would: change theme', lines)
        self.assertLess(lines.index('would: add enabledPlugins.cache-lamp@seymurglv'),
                        [i for i, l in enumerate(lines) if l.startswith('would: back up')][0])
        lines = self.go(['cache-lamp'])
        self.assertIn('add enabledPlugins.cache-lamp@seymurglv', lines)

    def test_settings_step_reports_reorder_only(self):
        self.settings.write_text(json.dumps({'enabledPlugins': {
            'other@x': True, 'waypoints@seymurglv': True, 'cache-lamp@seymurglv': True},
            'pluginConfigs': self.frags['cache-lamp']['pluginConfigs'] | self.frags['waypoints']['pluginConfigs']}),
            encoding='utf-8')
        lines = self.go(['cache-lamp', 'waypoints'], dry_run=True)
        self.assertIn('would: reorder enabledPlugins', lines)
        self.assertFalse([l for l in lines if l.startswith('would: add') or l.startswith('would: change')])

    def test_linux_skips_trash_check(self):
        with mock.patch.object(sys, 'platform', 'linux'):
            lines = self.go(['rm-guard'])
        self.assertIn('skipped trash.py --check: no Trash route on this system', lines)
        self.assertFalse([c for c in self.run.calls if 'trash.py' in ' '.join(c)])
        self.assertTrue((self.claude / 'hooks' / 'trash.py').exists())
        self.assertTrue([c for c in self.run.calls if '--self-test' in c])

    def test_backup_written_before_change(self):
        old = '{"theme": "dark"}'
        self.settings.write_text(old, encoding='utf-8')
        self.go(['cache-lamp'])
        backup = self.claude / ('settings.before-kit-%s.json' % TODAY)
        self.assertEqual(backup.read_text(encoding='utf-8'), old)
        self.go(['waypoints'])
        self.assertTrue((self.claude / ('settings.before-kit-%s-2.json' % TODAY)).exists())

    def test_cc_status_skipped_without_iterm(self):
        lines = self.go(['settings'])
        self.assertIn('skipped cc-status: iTerm2 not found', lines)
        hooks = self.read().get('hooks', {})
        self.assertNotIn('cc-status', json.dumps(hooks))
        self.assertIn('autoMode', self.read())

    def test_cc_status_merged_with_iterm(self):
        d = self.home / '.config' / 'iterm2'
        d.mkdir(parents=True)
        (d / 'cc-status').write_text('#!/bin/sh\n', encoding='utf-8')
        lines = self.go(['settings'])
        self.assertNotIn('skipped cc-status: iTerm2 not found', lines)
        self.assertEqual(len(self.read()['hooks']), 10)
        self.assertIn(str(d / 'cc-status'), json.dumps(self.read()['hooks']))

    def test_dry_run_changes_nothing(self):
        lines = self.go(dry_run=True)
        self.assertEqual(self.run.calls, [])
        self.assertEqual(list(self.claude.iterdir()), [])
        self.assertTrue(lines and all(l.startswith('would:') for l in lines), lines)

    def test_second_run_already_in_place(self):
        self.go(['cache-lamp', 'waypoints', 'settings'])
        before = sorted(p.name for p in self.claude.iterdir())
        lines = self.go(['cache-lamp', 'waypoints', 'settings'])
        self.assertIn('already in place', lines)
        self.assertEqual(sorted(p.name for p in self.claude.iterdir()), before)

    def test_plugin_order(self):
        self.settings.write_text(json.dumps({'enabledPlugins': {'other@x': True, 'waypoints@seymurglv': True}}),
                                 encoding='utf-8')
        self.go(['cache-lamp', 'waypoints'])
        self.assertEqual(list(self.read()['enabledPlugins']),
                         ['cache-lamp@seymurglv', 'waypoints@seymurglv', 'other@x'])

    def test_cli_changes_to_settings_survive(self):
        old = b'{"theme": "dark"}'
        self.settings.write_bytes(old)
        settings = self.settings

        def runner(cmd):
            self.run.calls.append(cmd)
            if cmd[:3] == ['claude', 'plugin', 'install']:
                data = json.loads(settings.read_text(encoding='utf-8'))
                data['enabledPlugins'] = {'foreign@x': True}
                settings.write_text(json.dumps(data), encoding='utf-8')
            return 0, ''

        self.run = Fake()
        run_install([self.by_id['cache-lamp']], self.frags, ROOT, self.home, runner,
                    which=lambda n: '/usr/bin/claude')
        backups = list(self.claude.glob('settings.before-kit-*.json'))
        self.assertEqual([b.read_bytes() for b in backups], [old])
        final = self.read()
        self.assertTrue(final['enabledPlugins']['foreign@x'])
        self.assertTrue(final['enabledPlugins']['cache-lamp@seymurglv'])
        self.assertEqual(list(final['enabledPlugins'])[0], 'cache-lamp@seymurglv')

    def test_hook_file_backup(self):
        hooks = self.claude / 'hooks'
        hooks.mkdir()
        (hooks / 'block_rm.py').write_bytes(b'old guard')
        self.go(['rm-guard'])
        self.assertEqual((hooks / ('block_rm.before-kit-%s.py' % TODAY)).read_bytes(), b'old guard')
        self.assertEqual((hooks / 'block_rm.py').read_bytes(), (ROOT / 'setup' / 'hooks' / 'block_rm.py').read_bytes())

    def test_failed_command_stops(self):
        self.run = Fake(1, 'boom\nlast line')
        lines = self.go(['cache-lamp'])
        self.assertEqual(lines[-1], 'failed: claude plugin marketplace add seymurglv/seymurglv-kit: last line')
        self.assertEqual(len(self.run.calls), 1)
        self.assertFalse(self.settings.exists())


if __name__ == '__main__':
    unittest.main()
