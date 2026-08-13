from __future__ import annotations

import unittest

import main


class InputFocusUxTests(unittest.TestCase):
    def test_general_app_controls_use_neutral_focus_after_legacy_accent_rules(self):
        source = (main.ROOT / "src" / "styles.css").read_text(encoding="utf-8")
        neutral_rule = '/* Input controls use quiet neutral depth.'
        self.assertGreater(source.rfind(neutral_rule), source.rfind('0 0 0 4px var(--focus-ring);'))
        self.assertIn('border-color: color-mix(in srgb, var(--line) 76%, #707782);', source)
        self.assertIn('box-shadow: 0 4px 12px rgba(15, 23, 42, 0.11)', source)
        self.assertIn('body .app-shell select:focus-visible,', source)
        self.assertNotIn('0 0 0 4px var(--focus-ring);', source[source.rfind(neutral_rule):])

    def test_data_upload_keeps_its_subtle_semantic_green_focus(self):
        source = (main.ROOT / "src" / "styles.css").read_text(encoding="utf-8")
        self.assertIn('.paste-panel #gptResponseInput:focus-visible,', source)
        self.assertIn('.paste-panel #step0PasteInput:focus-visible {', source)
        self.assertIn('var(--data-upload-accent) 68%', source)

    def test_candidate_upload_reuses_the_data_upload_control_surface(self):
        source = (main.ROOT / "src" / "styles.css").read_text(encoding="utf-8")
        polish_start = source.index('/* Data Upload visual polish')
        input_start = source.index('.paste-panel #gptResponseInput,', polish_start)
        shared_surface = source[input_start:source.index('.data-upload-guide {', input_start)]
        self.assertIn('.paste-panel #step0PasteInput,', shared_surface)
        self.assertIn('border-radius: 12px;', shared_surface)
        self.assertIn('min-height: 356px;', shared_surface)


if __name__ == "__main__":
    unittest.main()
