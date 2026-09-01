from __future__ import annotations

import unittest

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
