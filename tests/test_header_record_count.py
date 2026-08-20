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


class HeaderRecordCountTests(unittest.TestCase):
    def test_header_always_uses_the_current_tab_record_count(self):
        count = function_body(JS, "currentTabRecordCount")
        self.assertIn("state.step0Rows.length", count)
        self.assertIn("state.rows.filter(rowMatchesActiveTableMode).length", count)
        self.assertIn("`총 ${currentTabRecordCount()}건 로드됨`", function_body(JS, "updateHeaderRecordCount"))
        self.assertIn("updateHeaderRecordCount();", function_body(JS, "renderWorkflowMode"))
        self.assertIn("updateHeaderRecordCount();", function_body(JS, "renderTable"))
        self.assertNotIn("'Human review saved'", JS)


if __name__ == "__main__":
    unittest.main()
