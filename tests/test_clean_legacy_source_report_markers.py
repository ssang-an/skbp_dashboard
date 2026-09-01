import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "clean_legacy_source_report_markers", ROOT / "scripts" / "clean_legacy_source_report_markers.py"
)
cleaner = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(cleaner)


class CleanLegacySourceReportMarkersTests(unittest.TestCase):
    def test_removes_only_generated_history_sections(self):
        raw = (
            "# Original report\n\n"
            "> **Recalculated by Full Scout Rubric v3.3:** 2026-08-01 recalculated.\n\n"
            "Original research body.\n\n"
            "> **기준 업데이트 (v3.1):** previous dashboard revision.\n\n"
            "---\n\n## AI Agent Revision Note (GPT instruction 2 v3.1, 2026-06-23)\n\n"
            "Generated appendix.\n"
        )
        cleaned, counts = cleaner.clean_markdown(raw)
        self.assertEqual(cleaned, "# Original report\n\nOriginal research body.\n")
        self.assertEqual(counts["recalculation_banner"], 1)
        self.assertEqual(counts["criteria_update_notice"], 1)
        self.assertEqual(counts["ai_revision_appendix"], 1)

    def test_recurses_into_reupload_snapshots(self):
        payload = {
            "source_report": {"raw_markdown": "# Current"},
            "meta": {
                "report_reupload_history": [{
                    "previous_source_report": {
                        "raw_markdown": "> **Recalculated by Full Scout Rubric v3.3:** old\n\n# Previous"
                    },
                    "previous_record_snapshot": {
                        "source_report": {
                            "raw_markdown": "> **Recalculated by Full Scout Rubric v3.3:** old\n\n# Original"
                        }
                    }
                }]
            },
        }
        counts = cleaner.Counter()
        self.assertTrue(cleaner.clean_object(payload, counts))
        self.assertEqual(
            payload["meta"]["report_reupload_history"][0]["previous_source_report"]["raw_markdown"],
            "# Previous",
        )
        self.assertEqual(
            payload["meta"]["report_reupload_history"][0]["previous_record_snapshot"]["source_report"]["raw_markdown"],
            "# Original",
        )


if __name__ == "__main__":
    unittest.main()
