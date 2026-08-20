import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / "src" / "app.js").read_text(encoding="utf-8")


def function_body(source: str, name: str) -> str:
    marker = f"function {name}("
    start = source.index(marker)
    brace = source.index("{", start)
    depth = 0
    for index in range(brace, len(source)):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return source[brace + 1:index]
    raise AssertionError(f"Unclosed function: {name}")


class UploadShortcutTests(unittest.TestCase):
    def test_tab_one_upload_shortcut_resolves_the_live_upload_panel_before_scrolling(self):
        body = function_body(JS, "scrollToDataUpload")
        self.assertIn("event?.preventDefault()", body)
        self.assertIn("renderDataUploadGuide(mode)", body)
        self.assertIn("document.querySelector('#dataUploadPanel')", body)
        self.assertIn("panel?.querySelector('#gptResponseInput')", body)
        self.assertIn("panel.hidden = false", body)
        self.assertIn("panel.scrollIntoView", body)
        self.assertIn("input.focus({ preventScroll: true })", body)
        self.assertIn("typeof window.requestAnimationFrame === 'function'", body)
        self.assertIn("elements.dataUploadShortcutButton?.addEventListener('click', scrollToDataUpload)", JS)


if __name__ == "__main__":
    unittest.main()
