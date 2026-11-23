import copy
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from install import expand_home, merge_settings, order_plugins  # noqa: E402


def py_hook(script, cmd='/usr/local/bin/python3'):
    return {'matcher': 'Bash', 'hooks': [{'type': 'command', 'command': cmd, 'args': [script]}]}


class MergeTests(unittest.TestCase):
    def test_absent_scalar_is_set(self):
        self.assertEqual(merge_settings({}, {'theme': 'auto'})[0], {'theme': 'auto'})

    def test_equal_scalar_no_message(self):
        self.assertEqual(merge_settings({'theme': 'auto'}, {'theme': 'auto'})[1], [])

    def test_different_scalar_kept(self):
        res, msgs = merge_settings({'theme': 'dark'}, {'theme': 'auto'})
        self.assertEqual(res['theme'], 'dark')
        self.assertEqual(msgs, ['kept yours: theme=dark (kit: auto)'])
        res, _ = merge_settings({'theme': 'dark'}, {'theme': 'auto'}, force=True)
        self.assertEqual(res['theme'], 'auto')

    def test_nested_scalar_path_in_message(self):
        key = 'waypoints@seymurglv'
        cur = {'pluginConfigs': {key: {'options': {'language': 'en'}}}}
        frag = {'pluginConfigs': {key: {'options': {'language': 'ru'}}}}
        _, msgs = merge_settings(cur, frag)
        self.assertEqual(len(msgs), 1)
        self.assertTrue(msgs[0].startswith(
            'kept yours: pluginConfigs.waypoints@seymurglv.options.language='))

    def test_json_style_values(self):
        _, msgs = merge_settings({'a': True, 'b': 80}, {'a': False, 'b': 90})
        self.assertEqual(msgs, ['kept yours: a=true (kit: false)', 'kept yours: b=80 (kit: 90)'])

    def test_allow_union(self):
        res, _ = merge_settings({'permissions': {'allow': ['A', 'B']}},
                                {'permissions': {'allow': ['B', 'C']}})
        self.assertEqual(res['permissions']['allow'], ['A', 'B', 'C'])

    def test_soft_deny_only_when_absent(self):
        frag = {'autoMode': {'soft_deny': ['$defaults']}}
        res, _ = merge_settings({'autoMode': {'soft_deny': ['x']}}, frag)
        self.assertEqual(res['autoMode']['soft_deny'], ['x'])
        res, _ = merge_settings({}, frag)
        self.assertEqual(res['autoMode']['soft_deny'], ['$defaults'])

    def test_hook_not_duplicated_by_script_name(self):
        cur = {'hooks': {'PreToolUse': [py_hook('/Users/x/.claude/hooks/block_rm.py')]}}
        frag = {'hooks': {'PreToolUse': [py_hook('/h/.claude/hooks/block_rm.py', 'python3')]}}
        res, _ = merge_settings(cur, frag)
        self.assertEqual(len(res['hooks']['PreToolUse']), 1)

    def test_hook_added_to_existing_event(self):
        other = {'hooks': [{'type': 'command', 'command': '/bin/other'}]}
        cur = {'hooks': {'Stop': [other]}}
        frag = {'hooks': {'Stop': [{'hooks': [{'type': 'command', 'command': '~/.claude/cc-status'}]}]}}
        res, _ = merge_settings(cur, frag)
        self.assertEqual(len(res['hooks']['Stop']), 2)

    def test_inputs_not_mutated(self):
        cur = {'theme': 'dark', 'permissions': {'allow': ['A']}, 'hooks': {'Stop': []}}
        frag = {'theme': 'auto', 'permissions': {'allow': ['B']},
                'hooks': {'Stop': [{'hooks': [{'type': 'command', 'command': 'cc-status'}]}]}}
        c0, f0 = copy.deepcopy(cur), copy.deepcopy(frag)
        res, _ = merge_settings(cur, frag)
        res['permissions']['allow'].append('Z')
        res['hooks']['Stop'][0]['hooks'].append(1)
        self.assertEqual(cur, c0)
        self.assertEqual(frag, f0)

    def test_idempotent(self):
        cur = {'permissions': {'allow': ['A']}}
        frag = {'theme': 'auto', 'permissions': {'allow': ['B']},
                'autoMode': {'soft_deny': ['$defaults']},
                'hooks': {'Stop': [{'hooks': [{'type': 'command', 'command': 'cc-status'}]}]}}
        once, _ = merge_settings(cur, frag)
        twice, msgs = merge_settings(once, frag)
        self.assertEqual(once, twice)
        self.assertEqual(msgs, [])

    def test_expand_home(self):
        self.assertEqual(expand_home({'a': ['~/.x', 'y']}, '/h'), {'a': ['/h/.x', 'y']})

    def test_order_plugins(self):
        res = order_plugins({'w': True, 'x': True, 'c': True}, ['c', 'w'])
        self.assertEqual(list(res), ['c', 'w', 'x'])


if __name__ == '__main__':
    unittest.main()
