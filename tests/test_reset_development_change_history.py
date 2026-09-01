import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "reset_development_change_history", ROOT / "scripts" / "reset_development_change_history.py"
)
reset_history = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(reset_history)


class ResetDevelopmentChangeHistoryTests(unittest.TestCase):
    def record(self, *, actor="정주원", memo="", other_history=False):
        return {
            "meta": {
                "edit_history": [{"actor_name": "다른 사용자" if other_history else actor}],
                "rubric_refresh_history": [{"actor_name": actor}],
                "human_review": {"history": [{"actor_name": actor}], "last_updated_at": "2026-01-01"},
                "pipeline_metadata": {"comment": memo},
            }
        }

    def test_memos_do_not_protect_development_history_but_other_authors_do(self):
        self.assertEqual(reset_history.history_reset_decision(self.record()), "clear_all_audit")
        self.assertEqual(reset_history.history_reset_decision(self.record(actor="Codex")), "clear_all_audit")
        self.assertEqual(reset_history.history_reset_decision(self.record(memo="keep this")), "clear_all_audit")
        self.assertEqual(reset_history.history_reset_decision(self.record(other_history=True)), "prune_keep_other_author")

    def test_clear_removes_audit_lists_but_keeps_pipeline_content(self):
        record = self.record()
        record["meta"]["topic_notes"] = []
        removed = reset_history.clear_development_history(record)
        self.assertEqual(removed["edit_history"], 1)
        self.assertEqual(removed["rubric_refresh_history"], 1)
        self.assertEqual(removed["human_review.history"], 1)
        self.assertNotIn("edit_history", record["meta"])
        self.assertNotIn("history", record["meta"]["human_review"])
        self.assertEqual(record["meta"]["pipeline_metadata"]["comment"], "")

    def test_prune_keeps_only_named_non_development_entries(self):
        record = self.record(other_history=True, memo="keep this")
        record["meta"]["edit_history"].append({"actor_name": ""})
        removed = reset_history.clear_development_history(record)
        self.assertEqual(removed["edit_history"], 1)
        self.assertEqual(record["meta"]["edit_history"], [{"actor_name": "다른 사용자"}])
        self.assertNotIn("rubric_refresh_history", record["meta"])
        self.assertNotIn("history", record["meta"]["human_review"])
        self.assertEqual(record["meta"]["pipeline_metadata"]["comment"], "keep this")

    def test_prune_retains_only_the_latest_score_recalculation_audit(self):
        record = self.record()
        record["meta"]["rubric_refresh_history"] = [
            {"reviewed_at": "2026-08-01T00:00:00+00:00", "version": "3.3"},
            {"reviewed_at": "2026-08-19T00:00:00+00:00", "version": "3.4"},
        ]
        removed = reset_history.clear_development_history(record)
        self.assertEqual(removed["rubric_refresh_history"], 1)
        self.assertEqual(record["meta"]["rubric_refresh_history"], [
            {"reviewed_at": "2026-08-19T00:00:00+00:00", "version": "3.4"},
        ])


if __name__ == "__main__":
    unittest.main()
