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
    def test_investment_includes_ind_enabling_and_later_stages(self):
        for stage in ("IND-enabling", "IND filed/cleared", "Phase 1", "Phase 2", "Approved / marketed"):
            with self.subTest(stage=stage):
                result = main.classify_oi_partnership(record(modality="Antibody", stage=stage), {})
                self.assertEqual(result["partnership_type"], "investment")
                self.assertIn("IND-enabling 이상", result["note"])
                self.assertEqual(result["criteria_version"], "1.4")

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
                self.assertEqual(result["partnership_type"], "n_a")
                self.assertIn("IND-enabling 미만 아님", result["note"])

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
        self.assertEqual(focus["partnership_classification_criteria_version"], "1.4")
        self.assertEqual(focus["partnership_type"], "n_a")

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
