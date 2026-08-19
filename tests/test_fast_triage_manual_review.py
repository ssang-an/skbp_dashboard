import asyncio
import copy
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import main


class FakeRequest:
    def __init__(self, payload):
        self._payload = payload
        self.client = SimpleNamespace(host="127.0.0.1")
        self.headers = {}

    async def json(self):
        return self._payload


def triage_record():
    return {
        "meta": {"review_type": "fast_triage"},
        "json_summary": {"company": "Test Bio", "asset_name": "FT-101"},
        "structured_table": {"company": "Test Bio", "asset_name": "FT-101"},
        "triage": {"status": "SELECT"},
        "hard_filter": {"status": "SELECT", "reason": "", "flags": []},
        "scoring": {
            "total_score": 6,
            "max_score": 9,
            "criteria": {
                "target_relevance": {"score": 2},
                "moa_validity": {"score": 2},
                "data_maturity": {"score": 2},
            },
        },
    }


class FastTriageManualReviewTests(unittest.TestCase):
    def update(self, record, payload):
        record_id = main.record_key(record)
        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
            patch.object(main, "run_markdown_exports", return_value={}),
        ):
            return asyncio.run(main.update_manual_review(record_id, FakeRequest(payload)))

    def test_triage_criterion_override_preserves_gpt_score_and_tracks_audit(self):
        record = triage_record()
        original = copy.deepcopy(record["scoring"]["criteria"]["target_relevance"])

        result = self.update(record, {
            "kind": "score",
            "criterion": "target_relevance",
            "value": 3,
            "previous_value": 2,
        })

        updated = result["record"]
        self.assertEqual(updated["scoring"]["criteria"]["target_relevance"], original)
        self.assertEqual(updated["meta"]["human_review"]["overrides"]["scores"]["target_relevance"], 3)
        self.assertEqual(main.dashboard_effective_fast_total_score(updated), 7)
        self.assertEqual(updated["meta"]["edit_history"][-1]["field"], "scores.target_relevance")
        self.assertEqual(updated["meta"]["edit_history"][-1]["actor_name"], "Review Admin")

    def test_final_comment_is_admin_audited_without_changing_gpt_report(self):
        record = triage_record()
        result = self.update(record, {"kind": "final_comment", "value": "추가 근거 확인 후 Full Scout 진행"})

        updated = result["record"]
        self.assertEqual(updated["meta"]["human_review"]["overrides"]["final_comment"], "추가 근거 확인 후 Full Scout 진행")
        self.assertEqual(updated["meta"]["edit_history"][-1]["field"], "final_comment")
        self.assertEqual(updated["source_report"] if "source_report" in updated else {}, {})


if __name__ == "__main__":
    unittest.main()
