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
    def test_upload_shortcut_targets_the_active_tab_upload_panel_and_scrolls_the_document(self):
        body = function_body(JS, "scrollToDataUpload")
        self.assertIn("event?.preventDefault()", body)
        self.assertIn("const isStep0Visible", body)
        self.assertIn("!isStep0Visible && mode === 'focus'", body)
        self.assertIn("if (!isStep0Visible) renderDataUploadGuide(mode)", body)
        self.assertIn("const panelSelector = isStep0Visible ? '#step0UploadPanel' : '#dataUploadPanel'", body)
        self.assertIn("const inputSelector = isStep0Visible ? '#step0PasteInput' : '#gptResponseInput'", body)
        self.assertIn("document.querySelector(panelSelector)", body)
        self.assertIn("panel?.querySelector(inputSelector)", body)
        self.assertIn("panel.hidden = false", body)
        self.assertIn("panel.scrollIntoView", body)
        self.assertIn("window.scrollTo", body)
        self.assertIn("document.querySelector('.topbar')", body)
        self.assertIn("input.focus({ preventScroll: true })", body)
        self.assertIn("typeof window.requestAnimationFrame === 'function'", body)
        self.assertIn("elements.dataUploadShortcutButton?.addEventListener('click', scrollToDataUpload)", JS)


if __name__ == "__main__":
    unittest.main()
