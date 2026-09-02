from __future__ import annotations

import copy
import unittest
from unittest.mock import patch

import main


def record(*, modality: str, stage: str, platform_score: int = 1, admet_uploaded: bool = False) -> dict:
    return {
        "structured_table": {
            "main_indication": "Alzheimer's Disease",
            "modality_platform": modality,
            "development_stage": stage,
        },
        "scoring": {"criteria": {"platform_attractiveness": {"score": platform_score}}},
        "source_report": {"raw_markdown": ""},
        "meta": {
            "attachments": [{"filename": "candidate_ADMET.pdf"}] if admet_uploaded else [],
        },
    }


class OiPartnershipCriteriaTests(unittest.TestCase):
    def test_filter3_criteria_document_declares_the_same_canonical_six(self):
        criteria = (main.ROOT / "config" / "oi_partnership_criteria.md").read_text(encoding="utf-8")
        for indication in main.SKBP_INTEREST_INDICATIONS:
            self.assertIn(f"- {indication}", criteria)

    def test_shortlisting_reuses_full_scout_priority_indication_canonicalization(self):
        cases = (
            ("AD", "Alzheimer's disease"),
            ("Alzheimer’s disease", "Alzheimer's disease"),
            ("PDD", "Parkinson's disease"),
            ("Parkinson’s disease", "Parkinson's disease"),
            ("MND", "Amyotrophic lateral sclerosis / motor neuron disease"),
            ("RRMS", "Multiple sclerosis / neuroinflammatory disease"),
            ("PHN", "Neuropathic pain"),
            ("DEE", "Epilepsy / seizure disorders"),
        )
        for wording, canonical in cases:
            with self.subTest(wording=wording):
                self.assertEqual(main.match_skbp_interest_indication(wording), canonical)
                self.assertEqual(main.oi_match_target_indication(wording), canonical)

    def test_blank_main_indication_uses_detailed_focal_onset_seizure_as_target(self):
        candidate = record(modality="Small molecule", stage="Phase 2")
        candidate["structured_table"].update({
            "main_indication": "",
            "indication": "Focal onset seizure; major depressive disorder; pain",
        })
        state, indication, source = main.oi_indication_state(candidate, main.oi_text_sources(candidate))
        self.assertEqual(state, "target")
        self.assertEqual(indication, "Epilepsy / seizure disorders")
        self.assertEqual(source, "Tab2 구조화 데이터")

    def test_investment_includes_all_modalities_at_ind_enabling_and_later_stages(self):
        for modality in ("Small molecule", "Antibody", "Unknown"):
            for stage in ("IND-enabling", "IND filed/cleared", "Phase 1", "Phase 2", "Approved / marketed"):
                with self.subTest(modality=modality, stage=stage):
                    result = main.classify_oi_partnership(record(modality=modality, stage=stage), {})
                self.assertEqual(result["partnership_type"], "investment")
                self.assertIn("IND-enabling 이상", result["note"])
                self.assertIn("All Modality", result["note"])
                self.assertEqual(result["criteria_version"], "1.7")

    def test_value_up_requires_pre_ind_enabling_stage(self):
        evidence = {"in_vivo_status": "O", "in_vitro_status": "O", "admet_completed": 0}
        eligible = main.classify_oi_partnership(
            record(modality="Small molecule", stage="Preclinical Candidate", admet_uploaded=True), evidence
        )
        self.assertEqual(eligible["partnership_type"], "value_up")

        for stage in ("IND-enabling", "IND filed/cleared", "Phase 1"):
            with self.subTest(stage=stage):
                result = main.classify_oi_partnership(
                    record(modality="Small molecule", stage=stage, admet_uploaded=True), evidence
                )
                self.assertEqual(result["partnership_type"], "investment")
                self.assertIn("All Modality", result["note"])

    def test_value_up_requires_confirmed_stage(self):
        result = main.classify_oi_partnership(
            record(modality="Small molecule", stage="Unknown", admet_uploaded=True),
            {"in_vivo_status": "O", "in_vitro_status": "O", "admet_completed": 0},
        )
        self.assertEqual(result["partnership_type"], "unknown")
        self.assertIn("Development Stage", result["note"])

    def test_version_bump_refreshes_prior_value_up_classification(self):
        tracked = record(modality="Small molecule", stage="IND-enabling")
        tracked["meta"]["focus_management"] = {
            "is_tracked": True,
            "in_vivo_status": "O",
            "in_vivo_status_source": "manual",
            "in_vitro_status": "O",
            "in_vitro_status_source": "manual",
            "admet_completed": 0,
            "admet_completed_source": "manual",
            "partnership_type": "value_up",
            "partnership_classification_source": "auto",
            "partnership_classification_status": "auto_classified",
            "partnership_classification_criteria_version": "1.3",
        }
        tracked["meta"]["attachments"] = [{"filename": "candidate_ADMET.pdf"}]

        self.assertTrue(main.refresh_tracked_oi_classifications([tracked]))
        focus = tracked["meta"]["focus_management"]
        self.assertEqual(focus["partnership_classification_criteria_version"], "1.7")
        self.assertEqual(focus["partnership_type"], "investment")
        self.assertEqual(len(focus["partnership_classification_history"]), 1)
        self.assertEqual(focus["partnership_classification_history"][0]["automatic_result"], "investment")
        self.assertTrue(focus["partnership_classification_history"][0]["applied_to_final"])

    def test_background_version_refresh_regenerates_auto_note_without_overwriting_manual_type(self):
        tracked = record(modality="Antibody", stage="Phase 1")
        previous_auto_note = "Previous automatic rationale"
        tracked["meta"]["focus_management"] = {
            "is_tracked": True,
            "partnership_type": "joint_research",
            "partnership_note": f"Manual type / automatic rationale: {previous_auto_note}",
            "partnership_note_source": "auto",
            "partnership_auto_note": previous_auto_note,
            "partnership_classification_source": "manual",
            "partnership_classification_status": "manual_override",
            "partnership_classification_criteria_version": "1.6",
            "partnership_classification_history": [{"criteria_version": "1.6"}],
        }

        self.assertTrue(main.refresh_tracked_oi_classifications([tracked]))
        focus = tracked["meta"]["focus_management"]
        self.assertEqual(focus["partnership_type"], "joint_research")
        self.assertEqual(focus["partnership_note_source"], "auto")
        self.assertEqual(
            focus["partnership_note"],
            f"Manual type / automatic rationale: {focus['partnership_auto_note']}",
        )

    def test_background_version_refresh_preserves_human_oi_note(self):
        tracked = record(modality="Antibody", stage="Phase 1")
        tracked["meta"]["focus_management"] = {
            "is_tracked": True,
            "partnership_type": "joint_research",
            "partnership_note": "Human reviewer rationale",
            "partnership_note_source": "manual",
            "partnership_classification_source": "manual",
            "partnership_classification_status": "manual_override",
            "partnership_classification_criteria_version": "1.6",
            "partnership_classification_history": [{"criteria_version": "1.6"}],
        }

        self.assertTrue(main.refresh_tracked_oi_classifications([tracked]))
        focus = tracked["meta"]["focus_management"]
        self.assertEqual(focus["partnership_type"], "joint_research")
        self.assertEqual(focus["partnership_note"], "Human reviewer rationale")
        self.assertEqual(focus["partnership_note_source"], "manual")

    def test_current_shortlisting_record_without_history_receives_one_audit_entry(self):
        tracked = record(modality="Antibody", stage="Phase 1")
        tracked["meta"]["focus_management"] = {
            "is_tracked": True,
            "partnership_type": "investment",
            "partnership_classification_source": "auto",
            "partnership_classification_status": "auto_classified",
            "partnership_classification_criteria_version": "1.7",
        }

        self.assertTrue(main.refresh_tracked_oi_classifications([tracked]))
        history = tracked["meta"]["focus_management"]["partnership_classification_history"]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["criteria_version"], "1.7")
        self.assertEqual(history[0]["automatic_result"], "investment")

    def test_value_up_requires_an_uploaded_scored_admet_material(self):
        result = main.classify_oi_partnership(
            record(modality="Small molecule", stage="Preclinical Candidate"),
            {"in_vivo_status": "O", "in_vitro_status": "O", "admet_completed": 0},
        )
        self.assertEqual(result["partnership_type"], "unknown")
        self.assertIn("ADMET uploaded", result["note"])

    def test_joint_research_applies_to_all_modalities_and_takes_priority(self):
        result = main.classify_oi_partnership(
            record(modality="Small molecule", stage="Preclinical Candidate", platform_score=3, admet_uploaded=True),
            {"in_vivo_status": "O", "in_vitro_status": "O", "admet_completed": 0},
        )
        self.assertEqual(result["partnership_type"], "joint_research")
        self.assertIn("All Modality", result["note"])

    def test_recalculation_snapshot_ignores_only_volatile_refresh_metadata(self):
        focus = {
            "is_tracked": True,
            "partnership_type": "investment",
            "partnership_classification_criteria_version": "1.7",
            "partnership_classification_history": [{"criteria_version": "1.7"}],
        }
        baseline = main.oi_partnership_recalculation_snapshot(focus)
        refreshed = {
            **focus,
            "partnership_recalculation": {"recalculated_at": "2026-09-01T00:00:00+00:00"},
            "partnership_classified_at": "2026-09-01T00:00:00+00:00",
            "updated_at": "2026-09-01T00:00:00+00:00",
            "updated_source": "dashboard_tab3_oi_partnership_refresh",
        }
        self.assertEqual(baseline, main.oi_partnership_recalculation_snapshot(refreshed))

        upgraded = {**refreshed, "partnership_classification_criteria_version": "1.8"}
        self.assertNotEqual(baseline, main.oi_partnership_recalculation_snapshot(upgraded))

    def test_current_filter3_refresh_returns_already_current_without_writing_history(self):
        tracked = record(modality="Antibody", stage="Phase 1")
        tracked["meta"].update({"review_type": "full_scout", "output_filename_base": "Acme_AX-101"})
        focus = {"is_tracked": True}
        tracked["meta"]["focus_management"] = focus
        main.apply_auto_detected_evidence(focus, tracked)
        main.apply_auto_oi_partnership(focus, tracked, force=True)
        history_before = copy.deepcopy(tracked["meta"].get("edit_history", []))
        request = main.Request({
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        })

        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[tracked]),
            patch.object(main, "save_records") as save_records,
        ):
            result = main.recalculate_record_oi_partnership(main.record_key(tracked), request)

        self.assertTrue(result["ok"])
        self.assertFalse(result["changed"])
        self.assertEqual(result["outcome"], "already_current")
        self.assertEqual(tracked["meta"].get("edit_history", []), history_before)
        save_records.assert_not_called()

    def test_filter3_version_upgrade_writes_one_history_event(self):
        tracked = record(modality="Antibody", stage="Phase 1")
        tracked["meta"].update({"review_type": "full_scout", "output_filename_base": "Acme_AX-101"})
        focus = {"is_tracked": True}
        tracked["meta"]["focus_management"] = focus
        main.apply_auto_detected_evidence(focus, tracked)
        main.apply_auto_oi_partnership(focus, tracked, force=True)
        focus["partnership_classification_criteria_version"] = "1.6"
        request = main.Request({
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        })

        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[tracked]),
            patch.object(main, "save_records") as save_records,
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            result = main.recalculate_record_oi_partnership(main.record_key(tracked), request)

        self.assertTrue(result["changed"])
        self.assertEqual(result["outcome"], "updated")
        self.assertEqual(result["oi_note_action"], "auto_rationale_updated")
        self.assertEqual(tracked["meta"]["focus_management"]["partnership_note_source"], "auto")
        self.assertEqual(tracked["meta"]["edit_history"][-1]["field"], "focus_management.partnership_refresh")
        self.assertEqual(tracked["meta"]["edit_history"][-1]["instruction_version"], main.OI_PARTNERSHIP_CRITERIA_VERSION)
        save_records.assert_called_once()

    def test_filter3_manual_classification_reset_retains_oi_note_and_is_audited(self):
        tracked = record(modality="Antibody", stage="Phase 1")
        tracked["meta"].update({"review_type": "full_scout", "output_filename_base": "Acme_AX-101"})
        focus = {"is_tracked": True}
        tracked["meta"]["focus_management"] = focus
        main.apply_auto_detected_evidence(focus, tracked)
        main.apply_auto_oi_partnership(focus, tracked, force=True)
        focus["partnership_type"] = "joint_research"
        focus["partnership_note"] = "Human reviewer decision"
        focus["partnership_note_source"] = "manual"
        focus["partnership_classification_source"] = "manual"
        focus["partnership_classification_status"] = "manual_override"
        request = main.Request({
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        })

        with (
            patch.object(main, "require_auth_admin", return_value={"name": "Review Admin"}),
            patch.object(main, "load_records", return_value=[tracked]),
            patch.object(main, "save_records"),
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            result = main.recalculate_record_oi_partnership(main.record_key(tracked), request)

        self.assertTrue(result["changed"])
        self.assertTrue(result["manual_classification_reset"])
        self.assertEqual(result["oi_note_action"], "human_note_retained")
        self.assertEqual(result["partnership_note"], "Human reviewer decision")
        self.assertEqual(tracked["meta"]["focus_management"]["partnership_note"], "Human reviewer decision")
        self.assertIn("manual classification reset", tracked["meta"]["edit_history"][-1]["audit_label"])
        self.assertIn("human OI Note retained", tracked["meta"]["edit_history"][-1]["audit_label"])
