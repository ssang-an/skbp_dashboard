from __future__ import annotations

import unittest

import main


def record(*, modality: str, stage: str, platform_score: int = 1) -> dict:
    return {
        "structured_table": {
            "main_indication": "Alzheimer's Disease",
            "modality_platform": modality,
            "development_stage": stage,
        },
        "scoring": {"criteria": {"platform_attractiveness": {"score": platform_score}}},
        "source_report": {"raw_markdown": ""},
        "meta": {},
    }


class OiPartnershipCriteriaTests(unittest.TestCase):
    def test_investment_includes_ind_enabling_and_later_stages(self):
        for stage in ("IND-enabling", "IND filed/cleared", "Phase 1", "Phase 2", "Approved / marketed"):
            with self.subTest(stage=stage):
                result = main.classify_oi_partnership(record(modality="Antibody", stage=stage), {})
                self.assertEqual(result["partnership_type"], "investment")
                self.assertIn("IND-enabling 이상", result["note"])
                self.assertEqual(result["criteria_version"], "1.2")

    def test_value_up_requires_pre_ind_enabling_stage(self):
        evidence = {"in_vivo_status": "O", "in_vitro_status": "O", "admet_completed": 25}
        eligible = main.classify_oi_partnership(
            record(modality="Small molecule", stage="Preclinical Candidate"), evidence
        )
        self.assertEqual(eligible["partnership_type"], "value_up")

        for stage in ("IND-enabling", "IND filed/cleared", "Phase 1"):
            with self.subTest(stage=stage):
                result = main.classify_oi_partnership(record(modality="Small molecule", stage=stage), evidence)
                self.assertEqual(result["partnership_type"], "n_a")
                self.assertIn("IND-enabling 미만 아님", result["note"])

    def test_value_up_requires_confirmed_stage(self):
        result = main.classify_oi_partnership(
            record(modality="Small molecule", stage="Unknown"),
            {"in_vivo_status": "O", "in_vitro_status": "O", "admet_completed": 25},
        )
        self.assertEqual(result["partnership_type"], "unknown")
        self.assertIn("Development Stage", result["note"])

    def test_version_bump_refreshes_incomplete_v11_value_up_classification(self):
        tracked = record(modality="Small molecule", stage="IND-enabling")
        tracked["meta"]["focus_management"] = {
            "is_tracked": True,
            "in_vivo_status": "O",
            "in_vivo_status_source": "manual",
            "in_vitro_status": "O",
            "in_vitro_status_source": "manual",
            "admet_completed": 25,
            "admet_completed_source": "manual",
            "partnership_type": "value_up",
            "partnership_classification_source": "auto",
            "partnership_classification_status": "auto_classified",
            "partnership_classification_criteria_version": "1.1",
        }

        self.assertTrue(main.refresh_tracked_oi_classifications([tracked]))
        focus = tracked["meta"]["focus_management"]
        self.assertEqual(focus["partnership_classification_criteria_version"], "1.2")
        self.assertEqual(focus["partnership_type"], "n_a")
