import json
import shutil
import subprocess
import unittest
from pathlib import Path

import main


ROOT = Path(__file__).resolve().parents[1]


class ReportReadabilityTests(unittest.TestCase):
    def test_server_normalizer_removes_internal_citations_and_preserves_real_links(self):
        source = (
            "# Report\n\n"
            "Supported claim:contentReference[oaicite:0]{index=0}<br>"
            "[1]: https://example.com/source \"Verified source\"\n"
        )
        normalized = main.normalize_source_report_markdown(source)

        self.assertNotIn("contentReference", normalized)
        self.assertNotIn("oaicite", normalized)
        self.assertNotIn("<br>", normalized)
        self.assertIn("Supported claim\n[1]: https://example.com/source", normalized)

    def test_record_normalizer_only_changes_source_report_presentation_artifacts(self):
        record = {
            "source_report": {"raw_markdown": "# Report\nA[oaicite:2]\nB"},
            "structured_table": {"asset_name": "Keep me"},
        }
        main.normalize_record_source_report_markdown(record)

        self.assertEqual(record["source_report"]["raw_markdown"], "# Report\nA\nB")
        self.assertEqual(record["structured_table"]["asset_name"], "Keep me")

    @unittest.skipUnless(shutil.which("node"), "Node.js is required for browser normalizer coverage")
    def test_dashboard_paste_normalizer_reports_and_removes_artifacts(self):
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        start = app_js.index("function normalizeGptOriginalReport")
        end = app_js.index("function addInputIssue", start)
        snippet = app_js[start:end]
        script = f"""
          {snippet}
          process.stdout.write(JSON.stringify(normalizeGptOriginalReport({json.dumps('A:contentReference[oaicite:0]{index=0}<br>B [1]: https://example.com')})));
        """
        result = subprocess.run(
            [shutil.which("node"), "--input-type=module"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            input=script,
            text=True,
            encoding="utf-8",
        )
        normalized = json.loads(result.stdout)

        self.assertEqual(normalized["text"], "A\nB [1]: https://example.com")
        self.assertEqual(normalized["citationCount"], 1)
        self.assertEqual(normalized["htmlBreakCount"], 1)

    def test_prompt_requires_readable_urls_instead_of_internal_citation_tokens(self):
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        self.assertIn("never output ChatGPT/OpenAI internal citation tokens", app_js)
        self.assertIn("internal citation tokens are not usable sources", app_js)


if __name__ == "__main__":
    unittest.main()
