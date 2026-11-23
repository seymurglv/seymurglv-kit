import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import install


class ManifestTest(unittest.TestCase):
    def test_parts_order_and_defaults(self):
        parts, _ = install.load_kit(ROOT)
        self.assertEqual([p.id for p in parts],
                         ['cache-lamp', 'waypoints', 'taste-skill', 'banui', 'rm-guard', 'settings'])
        self.assertEqual({p.id for p in parts if not p.default}, {'banui'})

    def test_every_part_has_a_fragment(self):
        parts, fragments = install.load_kit(ROOT)
        for p in parts:
            self.assertIn(p.id, fragments)

    def test_fragment_has_nothing_personal(self):
        for name in (Path('settings') / 'claude.json', Path('kit.json')):
            self.check_nothing_personal((ROOT / name).read_text(encoding='utf-8'))

    def check_nothing_personal(self, text):
        for bad in ('/Users/', '"environment"', 'defaultMode', 'cc-plugin-you-should-know',
                    'statusLine', 'sk-', 'AIza', 'ghp_'):
            self.assertNotIn(bad, text)
        self.assertIsNone(re.search(r'[0-9a-fA-F]{32,}', text))
        for m in re.finditer(r'[\w.+-]+@[\w-]+\.[\w.]+', text):
            self.fail('e-mail-like string: ' + m.group(0))

    def test_web_fetch_domains_allowlist(self):
        text = (ROOT / 'settings' / 'claude.json').read_text(encoding='utf-8')
        found = set(re.findall(r'WebFetch\(domain:([^)]*)\)', text))
        self.assertLessEqual(found, {'support.google.com', 'code.claude.com'})

    def test_cache_lamp_before_waypoints(self):
        parts, _ = install.load_kit(ROOT)
        ids = [p.id for p in parts]
        self.assertLess(ids.index('cache-lamp'), ids.index('waypoints'))

    def test_load_kit_rejects_missing_fragment_and_repeats(self):
        import json, tempfile
        with tempfile.TemporaryDirectory() as d:
            r = Path(d)
            (r / 'settings').mkdir()
            part = {"id": "a", "title": "t", "kind": "settings", "default": True}
            (r / 'kit.json').write_text(json.dumps({"parts": [part]}))
            (r / 'settings' / 'claude.json').write_text('{}')
            with self.assertRaises(ValueError):
                install.load_kit(r)
            (r / 'kit.json').write_text(json.dumps({"parts": [part, part]}))
            (r / 'settings' / 'claude.json').write_text('{"a": {}}')
            with self.assertRaises(ValueError):
                install.load_kit(r)


if __name__ == '__main__':
    unittest.main()
