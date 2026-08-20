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
            patch.object(main, "require_auth_admin", return_value={"id": "review-admin", "name": "Review Admin"}),
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
        self.assertEqual(updated["meta"]["human_review"]["final_comment_author_id"], "review-admin")
        self.assertEqual(updated["meta"]["edit_history"][-1]["field"], "final_comment")
        self.assertEqual(updated["source_report"] if "source_report" in updated else {}, {})

    def test_manual_identity_fields_update_dashboard_values_and_audit_history(self):
        record = triage_record()
        record["structured_table"].update({
            "development_stage": "Preclinical",
            "main_indication": "Alzheimer's disease",
        })
        record["json_summary"].update({"main_indication": "Alzheimer's disease"})

        updated = self.update(record, {
            "kind": "company",
            "value": "Updated Bio",
            "previous_value": "Test Bio",
        })["record"]
        updated = self.update(updated, {
            "kind": "asset",
            "value": "FT-102",
            "previous_value": "FT-101",
        })["record"]
        updated = self.update(updated, {
            "kind": "main_indication",
            "value": "Parkinson's disease",
            "previous_value": "Alzheimer's disease",
        })["record"]

        table = updated["structured_table"]
        summary = updated["json_summary"]
        self.assertEqual(table["company"], "Updated Bio")
        self.assertEqual(summary["company"], "Updated Bio")
        self.assertEqual(table["asset_name"], "FT-102")
        self.assertEqual(summary["asset_name"], "FT-102")
        self.assertEqual(table["main_indication"], "Parkinson's disease")
        self.assertEqual(summary["main_indication"], "Parkinson's disease")
        self.assertEqual(
            [entry["field"] for entry in updated["meta"]["human_review"]["history"][-3:]],
            [
                "structured_table.company",
                "structured_table.asset_name",
                "structured_table.main_indication",
            ],
        )

    def test_final_comment_delete_requires_its_author_and_is_audited(self):
        record = triage_record()
        created = self.update(record, {"kind": "final_comment", "value": "관리자 최종 의견"})["record"]

        other_admin = {"id": "other-admin", "name": "Other Admin"}
        with (
            patch.object(main, "require_auth_admin", return_value=other_admin),
            patch.object(main, "load_records", return_value=[created]),
            patch.object(main, "save_records"),
            patch.object(main, "run_markdown_exports", return_value={}),
        ):
            with self.assertRaises(main.HTTPException) as error:
                asyncio.run(main.update_manual_review(main.record_key(created), FakeRequest({"kind": "final_comment_delete"})))
        self.assertEqual(error.exception.status_code, 403)

        deleted = self.update(created, {"kind": "final_comment_delete"})["record"]

        self.assertNotIn("final_comment", deleted["meta"]["human_review"]["overrides"])
        self.assertNotIn("final_comment_author_id", deleted["meta"]["human_review"])
        self.assertEqual(deleted["meta"]["edit_history"][-1]["field"], "final_comment")
        self.assertEqual(deleted["meta"]["edit_history"][-1]["source"], "detail_final_comment_delete")

    def test_topic_note_delete_is_limited_to_its_author_admin(self):
        note = {"author_id": "review-admin"}

        self.assertTrue(main.can_delete_topic_note({"id": "review-admin", "role": "admin"}, note))
        self.assertFalse(main.can_delete_topic_note({"id": "other-admin", "role": "admin"}, note))
        self.assertFalse(main.can_delete_topic_note({"id": "review-admin", "role": "user"}, note))


if __name__ == "__main__":
    unittest.main()
