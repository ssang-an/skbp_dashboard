from __future__ import annotations

import asyncio
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import main
from tests.test_ai_agent_score_override import full_scout_record
from tests.test_rubric_v32_v33 import current_triage_record


class RubricAiRefreshTests(unittest.TestCase):
    def test_atomic_json_write_retries_a_transient_windows_permission_error(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "records.json"
            original_replace = Path.replace
            attempts = 0

            def flaky_replace(path, target):
                nonlocal attempts
                attempts += 1
                if attempts == 1:
                    raise PermissionError("temporary Windows file lock")
                return original_replace(path, target)

            with (
                patch.object(main.Path, "replace", new=flaky_replace),
                patch.object(main.time, "sleep") as sleep,
            ):
                main.write_json_atomic(destination, {"ok": True})

            self.assertEqual(attempts, 2)
            sleep.assert_called_once_with(main.JSON_ATOMIC_REPLACE_RETRY_SECONDS)
            self.assertEqual(json.loads(destination.read_text(encoding="utf-8")), {"ok": True})

    def test_dashboard_uses_original_report_ai_reassessment_for_stale_rubrics(self):
        source = (main.ROOT / "src" / "app.js").read_text(encoding="utf-8")
        detail_source = (main.ROOT / "src" / "detail.js").read_text(encoding="utf-8")
        triage_source = (main.ROOT / "src" / "triage-detail.js").read_text(encoding="utf-8")
        self.assertIn("/reassess-rubric", source)
        self.assertIn("/reassess-rubric", detail_source)
        self.assertIn("/reassess-rubric", triage_source)
        self.assertNotIn("/refresh-rubric", source)
        self.assertNotIn("/refresh-rubric", triage_source)

    def test_legacy_refresh_url_uses_original_report_reassessment_compatibility_route(self):
        source = (main.ROOT / "main.py").read_text(encoding="utf-8")
        recalculation_start = source.index('async def recalculate_record_with_latest_rubric')
        recalculation = source[recalculation_start:source.index('@app.post(', recalculation_start)]
        compatibility_start = source.index('def refresh_record_rubric_compatibility')
        compatibility = source[compatibility_start:source.index('@app.post(', compatibility_start)]
        self.assertIn('return await reassess_record_rubric(record_id, request)', recalculation)
        self.assertIn('return await reassess_record_rubric(record_id, request)', compatibility)
        self.assertIn('@app.post("/api/records/{record_id:path}/reassess-rubric")', source)

    def test_deterministic_full_scout_refresh_skips_history_when_already_current(self):
        record = full_scout_record()
        request = main.Request({
            "type": "http", "method": "POST", "path": "/", "headers": [],
            "client": ("127.0.0.1", 12345),
        })

        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            first = main._recalculate_record_with_stored_scores(main.record_key(record), request)

        current = first["record"]
        history_before = copy.deepcopy(current["meta"].get("edit_history", []))
        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[current]),
            patch.object(main, "save_records") as save_records,
        ):
            second = main._recalculate_record_with_stored_scores(main.record_key(current), request)

        self.assertTrue(first["changed"])
        self.assertEqual(second["status"], "already_current")
        self.assertFalse(second["changed"])
        self.assertEqual(current["meta"].get("edit_history", []), history_before)
        save_records.assert_not_called()

    def test_deterministic_full_scout_refresh_applies_latest_version_before_clearing_manual_scores(self):
        record = full_scout_record()
        record["meta"]["human_review"] = {
            "overrides": {"scores": {"marketability": 3}, "total_score": 16},
            "ai_baseline": {"scores": {"marketability": 1}, "total_score": 14},
        }
        request = main.Request({
            "type": "http", "method": "POST", "path": "/", "headers": [],
            "client": ("127.0.0.1", 12345),
        })
        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records") as save_records,
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            result = main._recalculate_record_with_stored_scores(main.record_key(record), request)

        self.assertEqual(result["status"], "recalculated")
        self.assertTrue(result["changed"])
        self.assertTrue(result["official_recalculation_applied"])
        self.assertEqual(result["cleared_manual_scoring_override_fields"], ["scores", "total_score"])
        self.assertNotIn("scores", result["record"]["meta"]["human_review"]["overrides"])
        self.assertNotIn("total_score", result["record"]["meta"]["human_review"]["overrides"])
        self.assertEqual(
            result["record"]["meta"]["edit_history"][-1]["new_value"],
            "Filter 2 recalculated from stored criterion scores",
        )
        save_records.assert_called_once()

    def test_current_full_scout_refresh_only_clears_manual_scores(self):
        record = full_scout_record()
        request = main.Request({
            "type": "http", "method": "POST", "path": "/", "headers": [],
            "client": ("127.0.0.1", 12345),
        })
        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            first = main._recalculate_record_with_stored_scores(main.record_key(record), request)

        current = first["record"]
        current["meta"]["human_review"] = {
            "overrides": {"scores": {"marketability": 3}, "total_score": 16},
            "ai_baseline": {"scores": {"marketability": 1}, "total_score": 14},
        }
        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[current]),
            patch.object(main, "save_records") as save_records,
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            result = main._recalculate_record_with_stored_scores(main.record_key(current), request)

        self.assertEqual(result["status"], "manual_override_reset")
        self.assertFalse(result["official_recalculation_applied"])
        self.assertEqual(result["cleared_manual_scoring_override_fields"], ["scores", "total_score"])
        refresh_audit = next(
            entry for entry in reversed(result["record"]["meta"]["edit_history"])
            if entry.get("source") == "dashboard_rubric_refresh"
        )
        self.assertEqual(
            refresh_audit["new_value"],
            "manual score overrides cleared; stored GPT scores restored",
        )
        save_records.assert_called_once()

    def test_current_fast_triage_refresh_releases_manual_score_overrides(self):
        record = current_triage_record()
        request = main.Request({
            "type": "http", "method": "POST", "path": "/", "headers": [],
            "client": ("127.0.0.1", 12345),
        })
        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            first = main._recalculate_record_with_stored_scores(main.record_key(record), request)

        current = first["record"]
        current["meta"]["human_review"] = {
            "overrides": {"scores": {"moa_validity": 3}},
            "ai_baseline": {"scores": {"moa_validity": 1}},
        }
        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[current]),
            patch.object(main, "save_records") as save_records,
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            result = main._recalculate_record_with_stored_scores(main.record_key(current), request)

        self.assertEqual(result["status"], "manual_override_reset")
        self.assertFalse(result["official_recalculation_applied"])
        self.assertEqual(result["cleared_manual_scoring_override_fields"], ["scores"])
        self.assertNotIn("scores", result["record"]["meta"]["human_review"]["overrides"])
        refresh_audit = next(
            entry for entry in reversed(result["record"]["meta"]["edit_history"])
            if entry.get("source") == "dashboard_rubric_refresh"
        )
        self.assertEqual(
            refresh_audit["new_value"],
            "manual score overrides cleared; stored GPT scores restored",
        )
        save_records.assert_called_once()

    def test_ai_refresh_changes_scores_without_rewriting_source_report(self):
        record = full_scout_record()
        record["meta"]["instruction_version"] = "3.5"
        record["meta"]["generated_at"] = "2026-08-01"
        record["meta"]["rubric_version"] = "3.2"
        original_target_summary = record["scoring"]["criteria"]["target_relevance"].get("main_line_summary")
        original_target_investigation = record["scoring"]["criteria"]["target_relevance"].get("investigation_note")
        original_target_why_not_higher = record["scoring"]["criteria"]["target_relevance"].get("why_not_higher")
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
            patch.object(main, "require_auth_admin", return_value=None),
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
        self.assertEqual(updated["scoring"]["criteria"]["target_relevance"].get("main_line_summary"), original_target_summary)
        self.assertEqual(updated["scoring"]["criteria"]["target_relevance"].get("investigation_note"), original_target_investigation)
        self.assertEqual(updated["scoring"]["criteria"]["target_relevance"].get("why_not_higher"), original_target_why_not_higher)
        self.assertEqual(updated["source_report"]["raw_markdown"], original_report)
        self.assertEqual(updated["meta"]["instruction_version"], "3.5")
        self.assertEqual(updated["meta"]["generated_at"], "2026-08-01")
        self.assertEqual(updated["meta"]["rubric_version"], "3.2")
        self.assertEqual(updated["meta"]["rescored_rubric_version"], main.SCORING_CRITERIA_VERSION)
        self.assertEqual(updated["meta"]["edit_history"][-1]["field"], "rubric_refresh")
        self.assertEqual(
            updated["meta"]["edit_history"][-1]["audit_label"],
            f"Scores updated by AI review with Full Scout Rubric v{main.SCORING_CRITERIA_VERSION}",
        )
        self.assertNotIn("last_edited_at", updated["meta"])
        self.assertEqual(saved[0][0]["source_report"]["raw_markdown"], original_report)

    def test_refresh_prompt_rechecks_existing_evidence_under_latest_rubric(self):
        system_prompt, user_prompt = main.build_rubric_refresh_prompt(full_scout_record(), "partner data")
        self.assertIn("latest SKBP scoring rubric", system_prompt)
        self.assertIn("even when the evidence itself is not new", system_prompt)
        self.assertIn("Re-evaluate all seven Full Scout criterion scores", user_prompt)
        self.assertEqual(main.RUBRIC_REFRESH_REPORT_LIMIT, 24000)
        self.assertEqual(main.RUBRIC_REFRESH_ATTACHMENTS_LIMIT, 16000)

    def test_full_scout_v37_review_without_the_competitive_definition_revision_is_stale(self):
        record = full_scout_record()
        record["meta"]["rubric_reviewed_version"] = main.SCORING_CRITERIA_VERSION
        self.assertFalse(main.record_has_current_rubric_evaluation(record, main.SCORING_CRITERIA_VERSION))

        record["meta"]["full_scout_rubric_definition_revision"] = main.FULL_SCOUT_RUBRIC_DEFINITION_REVISION
        self.assertTrue(main.record_has_current_rubric_evaluation(record, main.SCORING_CRITERIA_VERSION))

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
            patch.object(main, "require_auth_admin", return_value=None),
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
        self.assertIn("원문 생성", detail_source)
        self.assertIn("원문 기반 마지막 재평가", detail_source)

    def test_current_rubric_refresh_restores_official_gpt_scores_without_ai_call(self):
        record = full_scout_record()
        edited = main.build_ai_revision_update(
            record,
            "Marketability: 3 / 3",
            actor_name="Reviewer Kim",
            actor_ip="127.0.0.1",
        )["record"]
        edited["meta"]["full_scout_rubric_definition_revision"] = main.FULL_SCOUT_RUBRIC_DEFINITION_REVISION
        edited["meta"]["rescored_rubric_version"] = main.SCORING_CRITERIA_VERSION
        saved: list[list[dict[str, object]]] = []
        request = main.Request({
            "type": "http", "method": "POST", "path": "/", "headers": [],
            "client": ("127.0.0.1", 12345),
        })

        with (
            patch.object(main, "require_auth_admin", return_value=None),
            patch.object(main, "load_records", return_value=[copy.deepcopy(edited)]),
            patch.object(main, "save_records", side_effect=lambda records: saved.append(copy.deepcopy(records))),
            patch.object(main, "call_openrouter_rubric_refresh") as refresh_ai,
            patch.object(main, "validate_records_for_save", return_value=None),
        ):
            result = asyncio.run(main.refresh_record_rubric(main.record_key(edited), request))

        restored = result["record"]
        self.assertEqual(result["status"], "manual_override_reset")
        refresh_ai.assert_not_called()
        self.assertEqual(restored["scoring"]["criteria"]["marketability"]["score"], 1)
        self.assertEqual(restored["scoring"]["total_score"], 14)
        self.assertNotIn("scores", restored["meta"]["human_review"]["overrides"])
        self.assertNotIn("total_score", restored["meta"]["human_review"]["overrides"])
        self.assertEqual(restored["meta"]["human_review"]["history"][-1]["source"], "dashboard_rubric_refresh")
        self.assertEqual(
            restored["meta"]["human_review"]["history"][-1]["change_method"],
            f"rubric_refresh_existing_v{main.SCORING_CRITERIA_VERSION}",
        )
        self.assertEqual(saved[0][0]["scoring"]["total_score"], 14)

    def test_current_rubric_reassessment_skips_openrouter_and_history_without_manual_scores(self):
        record = full_scout_record()
        record["meta"]["rubric_version"] = main.SCORING_CRITERIA_VERSION
        record["meta"]["rubric_reviewed_version"] = main.SCORING_CRITERIA_VERSION
        record["meta"]["rescored_rubric_version"] = main.SCORING_CRITERIA_VERSION
        record["meta"]["full_scout_rubric_definition_revision"] = main.FULL_SCOUT_RUBRIC_DEFINITION_REVISION
        request = main.Request({
            "type": "http", "method": "POST", "path": "/", "headers": [],
            "client": ("127.0.0.1", 12345),
        })

        with (
            patch.object(main, "require_auth_admin", return_value=None),
            patch.object(main, "load_records", return_value=[copy.deepcopy(record)]),
            patch.object(main, "save_records") as save_records,
            patch.object(main, "call_openrouter_rubric_refresh") as refresh_ai,
        ):
            result = asyncio.run(main.reassess_record_rubric(main.record_key(record), request))

        self.assertEqual(result["status"], "already_current")
        self.assertFalse(result["changed"])
        refresh_ai.assert_not_called()
        save_records.assert_not_called()

    def test_stored_score_recalculation_does_not_count_as_original_report_ai_reassessment(self):
        record = full_scout_record()
        record["meta"]["rubric_version"] = main.SCORING_CRITERIA_VERSION
        record["meta"]["rubric_recalculation"] = {
            "version": main.SCORING_CRITERIA_VERSION,
            "recalculated_at": "2026-09-02T00:00:00+00:00",
        }
        record["meta"]["full_scout_rubric_definition_revision"] = main.FULL_SCOUT_RUBRIC_DEFINITION_REVISION

        self.assertFalse(
            main.record_has_current_ai_rubric_reassessment(record, main.SCORING_CRITERIA_VERSION)
        )

    def test_rubric_reset_history_marks_latest_version_after_a_version_upgrade(self):
        record = full_scout_record()
        record["meta"]["rubric_version"] = "3.1"
        record["meta"]["human_review"] = {
            "overrides": {"scores": {"target_relevance": 1}},
            "ai_baseline": {"scores": {"target_relevance": 3}},
        }

        main.reset_manual_scoring_overrides_after_rubric_review(
            record,
            cleared_at="2026-08-20T01:00:00+00:00",
            actor_ip="127.0.0.1",
            rubric_version="3.4",
            previous_rubric_version="3.1",
        )

        self.assertEqual(
            record["meta"]["edit_history"][-1]["change_method"],
            "rubric_refresh_latest_v3.4",
        )

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
                "instruction_version": "3.5",
                "rubric_version": "3.2",
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
                "instruction_version": "3.5",
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
                        "investigation_note": "Stored evidence note",
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
        original_display_fields = {
            criterion_id: {
                field: record["scoring"]["criteria"][criterion_id].get(field)
                for field in ("main_line_summary", "why_not_higher", "investigation_note", "uncertain_points")
            }
            for criterion_id in ("target_relevance", "moa_validity", "data_maturity")
        }
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
            patch.object(main, "require_auth_admin", return_value=None),
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
        self.assertEqual(updated["triage"]["status"], "REJECT")
        self.assertEqual(updated["hard_filter"]["status"], "REJECT")
        self.assertEqual(updated["source_report"]["raw_markdown"], original_report)
        self.assertEqual(updated["meta"]["instruction_version"], "3.5")
        self.assertEqual(updated["meta"]["generated_at"], "2026-08-05")
        self.assertEqual(updated["triage"]["instruction_version"], "3.5")
        self.assertEqual(updated["meta"]["rescored_rubric_version"], main.TRIAGE_CRITERIA_VERSION)
        for criterion_id, expected in original_display_fields.items():
            for field, value in expected.items():
                self.assertEqual(updated["scoring"]["criteria"][criterion_id].get(field), value)
        self.assertEqual(result["rubric_version"], main.TRIAGE_CRITERIA_VERSION)

    def test_current_records_have_no_corrupted_criterion_display_text(self):
        records = json.loads((main.ROOT / "json" / "pipeline-records.json").read_text(encoding="utf-8"))
        for record in records:
            asset_name = (record.get("structured_table") or {}).get("asset_name", "Unknown")
            for criterion_id, criterion in ((record.get("scoring") or {}).get("criteria") or {}).items():
                if not isinstance(criterion, dict):
                    continue
                for field in ("main_line_summary", "why_not_higher", "investigation_note"):
                    value = str(criterion.get(field) or "")
                    self.assertNotIn("??", value, f"{asset_name} {criterion_id}.{field}")
                    self.assertNotIn("\ufffd", value, f"{asset_name} {criterion_id}.{field}")

    def test_manual_fast_triage_criterion_score_synchronizes_total_and_filter1(self):
        record = current_triage_record()
        request = main.Request({
            "type": "http", "method": "PATCH", "path": "/", "headers": [],
            "client": ("127.0.0.1", 12345),
        })

        async def payload():
            return {"kind": "score", "criterion": "moa_validity", "value": 3, "previous_value": 1}

        request.json = payload
        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin", "id": "admin"}),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            result = asyncio.run(main.update_manual_review(main.record_key(record), request))

        overrides = result["record"]["meta"]["human_review"]["overrides"]
        self.assertEqual(overrides["scores"]["moa_validity"], 3)
        self.assertEqual(overrides["total_score"], 7)
        self.assertEqual(overrides["filter_status"], "REJECT")
        self.assertEqual(
            {update["field"] for update in result["derived_score_updates"]},
            {"total_score"},
        )

    def test_manual_full_scout_criterion_score_synchronizes_total_and_filter2(self):
        record = full_scout_record()
        request = main.Request({
            "type": "http", "method": "PATCH", "path": "/", "headers": [],
            "client": ("127.0.0.1", 12345),
        })

        async def payload():
            return {"kind": "score", "criterion": "marketability", "value": 3, "previous_value": 1}

        request.json = payload
        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin", "id": "admin"}),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            result = asyncio.run(main.update_manual_review(main.record_key(record), request))

        overrides = result["record"]["meta"]["human_review"]["overrides"]
        self.assertEqual(overrides["scores"]["marketability"], 3)
        self.assertEqual(overrides["total_score"], 16)
        self.assertEqual(overrides["filter_status"], "REVIEW")
        self.assertIn("total_score", {update["field"] for update in result["derived_score_updates"]})


if __name__ == "__main__":
    unittest.main()
