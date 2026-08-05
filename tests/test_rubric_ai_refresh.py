from __future__ import annotations

import asyncio
import copy
import unittest
from unittest.mock import patch

import main
from tests.test_ai_agent_score_override import full_scout_record
from tests.test_rubric_v32_v33 import current_triage_record


class RubricAiRefreshTests(unittest.TestCase):
    def test_home_full_scout_uses_same_ai_refresh_endpoint_as_detail(self):
        source = (main.ROOT / "src" / "app.js").read_text(encoding="utf-8")
        self.assertIn("`/api/records/${encodeURIComponent(recordId)}/refresh-rubric`", source)
        self.assertNotIn("const endpoint = isTriage ? 'recalculate-rubric' : 'refresh-rubric';", source)

    def test_ai_refresh_changes_scores_without_rewriting_source_report(self):
        record = full_scout_record()
        record["meta"]["rubric_version"] = "3.2"
        record["meta"]["attachments"] = [{
            "filename": "partner-evidence.pdf",
            "document_processing": {"extraction": {"parsed_text": "Partner efficacy evidence"}},
        }]
        original_report = record["source_report"]["raw_markdown"]
        saved: list[list[dict[str, object]]] = []
        answer = "\n".join([
            "RUBRIC_UPDATE_NEEDED: yes",
            "CONFLICT: no",
            "REASON: 최신 기준에서 명확한 근거가 확인됨",
            "Target Relevance: 2 - 최신 기준에서 직접성이 한 단계 낮음",
        ])

        def fake_openrouter(candidate, attachments_text, api_key):
            self.assertIn("Partner efficacy evidence", attachments_text)
            return answer, None

        request = main.Request({
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        })
        with (
            patch.object(main, "load_records", return_value=[copy.deepcopy(record)]),
            patch.object(main, "save_records", side_effect=lambda records: saved.append(copy.deepcopy(records))),
            patch.object(main, "run_markdown_exports", return_value=[]),
            patch.object(main, "call_openrouter_rubric_refresh", side_effect=fake_openrouter),
            patch.object(main, "validate_records_for_save", return_value=None),
            patch.dict(main.os.environ, {"OPENROUTER_API_KEY": "test-key"}),
        ):
            result = asyncio.run(main.refresh_record_rubric(main.record_key(record), request))

        updated = result["record"]
        self.assertEqual(result["status"], "updated")
        self.assertEqual(updated["scoring"]["criteria"]["target_relevance"]["score"], 2)
        self.assertEqual(updated["source_report"]["raw_markdown"], original_report)
        self.assertEqual(updated["meta"]["rubric_version"], "3.2")
        self.assertEqual(updated["meta"]["rescored_rubric_version"], main.SCORING_CRITERIA_VERSION)
        self.assertEqual(updated["meta"]["edit_history"][-1]["field"], "scoring")
        self.assertNotIn("last_edited_at", updated["meta"])
        self.assertEqual(saved[0][0]["source_report"]["raw_markdown"], original_report)

    def test_refresh_prompt_rechecks_existing_evidence_under_latest_rubric(self):
        system_prompt, user_prompt = main.build_rubric_refresh_prompt(full_scout_record(), "partner data")
        self.assertIn("latest SKBP scoring rubric", system_prompt)
        self.assertIn("even when the evidence itself is not new", system_prompt)
        self.assertIn("Re-evaluate all seven Full Scout criterion scores", user_prompt)
        self.assertEqual(main.RUBRIC_REFRESH_REPORT_LIMIT, 24000)
        self.assertEqual(main.RUBRIC_REFRESH_ATTACHMENTS_LIMIT, 16000)

    def test_fast_triage_no_change_review_is_persisted_for_quick_scan(self):
        record = current_triage_record()
        record["meta"]["rubric_version"] = "3.1"
        saved: list[list[dict[str, object]]] = []
        answer = "\n".join([
            "RUBRIC_UPDATE_NEEDED: no",
            "CONFLICT: no",
            "REASON: v3.2 기준으로 재검토했으나 점수 변경 근거가 없음",
        ])
        request = main.Request({
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        })
        with (
            patch.object(main, "load_records", return_value=[copy.deepcopy(record)]),
            patch.object(main, "save_records", side_effect=lambda records: saved.append(copy.deepcopy(records))),
            patch.object(main, "call_openrouter_rubric_refresh", return_value=(answer, None)),
            patch.object(main, "validate_records_for_save", return_value=None),
            patch.dict(main.os.environ, {"OPENROUTER_API_KEY": "test-key"}),
        ):
            result = asyncio.run(main.refresh_record_rubric(main.record_key(record), request))

        reviewed = result["record"]
        self.assertEqual(result["status"], "no_evidence")
        self.assertEqual(reviewed["meta"]["rubric_version"], "3.1")
        self.assertEqual(reviewed["meta"]["rubric_reviewed_version"], main.TRIAGE_CRITERIA_VERSION)
        self.assertEqual(reviewed["meta"]["rubric_review_result"], "no_change")
        self.assertTrue(reviewed["meta"]["rubric_reviewed_at"])
        self.assertEqual(saved[0][0]["meta"]["rubric_reviewed_version"], main.TRIAGE_CRITERIA_VERSION)

        detail_source = (main.ROOT / "src" / "triage-detail.js").read_text(encoding="utf-8")
        self.assertIn("Rubric used to recalculate", detail_source)
        self.assertIn("Rubric used for review", detail_source)

    def test_fast_triage_excerpt_centers_the_current_asset_in_a_batch_report(self):
        record = {
            "meta": {"review_type": "fast_triage"},
            "structured_table": {"company": "Late Bio", "asset_name": "LATE-999"},
            "triage": {},
        }
        report = "A" * 30000 + "\n## Late Bio · LATE-999\nasset-specific evidence\n" + "B" * 30000
        excerpt = main.rubric_refresh_report_excerpt(record, report)
        self.assertLessEqual(len(excerpt), main.RUBRIC_REFRESH_REPORT_LIMIT + 6)
        self.assertIn("LATE-999", excerpt)
        self.assertIn("asset-specific evidence", excerpt)

    def test_fast_triage_refresh_rechecks_three_scores_and_status_without_rewriting_batch_report(self):
        record = {
            "meta": {
                "review_type": "fast_triage",
                "schema_version": main.TRIAGE_SCHEMA_VERSION,
                "instruction_version": main.TRIAGE_CRITERIA_VERSION,
                "rubric_version": main.TRIAGE_CRITERIA_VERSION,
                "generated_at": "2026-08-05",
                "output_filename_base": "Triage_AI_Refresh_Test",
                "edit_history": [],
            },
            "structured_table": {
                "company": "Batch Bio",
                "asset_name": "BT-1",
                "development_stage": "Preclinical Candidate",
            },
            "json_summary": {"company": "Batch Bio", "asset_name": "BT-1"},
            "triage": {
                "instruction_version": main.TRIAGE_CRITERIA_VERSION,
                "identity_verified": True,
                "active_asset": True,
                "status": "REJECT",
            },
            "scoring": {
                "total_score": 3,
                "max_score": 9,
                "criteria": {
                    criterion_id: {
                        "score": 1,
                        "evidence_type": "E2_indirect_or_class_level_evidence",
                        "main_line_summary": "Stored batch result",
                        "why_not_higher": "Needs review",
                        "uncertain_points": [],
                    }
                    for criterion_id in ("target_relevance", "moa_validity", "data_maturity")
                },
            },
            "hard_filter": {"status": "REJECT", "reason": "Stored result", "flags": []},
            "source_report": {"raw_markdown": "# Batch Fast Triage\n\nBT-1 stored evidence"},
            "final_insight": {"recommendation": "Do not run Full Scout"},
        }
        original_report = record["source_report"]["raw_markdown"]
        answer = "\n".join([
            "RUBRIC_UPDATE_NEEDED: yes",
            "CONFLICT: no",
            "REASON: 최신 Fast Triage 기준에서 직접 근거가 확인됨",
            "Target Relevance: 2 - target과 theme 연결이 직접 확인됨",
            "MoA Validity: 2 - asset MoA 근거가 확인됨",
        ])

        def fake_openrouter(candidate, attachments_text, api_key):
            system_prompt, user_prompt = main.build_rubric_refresh_prompt(candidate, attachments_text)
            self.assertIn("three Fast Triage", user_prompt)
            self.assertIn(f"v{main.TRIAGE_CRITERIA_VERSION}", user_prompt)
            return answer, None

        request = main.Request({
            "type": "http", "method": "POST", "path": "/", "headers": [],
            "client": ("127.0.0.1", 12345),
        })
        with (
            patch.object(main, "load_records", return_value=[copy.deepcopy(record)]),
            patch.object(main, "save_records", return_value=None),
            patch.object(main, "run_markdown_exports", return_value=[]),
            patch.object(main, "call_openrouter_rubric_refresh", side_effect=fake_openrouter),
            patch.object(main, "validate_records_for_save", return_value=None),
            patch.dict(main.os.environ, {"OPENROUTER_API_KEY": "test-key"}),
        ):
            result = asyncio.run(main.refresh_record_rubric(main.record_key(record), request))

        updated = result["record"]
        self.assertEqual(updated["scoring"]["total_score"], 5)
        self.assertEqual(updated["scoring"]["max_score"], 9)
        self.assertEqual(updated["triage"]["status"], "SELECT")
        self.assertEqual(updated["hard_filter"]["status"], "SELECT")
        self.assertEqual(updated["source_report"]["raw_markdown"], original_report)
        self.assertEqual(result["rubric_version"], main.TRIAGE_CRITERIA_VERSION)


if __name__ == "__main__":
    unittest.main()
