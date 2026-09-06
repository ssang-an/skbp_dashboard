from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from fastapi import HTTPException

import main


ROOT = Path(__file__).resolve().parents[1]


class EditProvenanceTests(unittest.TestCase):
    def test_general_activity_does_not_replace_source_report_last_edited_metadata(self) -> None:
        record = {
            "meta": {
                "last_edited_at": "2026-07-01T00:00:00+00:00",
                "last_edited_by": "report-editor",
                "edit_history": [],
            }
        }

        main.append_edit_history(
            record,
            source="dashboard_qualitative_review_ai_generate",
            actor_ip="127.0.0.1",
            field="qualitative_review.efficacy",
            new_value="AI review",
        )

        self.assertEqual(record["meta"]["last_edited_at"], "2026-07-01T00:00:00+00:00")
        self.assertEqual(record["meta"]["last_edited_by"], "report-editor")
        self.assertEqual(record["meta"]["edit_history"][-1]["field"], "qualitative_review.efficacy")

    def test_source_report_activity_updates_visible_last_edited_metadata(self) -> None:
        record = {"meta": {"edit_history": []}}

        entry = main.append_edit_history(
            record,
            source="detail_ai_agent_revision",
            actor_ip="127.0.0.1",
            actor_name="Reviewer",
            field="source_report.raw_markdown",
            update_last_edited=True,
        )

        self.assertEqual(record["meta"]["last_edited_at"], entry["changed_at"])
        self.assertEqual(record["meta"]["last_edited_by"], "Reviewer")

    def test_full_scout_revision_metadata_is_derived_only_from_source_report_events(self) -> None:
        record = {
            "meta": {
                "last_edited_at": "2026-08-02T00:00:00+00:00",
                "last_edited_by": "127.0.0.1",
                "edit_history": [
                    {
                        "changed_at": "2026-08-02T00:00:00+00:00",
                        "actor_ip": "127.0.0.1",
                        "source": "dashboard_qualitative_review_ai_generate",
                        "field": "qualitative_review.efficacy",
                    }
                ],
            },
            "scoring": {"criteria": {criterion_id: {} for criterion_id in main.CRITERION_IDS}},
            "hard_filter": {"status": "REVIEW"},
        }

        changed = main.synchronize_full_scout_source_revision_metadata(record)

        self.assertTrue(changed)
        self.assertNotIn("last_edited_at", record["meta"])
        self.assertNotIn("last_edited_by", record["meta"])

        record["meta"]["edit_history"].append(
            {
                "changed_at": "2026-08-02T01:00:00+00:00",
                "actor_ip": "127.0.0.1",
                "actor_name": "Reviewer",
                "source": "dashboard_tab2_rubric_recalculation",
                "field": "source_report.raw_markdown",
                "new_value": "rubric v3.3",
            }
        )
        main.synchronize_full_scout_source_revision_metadata(record)

        self.assertEqual(record["meta"]["last_edited_at"], "2026-08-02T01:00:00+00:00")
        self.assertEqual(record["meta"]["last_edited_by"], "Reviewer")


class ServerDerivedScoringFieldTests(unittest.TestCase):
    def test_full_scout_status_and_total_are_aligned_without_changing_scores(self) -> None:
        scores = {
            "target_relevance": 3,
            "competitive_landscape": 2,
            "moa_validity": 3,
            "platform_attractiveness": 2,
            "expansion_potential": 2,
            "data_maturity": 3,
            "marketability": 0,
        }
        record = {
            "meta": {"review_type": "full_scout"},
            "structured_table": {"development_stage": "IND-enabling"},
            "hard_filter": {"status": "REVIEW", "reason": "Authored rationale.", "flags": []},
            "scoring": {
                "total_score": 12,
                "max_score": 9,
                "criteria": {criterion_id: {"score": score} for criterion_id, score in scores.items()},
            },
        }

        adjustments = main.synchronize_server_derived_scoring_fields([record])

        self.assertEqual(record["scoring"]["total_score"], 15)
        self.assertEqual(record["scoring"]["max_score"], 21)
        self.assertEqual(record["hard_filter"]["status"], "PASS")
        self.assertEqual(record["hard_filter"]["reason"], "Authored rationale.")
        self.assertEqual(
            {item["path"] for item in adjustments},
            {"scoring.total_score", "scoring.max_score", "hard_filter.status"},
        )
        self.assertEqual(record["scoring"]["criteria"]["data_maturity"]["score"], 3)

    def test_triage_status_total_and_recommendation_are_aligned(self) -> None:
        record = {
            "meta": {"review_type": "fast_triage"},
            "structured_table": {"development_stage": "Preclinical Candidate"},
            "hard_filter": {"status": "SELECT", "reason": "Authored rationale.", "flags": []},
            "triage": {"status": "SELECT", "identity_verified": True, "active_asset": True},
            "scoring": {
                "total_score": 0,
                "max_score": 21,
                "criteria": {
                    "target_relevance": {"score": 2},
                    "moa_validity": {"score": 1},
                    "data_maturity": {"score": 1},
                },
            },
            "final_insight": {"recommendation": "Run Full Scout"},
        }

        main.synchronize_server_derived_scoring_fields([record])

        self.assertEqual(record["scoring"]["total_score"], 4)
        self.assertEqual(record["scoring"]["max_score"], 9)
        self.assertEqual(record["hard_filter"]["status"], "REJECT")
        self.assertEqual(record["triage"]["status"], "REJECT")
        self.assertEqual(record["final_insight"]["recommendation"], "Monitor / gather more evidence")


class FullScoutReportScoreSyncTests(unittest.TestCase):
    def test_official_rubric_scores_sync_to_report_but_human_overrides_do_not(self) -> None:
        scores = {
            "target_relevance": 3,
            "competitive_landscape": 2,
            "moa_validity": 1,
            "platform_attractiveness": 2,
            "expansion_potential": 3,
            "data_maturity": 2,
            "marketability": 1,
        }
        record = {
            "meta": {
                "review_type": "full_scout",
                "human_review": {
                    "overrides": {
                        "scores": {"target_relevance": 0},
                        "total_score": 7,
                    }
                },
            },
            "scoring": {
                "total_score": 14,
                "max_score": 21,
                "criteria": {
                    criterion_id: {"score": score}
                    for criterion_id, score in scores.items()
                },
            },
            "hard_filter": {"status": "PASS"},
            "source_report": {
                "raw_markdown": """# Report

## Scorecard

| Criterion | Score |
|---|---:|
| Target Relevance | 1/3 |
| Competitive Landscape | 1 / 3 |
| MoA Validity | 0/3 |
| Platform Attractiveness | 1/3 |
| Expansion Potential | 1/3 |
| Data Maturity | 1/3 |
| Marketability | 0/3 |
| **Total** | **5/21** |

### Target Relevance — 1/3
Score: **1 / 3**

### 4.7 Marketability
Score: **0 / 3**
"""
            },
        }

        changes = main.synchronize_full_scout_report_scores(record)
        markdown = record["source_report"]["raw_markdown"]

        self.assertEqual(len(changes), 1)
        self.assertIn("| Target Relevance | 3 / 3 |", markdown)
        self.assertIn("| Competitive Landscape | 2 / 3 |", markdown)
        self.assertIn("| MoA Validity | 1 / 3 |", markdown)
        self.assertIn("| Platform Attractiveness | 2 / 3 |", markdown)
        self.assertIn("| Expansion Potential | 3 / 3 |", markdown)
        self.assertIn("| Data Maturity | 2 / 3 |", markdown)
        self.assertIn("| Marketability | 1 / 3 |", markdown)
        self.assertIn("| **Total** | **14 / 21** |", markdown)
        self.assertIn("### Target Relevance — 3 / 3", markdown)
        self.assertIn("### 4.7 Marketability\nScore: **1 / 3**", markdown)
        self.assertNotIn("| Target Relevance | 0 / 3 |", markdown)
        self.assertNotIn("| **Total** | **7 / 21** |", markdown)
        self.assertEqual(main.synchronize_full_scout_report_scores(record), [])


def triage_criterion(
    score: int,
    evidence_basis: str,
    summary: str,
    sources: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return {
        "score": score,
        "evidence_type": "triage_only",
        "evidence_basis": evidence_basis,
        "main_line_summary": summary,
        "evidence_sources": sources or [],
        "uncertain_points": [],
    }


def current_triage_record() -> dict[str, object]:
    record = {
        "meta": {
            "schema_version": "3.2",
            "instruction_version": "3.7",
            "rubric_version": "3.7",
            "review_type": "fast_triage",
            "generated_at": "2026-08-01",
            "output_filename_base": "Acceptance_Test_Asset_fast_triage_20260801",
        },
        "input": {
            "company_input": "Acceptance Test Biotech",
            "asset_input": "Acceptance Test Asset",
            "notes": "Indication = Parkinson's disease; Target/MoA = LRRK2 inhibitor; Data = preclinical efficacy claimed.",
        },
        "source_report": {
            "source_format": "fast_triage_markdown",
            "parser_status": "fast_triage",
        },
        "structured_table": {
            "company": "Acceptance Test Biotech",
            "asset_name": "Acceptance Test Asset",
            "target": "LRRK2",
            "moa": "LRRK2 inhibitor",
            "main_indication": "Parkinson's disease",
            "development_stage": "Unknown",
        },
        "hard_filter": {"status": "REJECT", "reason": "SELECT gate 미충족", "flags": []},
        "triage": {
            "instruction_version": "3.7",
            "status": "REJECT",
            "identity_verified": True,
        },
        "scoring": {
            "total_score": None,
            "max_score": None,
            "criteria": {
                "target_relevance": triage_criterion(
                    3,
                    "user_input_only",
                    "Parkinson's disease는 SKBP 우선 관심 적응증에 해당하여 TR 2점입니다. Target/MoA의 직접적인 biology fit은 확인되지 않았습니다.",
                ),
                "moa_validity": triage_criterion(
                    0,
                    "no_supporting_basis",
                    "Target 또는 작용기전을 확인할 수 없어 MoA 0점입니다.",
                ),
                "data_maturity": triage_criterion(
                    0,
                    "no_supporting_basis",
                    "공개된 asset-specific 결과가 없어 Data 0점입니다.",
                ),
            },
        },
        "final_insight": {
            "one_line_summary": "The SELECT gate is not met.",
            "recommendation": "Monitor / gather more evidence",
            "most_important_diligence_question": "Can the missing public evidence be verified?",
        },
    }
    criteria = record["scoring"]["criteria"]
    criteria["target_relevance"] = triage_criterion(
        3,
        "user_input_only",
        "TR 3 points: Parkinson's disease is one of the six priority indications.",
    )
    criteria["moa_validity"] = triage_criterion(
        1,
        "user_input_only",
        "MoA 1 points: LRRK2 inhibitor is a user-provided mechanism claim without functional validation.",
    )
    criteria["data_maturity"] = triage_criterion(
        1,
        "user_input_only",
        "Data 1 points: user-provided preclinical efficacy is a qualitative claim without quantitative results.",
    )
    return record


class VersionAndPolicyTests(unittest.TestCase):
    def test_current_versions(self) -> None:
        self.assertEqual(main.TRIAGE_CRITERIA_VERSION, "3.7")
        self.assertEqual(main.TRIAGE_SCHEMA_VERSION, "3.2")
        self.assertEqual(main.SCORING_CRITERIA_VERSION, "3.8")
        self.assertEqual(main.FULL_SCOUT_SCHEMA_VERSION, "3.2")
        self.assertTrue(main.SCORING_CRITERIA_TRIAGE_MD.name.startswith("v3_7_"))
        self.assertTrue(main.SCORING_CRITERIA_FULL_MD.name.startswith("v3_8_"))
        self.assertTrue(main.SCORING_CRITERIA_DISPLAY_MD.name.startswith("v3_10_"))

    def test_fast_triage_select_formula_and_identity_gate(self) -> None:
        # v3.5 dropped the separate active_asset tri-state field: it overlapped
        # with development_stage and its "confirmed inactive" bar was undefined
        # in evidentiary/recency terms. development_stage == "Discontinued /
        # inactive" is now the sole activity gate; Unknown no longer blocks
        # SELECT the way active_asset=None used to force REJECT.
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=2,
                moa_validity=2,
                data_maturity=2,
                development_stage="Phase 1",
            ),
            "REJECT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=3,
                moa_validity=1,
                data_maturity=2,
                development_stage="Phase 1",
            ),
            "SELECT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=2,
                moa_validity=2,
                data_maturity=0,
                development_stage="Phase 1",
            ),
            "INSUFFICIENT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=2,
                moa_validity=0,
                data_maturity=2,
                development_stage="Phase 1",
            ),
            "INSUFFICIENT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=2,
                moa_validity=0,
                data_maturity=0,
                development_stage="Phase 1",
            ),
            "INSUFFICIENT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=False,
                target_relevance=3,
                moa_validity=3,
                data_maturity=3,
                development_stage="Phase 1",
            ),
            "INSUFFICIENT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=3,
                moa_validity=3,
                data_maturity=3,
                development_stage="Discontinued / inactive",
            ),
            "INSUFFICIENT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=3,
                moa_validity=3,
                data_maturity=3,
                development_stage="Unknown",
            ),
            "SELECT",
        )

    def test_target_relevance_acceptance_cases_1_to_7(self) -> None:
        self.assertEqual(main.calculate_target_relevance_score("Alzheimer's disease"), 3)
        self.assertEqual(
            main.calculate_target_relevance_score(
                "Alzheimer's disease",
                direct_biology_fit=True,
            ),
            3,
        )
        self.assertEqual(
            main.calculate_target_relevance_score(
                "Alzheimer's disease",
                direct_biology_fit=True,
                target_moa_contradiction=True,
            ),
            3,
        )
        self.assertEqual(
            main.match_skbp_interest_indication("Diabetic peripheral neuropathic pain"),
            "Neuropathic pain",
        )
        self.assertEqual(
            main.calculate_target_relevance_score("Diabetic peripheral neuropathic pain"),
            3,
        )
        self.assertEqual(main.calculate_target_relevance_score("Pain, subtype unspecified"), 2)
        self.assertEqual(main.calculate_target_relevance_score("Parkinson's disease"), 3)
        self.assertEqual(main.calculate_target_relevance_score("Major depressive disorder"), 2)
        self.assertEqual(main.calculate_target_relevance_score("Inflammatory bowel disease"), 1)
        self.assertEqual(main.calculate_target_relevance_score("Unknown"), 0)

    def test_user_input_only_hallucinated_cell_claim_is_detected(self) -> None:
        record = current_triage_record()
        criterion = record["scoring"]["criteria"]["target_relevance"]
        criterion["main_line_summary"] = "TR 3 points: This asset is microglia-directed in Parkinson's disease."
        self.assertIn(
            "microglia",
            main.unsupported_user_input_only_summary_claims(record, "target_relevance"),
        )
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("not found in user input", str(caught.exception.detail))

    def test_user_input_only_hallucinated_target_and_data_claims_are_detected(self) -> None:
        cases = (
            ("target_relevance", 3, "TR 3 points: TREM2 inhibitor is claimed for Parkinson's disease.", "target/MoA=TREM2"),
            ("moa_validity", 1, "MoA 1 points: TREM2 inhibitor is the claimed mechanism.", "target/MoA=TREM2"),
            ("data_maturity", 1, "Data 1 points: in vivo efficacy improved by 80%.", "data=80%"),
        )
        for criterion_id, score, summary, expected_claim in cases:
            record = current_triage_record()
            criterion = record["scoring"]["criteria"][criterion_id]
            criterion["evidence_basis"] = "user_input_only"
            criterion["score"] = score
            criterion["main_line_summary"] = summary
            with self.subTest(criterion_id=criterion_id):
                claims = main.unsupported_user_input_only_summary_claims(record, criterion_id)
                self.assertIn(expected_claim, claims)
                with self.assertRaises(HTTPException) as caught:
                    main.validate_records_for_save([record])
                self.assertIn("not found in user input", str(caught.exception.detail))

    def test_user_input_only_summary_ignores_public_table_fact_not_repeated_in_summary(self) -> None:
        record = current_triage_record()
        record["structured_table"]["target"] = "LRRK2"
        criterion = record["scoring"]["criteria"]["target_relevance"]
        criterion["main_line_summary"] = (
            "Parkinson's disease is an SKBP interest indication, so TR is 3 points. "
            "Direct target/MoA biology fit was not used for this preliminary score."
        )
        self.assertEqual(
            main.unsupported_user_input_only_summary_claims(record, "target_relevance"),
            [],
        )
        criterion["main_line_summary"] = (
            "Parkinson's disease is in scope, so TR is 3 points. "
            "Target engagement was not confirmed."
        )
        self.assertEqual(
            main.unsupported_user_input_only_summary_claims(record, "target_relevance"),
            [],
        )

    def test_fast_markdown_status_parser_rejects_legacy_and_mismatch(self) -> None:
        markdown = """# SKBP Fast Triage Result

| # | Asset | Triage | Why |
|---:|---|---|---|
| 1 | Acceptance Test Asset | N/A | identity not verified |
"""
        rows = main.parse_fast_triage_markdown_status_rows(markdown)
        self.assertEqual(rows, [{"asset": "Acceptance Test Asset", "status": "N/A"}])

        record = current_triage_record()
        record["source_report"]["raw_markdown"] = markdown
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("legacy Fast Triage status N/A", str(caught.exception.detail))

        record["source_report"]["raw_markdown"] = markdown.replace("N/A", "SELECT")
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("must match JSON status REJECT", str(caught.exception.detail))

        record["source_report"]["raw_markdown"] = "# SKBP Fast Triage Result\n\nStatus was reviewed."
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("must contain a Fast Triage status table", str(caught.exception.detail))

    def test_fast_hard_filter_and_triage_status_are_server_aligned(self) -> None:
        record = current_triage_record()
        record["hard_filter"]["status"] = "SELECT"
        main.validate_records_for_save([record])
        self.assertEqual(record["hard_filter"]["status"], "REJECT")
        self.assertEqual(record["triage"]["status"], "REJECT")

    def test_fast_summary_requires_the_selected_single_score(self) -> None:
        self.assertTrue(
            main.fast_triage_summary_has_single_score(
                "Parkinson's disease is in scope, so TR is 2 points.",
                "target_relevance",
                2,
            )
        )
        for summary in (
            "Parkinson's disease is in scope.",
            "TR is 3 points.",
            "TR is 2/3 points.",
            "TR 2점 / 3점입니다.",
        ):
            with self.subTest(summary=summary):
                self.assertFalse(
                    main.fast_triage_summary_has_single_score(summary, "target_relevance", 2)
                )

    def test_fast_summary_ignores_scientific_numbers_after_the_criterion_score(self) -> None:
        cases = (
            ("target_relevance", 3, "TR 3 points: The verified MEK1/2 mechanism supports ALS relevance."),
            ("data_maturity", 2, "Data 2 points: A study reported 65.4% versus 47.1%, OR 2.12."),
            ("moa_validity", 1, "MOA 1 points: TTYP-01 is described as a free-radical scavenger."),
            ("target_relevance", 2, "TR 2 points: AXN-1501 is associated with Alzheimer's disease."),
        )
        for criterion_id, score, summary in cases:
            with self.subTest(summary=summary):
                self.assertTrue(main.fast_triage_summary_has_single_score(summary, criterion_id, score))

    def test_fast_summary_rejects_only_actual_criterion_score_mismatches(self) -> None:
        self.assertFalse(
            main.fast_triage_summary_has_single_score(
                "TR 2 points: The verified MEK1/2 mechanism supports ALS relevance.",
                "target_relevance",
                3,
            )
        )
        self.assertFalse(
            main.fast_triage_summary_has_single_score(
                "MOA 3 points: TTYP-01 is described as a free-radical scavenger.",
                "moa_validity",
                1,
            )
        )
        self.assertFalse(
            main.fast_triage_summary_has_single_score(
                "TR 2 points: Data 1 points were also reported.",
                "target_relevance",
                2,
            )
        )

    def test_fast_save_accepts_a_compact_summary_with_an_asset_code_number(self) -> None:
        record = current_triage_record()
        record["input"]["asset_input"] = "AXN-1501"
        record["structured_table"]["asset_name"] = "AXN-1501"
        record["input"]["notes"] = "AXN-1501 is associated with Alzheimer's disease; Target/MoA = LRRK2 inhibitor; Data = preclinical efficacy claimed."
        record["scoring"]["criteria"]["target_relevance"]["main_line_summary"] = (
            "TR 3 points: AXN-1501 is associated with Alzheimer's disease."
        )

        main.validate_records_for_save([record])

    def test_fast_save_preserves_existing_criterion_labelled_summaries(self) -> None:
        main.validate_records_for_save([current_triage_record()])

    def test_fast_save_reports_each_invalid_criterion_score_expression(self) -> None:
        record = current_triage_record()
        record["input"]["notes"] += " Data = 65.4%."
        criteria = record["scoring"]["criteria"]
        criteria["target_relevance"]["score"] = 3
        criteria["target_relevance"]["main_line_summary"] = "TR 2 points: MEK1/2 evidence was reviewed."
        criteria["moa_validity"]["score"] = 1
        criteria["moa_validity"]["main_line_summary"] = "MOA 3 points: mechanism evidence was reviewed."
        criteria["data_maturity"]["main_line_summary"] = "Data 2 points: 65.4% was reported."

        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])

        detail = str(caught.exception.detail)
        self.assertIn("record[0].scoring.criteria.target_relevance.main_line_summary expected score 3", detail)
        self.assertIn("detected score expression(s): target_relevance=2", detail)
        self.assertIn("record[0].scoring.criteria.moa_validity.main_line_summary expected score 1", detail)
        self.assertIn("record[0].scoring.criteria.data_maturity.main_line_summary expected score 1", detail)

    def test_fast_save_rejects_missing_or_range_score_summary(self) -> None:
        for summary in ("Parkinson's disease is in scope.", "TR is 2/3 points."):
            record = current_triage_record()
            record["scoring"]["criteria"]["target_relevance"]["main_line_summary"] = summary
            with self.subTest(summary=summary), self.assertRaises(HTTPException) as caught:
                main.validate_records_for_save([record])
            self.assertIn("single selected score", str(caught.exception.detail))

    def test_moa_acceptance_cases_9_and_10(self) -> None:
        self.assertEqual(
            main.calculate_moa_validity_score(
                target_or_moa_confirmed=True,
                same_target_or_class_validation=True,
            ),
            2,
        )
        self.assertEqual(
            main.calculate_moa_validity_score(
                target_or_moa_confirmed=True,
                asset_specific_target_engagement=True,
            ),
            3,
        )
        self.assertEqual(
            main.calculate_moa_validity_score(
                target_or_moa_confirmed=True,
                asset_specific_mechanism_linked_pd=True,
            ),
            3,
        )

    def test_data_acceptance_cases_11_and_12(self) -> None:
        self.assertEqual(
            main.calculate_data_maturity_score(
                ["in vivo efficacy", "PK/PD"],
                has_asset_specific_result=True,
                results_are_quantitative_and_interpretable=True,
                has_program_progression_support=True,
            ),
            3,
        )
        self.assertEqual(
            main.count_distinct_evidence_domains(
                ["potency", "selectivity", "in vitro potency", "in vitro selectivity"]
            ),
            1,
        )
        self.assertEqual(
            main.calculate_data_maturity_score(
                ["potency", "selectivity"],
                has_asset_specific_result=True,
                results_are_quantitative_and_interpretable=True,
                has_program_progression_support=True,
            ),
            2,
        )


class DevelopmentStageTests(unittest.TestCase):
    def test_canonical_stage_acceptance_cases_13_to_17(self) -> None:
        cases = {
            "preclinical": "Preclinical unspecified",
            "development candidate nominated": "Preclinical Candidate",
            "IND submission planned next year": "Unknown",
            "preclinical; IND submission planned next year": "Preclinical unspecified",
            "IND-enabling GLP toxicology underway": "IND-enabling",
            "Phase 2 planned next year; preclinical studies ongoing": "Preclinical unspecified",
            "Phase 1 planned; GLP toxicology underway": "IND-enabling",
            "plan to start Phase 2": "Unknown",
            "plans to enter Phase 1": "Unknown",
            "aims to start Phase 2": "Unknown",
            "intends to initiate Phase 1": "Unknown",
            "expects to begin Phase 2": "Unknown",
            "target Phase 1": "Unknown",
            "planning IND preparation": "Unknown",
            "plans to begin GLP toxicology": "Unknown",
            "will initiate Phase 1 next year": "Unknown",
            "Phase 1 will begin next year": "Unknown",
            "Phase 2 is scheduled to start next year": "Unknown",
            "proposed Phase 1 study": "Unknown",
        }
        for source_wording, expected in cases.items():
            with self.subTest(source_wording=source_wording):
                self.assertEqual(main.canonicalize_development_stage(source_wording), expected)

    def test_multi_indication_stage_keeps_confirmed_current_phase(self) -> None:
        self.assertEqual(
            main.canonicalize_development_stage(
                "Phase II recruiting for FOS; MDD Phase II initializing in China; pain stage unclear"
            ),
            "Phase 2",
        )
        self.assertEqual(main.canonicalize_development_stage("Phase II status unclear"), "Unknown")
        self.assertEqual(main.canonicalize_development_stage("preclinical status unclear"), "Unknown")

    def test_speculative_or_historical_inactive_text_does_not_override_current_stage(self) -> None:
        self.assertEqual(
            main.canonicalize_development_stage(
                "Uncertain; likely preclinical or dormant; no public trial identified"
            ),
            "Unknown",
        )
        self.assertEqual(
            main.canonicalize_development_stage(
                "Preclinical / IND-enabling. MP-5342 entered IND-enabling studies. "
                "META-01 historical entry is listed as discontinued discovery."
            ),
            "IND-enabling",
        )
        self.assertEqual(
            main.canonicalize_development_stage("The assessed asset was discontinued in 2025"),
            "Discontinued / inactive",
        )

    def test_exact_stage_vocabulary(self) -> None:
        self.assertEqual(
            list(main.CANONICAL_DEVELOPMENT_STAGES),
            [
                "Hit Discovery",
                "Lead Optimization",
                "Preclinical Candidate",
                "IND-enabling",
                "Preclinical unspecified",
                "IND filed/cleared",
                "Clinical unspecified",
                "Phase 1",
                "Phase 1/2",
                "Phase 2",
                "Phase 2/3",
                "Phase 3",
                "Registration",
                "Approved / marketed",
                "Discontinued / inactive",
                "Unknown",
            ],
        )


class ModalityCanonicalizationTests(unittest.TestCase):
    def test_route_and_formulation_qualifiers_map_to_one_dashboard_label(self) -> None:
        cases = {
            "Oral small molecule": "Small molecule",
            "Oral small-molecule / tablet; CNS discovery platform": "Small molecule",
            "IV antibody": "Antibody",
            "topical peptide": "Peptide",
            "AAV gene therapy": "Gene therapy",
            "not disclosed": "Unknown",
            "Unknown": "Unknown",
        }
        for source_wording, expected in cases.items():
            with self.subTest(source_wording=source_wording):
                self.assertEqual(main.canonicalize_modality(source_wording), expected)

    def test_shared_modality_dictionary_matches_backend_vocabulary(self) -> None:
        dictionary = json.loads(
            (ROOT / "config" / "category-synonyms.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            [entry["canonical"] for entry in dictionary["modality"]],
            list(main.CANONICAL_MODALITIES),
        )


class DashboardCategoryCanonicalizationTests(unittest.TestCase):
    def test_country_alias_and_legacy_indication_fallbacks_are_canonical(self) -> None:
        self.assertEqual(main.canonicalize_country("China / United States operations"), "China / United States")
        self.assertEqual(main.canonicalize_country("United States HQ / China operations"), "United States / China")
        self.assertEqual(
            main.canonicalize_main_indication(
                "",
                "Lead disclosed indication: inflammatory bowel disease; expansion potential for MS",
            ),
            "Inflammatory bowel disease",
        )
        self.assertEqual(
            main.canonicalize_main_indication(
                "",
                "Focal onset seizure; major depressive disorder; pain",
            ),
            "Epilepsy / seizure disorders",
        )
        self.assertEqual(
            main.canonicalize_main_indication(
                "",
                "CNS hypotheses include acute ischemic stroke and status epilepticus",
            ),
            "Stroke",
        )
        self.assertEqual(
            main.canonicalize_main_indication("", "Refractory chronic cough"),
            "Chronic cough",
        )
        self.assertEqual(
            main.canonicalize_main_indication("Unknown", "Epilepsy; pain"),
            "Epilepsy / seizure disorders",
        )
        self.assertEqual(
            main.canonicalize_indication_list(
                [],
                "Focal onset seizure; major depressive disorder; pain",
                "Unknown",
            ),
            ["Epilepsy / seizure disorders", "Major depressive disorder", "Pain"],
        )

    def test_multi_indication_normalization_uses_source_order_when_lead_is_unknown(self) -> None:
        record = {
            "structured_table": {
                "development_stage": "Preclinical",
                "modality_platform": "Small molecule",
                "company_country": "Republic of Korea",
                "main_indication": "Unknown",
                "indication": "Focal onset seizure; major depressive disorder; pain",
                "indication_list": [],
            }
        }

        main.normalize_current_record_filter_fields(record, 0)

        table = record["structured_table"]
        self.assertEqual(table["main_indication"], "Epilepsy / seizure disorders")
        self.assertEqual(
            table["indication_list"],
            ["Epilepsy / seizure disorders", "Major depressive disorder", "Pain"],
        )

    def test_theme_cluster_legacy_aliases_close_into_dashboard_taxonomy(self) -> None:
        self.assertEqual(
            main.canonicalize_theme_cluster("No Theme", "No mapped SKBP cluster"),
            ("Others", "Others"),
        )
        self.assertEqual(
            main.canonicalize_theme_cluster("Neuroimmune", "Cytokine 신경조절"),
            ("Neuroimmune", "Cytokine 신경조절"),
        )
        self.assertEqual(
            main.canonicalize_theme_cluster("Unknown", "N/A"),
            ("Unknown", "Unknown"),
        )
        self.assertEqual(
            main.canonicalize_theme_cluster("Proteostasis", "No mapped cluster"),
            ("Protein Homeostasis", "Unknown"),
        )
        self.assertIn("Protein Homeostasis", main.THEMES)
        dictionary = json.loads(
            (ROOT / "config" / "category-synonyms.json").read_text(encoding="utf-8")
        )
        theme_values = [entry["canonical"] for entry in dictionary["theme"]]
        self.assertEqual(
            theme_values,
            ["E/I Balance", "Neuroimmune", "Protein Homeostasis", "Others", "Unknown"],
        )

    def test_save_filter_normalizer_closes_all_filter_facing_categories(self) -> None:
        record = current_triage_record()
        record["structured_table"].update({
            "modality_platform": "Oral small-molecule tablet",
            "development_stage": "Phase II recruiting",
            "company_country": "China / United States operations",
            "main_indication": "",
            "indication": "Lead indication: inflammatory bowel disease; expansion potential for MS",
        })
        record["json_summary"] = {
            "theme": "No Theme",
            "cluster": "No mapped SKBP cluster",
        }
        main.normalize_current_record_filter_fields(record, 0)
        self.assertEqual(record["structured_table"]["modality_platform"], "Small molecule")
        self.assertEqual(record["structured_table"]["development_stage"], "Phase 2")
        self.assertEqual(record["structured_table"]["company_country"], "China / United States")
        self.assertEqual(record["structured_table"]["main_indication"], "Inflammatory bowel disease")
        self.assertEqual(record["json_summary"]["theme"], "Others")
        self.assertEqual(record["json_summary"]["cluster"], "Others")


class EvidenceContractTests(unittest.TestCase):
    def test_case_7_user_input_only_record_is_valid(self) -> None:
        record = current_triage_record()
        main.validate_records_for_save([record])
        criterion = record["scoring"]["criteria"]["target_relevance"]
        self.assertEqual(criterion["score"], 3)
        self.assertEqual(criterion["evidence_basis"], "user_input_only")

    def test_case_18_public_source_without_verified_url_is_invalid(self) -> None:
        record = current_triage_record()
        criterion = record["scoring"]["criteria"]["target_relevance"]
        criterion["evidence_basis"] = "public_source"
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("verified", str(caught.exception.detail).lower())

    def test_case_19_two_unique_verified_urls_are_counted(self) -> None:
        criterion = triage_criterion(
            2,
            "public_source",
            "공개자료를 확인하여 TR 2점입니다.",
            [
                {"source_url": "https://example.org/a", "verified": True},
                {"source_url": "https://example.org/b", "verified": True},
                {"source_url": "https://example.org/a/", "verified": True},
                {"source_url": "https://example.org/a#results", "verified": True},
                {"source_url": "http://localhost/private", "verified": True},
                {"source_url": "source_url_not_provided"},
            ],
        )
        self.assertEqual(
            main.verified_public_source_urls(criterion),
            ["https://example.org/a", "https://example.org/b"],
        )

    def test_user_supplied_bare_url_is_not_implicitly_verified(self) -> None:
        record = current_triage_record()
        criterion = record["scoring"]["criteria"]["target_relevance"]
        criterion["evidence_basis"] = "public_source"
        criterion["evidence_sources"] = ["https://example.org/user-supplied-only"]
        self.assertEqual(main.verified_public_source_urls(criterion), [])
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("verified", str(caught.exception.detail).lower())

    def test_moa_and_data_two_require_verified_public_source(self) -> None:
        for criterion_id in ("moa_validity", "data_maturity"):
            record = current_triage_record()
            record["scoring"]["criteria"][criterion_id] = triage_criterion(
                2,
                "user_input_only",
                "2점 기준을 충족합니다.",
            )
            record["hard_filter"]["status"] = "REJECT"
            record["triage"]["status"] = "REJECT"
            record["final_insight"]["recommendation"] = "Monitor / gather more evidence"
            with self.subTest(criterion_id=criterion_id), self.assertRaises(HTTPException):
                main.validate_records_for_save([record])

    def test_cases_9_and_10_moa_two_or_three_with_public_validation(self) -> None:
        source = [{"source_url": "https://example.org/mechanism", "verified": True}]
        for score, summary in (
            (2, "동일 target/class의 독립 functional validation을 확인하여 MoA 2점입니다."),
            (3, "해당 asset의 target engagement와 mechanism-linked PD를 확인하여 MoA 3점입니다."),
        ):
            record = current_triage_record()
            record["scoring"]["criteria"]["moa_validity"] = triage_criterion(
                score,
                "public_source",
                summary,
                source,
            )
            record["hard_filter"]["status"] = "REJECT"
            record["triage"]["status"] = "REJECT"
            record["final_insight"]["recommendation"] = "Monitor / gather more evidence"
            with self.subTest(score=score):
                main.validate_records_for_save([record])

    def test_case_11_data_three_can_be_supported_by_one_source_with_two_domains(self) -> None:
        record = current_triage_record()
        record["scoring"]["criteria"]["data_maturity"] = triage_criterion(
            3,
            "public_source",
            "한 공개자료에서 in vivo efficacy와 PK/PD라는 두 complementary domain을 확인하여 Data 3점입니다.",
            [{"source_url": "https://example.org/in-vivo-and-pkpd", "verified": True}],
        )
        record["hard_filter"]["status"] = "SELECT"
        record["triage"]["status"] = "SELECT"
        record["final_insight"]["recommendation"] = "Run Full Scout"
        main.validate_records_for_save([record])

    def test_current_contract_normalizes_legacy_status(self) -> None:
        record = current_triage_record()
        record["hard_filter"]["status"] = "N/A"
        record["triage"]["status"] = "N/A"
        main.validate_records_for_save([record])
        self.assertEqual(record["hard_filter"]["status"], "REJECT")
        self.assertEqual(record["triage"]["status"], "REJECT")

    def test_current_contract_no_longer_requires_active_asset(self) -> None:
        # v3.5 dropped active_asset: development_stage is now the sole activity
        # signal, so a record that never included active_asset at all must
        # still save and score normally.
        record = current_triage_record()
        record["triage"].pop("active_asset", None)
        main.validate_records_for_save([record])

    def test_unknown_development_stage_does_not_block_select(self) -> None:
        # Unknown development_stage ("activity cannot be established") is no
        # longer a REJECT gate the way active_asset=None used to be — only a
        # confirmed "Discontinued / inactive" stage forces an early stop.
        # SELECT/REJECT/INSUFFICIENT are now determined purely by TR/MoA/Data.
        record = current_triage_record()
        record["structured_table"]["development_stage"] = "Unknown"
        record["scoring"]["criteria"]["data_maturity"] = triage_criterion(
            2,
            "public_source",
            "Data 2 points: one stage-appropriate quantitative evidence domain is confirmed.",
            [{"source_url": "https://example.org/data", "verified": True}],
        )
        record["hard_filter"]["status"] = "SELECT"
        record["triage"]["status"] = "SELECT"
        record["final_insight"]["recommendation"] = "Run Full Scout"
        main.validate_records_for_save([record])
        self.assertEqual(record["hard_filter"]["status"], "SELECT")
        self.assertEqual(record["triage"]["status"], "SELECT")
        self.assertEqual(record["final_insight"]["recommendation"], "Run Full Scout")

    def test_discontinued_development_stage_forces_insufficient(self) -> None:
        # development_stage == "Discontinued / inactive" is now the only early
        # stop for activity — hard_filter.flags keyword text (the old
        # fast_triage_record_has_hard_blocker regex scan) no longer gates
        # Fast Triage status on its own.
        record = current_triage_record()
        record["structured_table"]["development_stage"] = "Discontinued / inactive"
        record["hard_filter"]["status"] = "SELECT"
        record["triage"]["status"] = "SELECT"
        record["final_insight"]["recommendation"] = "Run Full Scout"
        record["hard_filter"]["flags"] = []
        main.validate_records_for_save([record])
        self.assertEqual(record["hard_filter"]["status"], "INSUFFICIENT")
        self.assertEqual(record["triage"]["status"], "INSUFFICIENT")
        self.assertEqual(record["final_insight"]["recommendation"], "Do not run Full Scout")

    def test_hard_filter_flags_text_no_longer_gates_fast_triage_status(self) -> None:
        # Previously a "terminated"/"discontinued" keyword in hard_filter.flags
        # alone (via fast_triage_lifecycle_text_has_hard_blocker) forced
        # INSUFFICIENT even when development_stage said otherwise. That
        # duplicate signal is retired; only development_stage gates now.
        record = current_triage_record()
        record["scoring"]["criteria"]["data_maturity"] = triage_criterion(
            2,
            "public_source",
            "Data 2 points: one stage-appropriate quantitative evidence domain is confirmed.",
            [{"source_url": "https://example.org/data", "verified": True}],
        )
        record["hard_filter"]["status"] = "SELECT"
        record["triage"]["status"] = "SELECT"
        record["final_insight"]["recommendation"] = "Run Full Scout"
        record["hard_filter"]["flags"] = ["program terminated"]
        main.validate_records_for_save([record])
        self.assertEqual(record["hard_filter"]["status"], "SELECT")
        self.assertEqual(record["triage"]["status"], "SELECT")
        self.assertEqual(record["final_insight"]["recommendation"], "Run Full Scout")
        self.assertFalse(hasattr(main, "fast_triage_record_has_hard_blocker"))
        self.assertFalse(hasattr(main, "fast_triage_lifecycle_text_has_hard_blocker"))

    def test_current_status_normalizes_matching_recommendation(self) -> None:
        record = current_triage_record()
        record["final_insight"]["recommendation"] = "Run Full Scout"
        main.validate_records_for_save([record])
        self.assertEqual(record["final_insight"]["recommendation"], "Monitor / gather more evidence")

    def test_total_score_null_contract_and_optional_max_nine(self) -> None:
        record = current_triage_record()
        main.validate_records_for_save([record])

        invalid = current_triage_record()
        invalid["scoring"]["max_score"] = 9
        main.validate_records_for_save([invalid])
        self.assertEqual(invalid["scoring"]["total_score"], 5)
        self.assertEqual(invalid["scoring"]["max_score"], 9)

        aggregate = current_triage_record()
        aggregate["scoring"]["total_score"] = 5
        aggregate["scoring"]["max_score"] = 9
        main.validate_records_for_save([aggregate])


class FullScoutFilterTests(unittest.TestCase):
    def test_current_full_scout_requires_schema_32(self) -> None:
        record = {
            "meta": {
                "schema_version": "3.1",
                "instruction_version": "3.8",
                "rubric_version": "3.8",
                "review_type": "full_scout",
            },
            "hard_filter": {"status": "FAIL"},
            "scoring": {"criteria": {}},
        }
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("schema_version must remain 3.2", str(caught.exception.detail))

    def test_theme_cluster_non_fit_alone_is_not_fail(self) -> None:
        scores = {
            "target_relevance": 3,
            "competitive_landscape": 3,
            "moa_validity": 3,
            "platform_attractiveness": 3,
            "expansion_potential": 2,
            "data_maturity": 3,
            "marketability": 2,
        }
        record = {
            "json_summary": {"theme": "Others", "cluster": "Others"},
            "scoring": {
                "criteria": {
                    key: {
                        "score": value,
                        "main_line_summary": "Confirmed evidence supports this score.",
                        "uncertain_points": [],
                    }
                    for key, value in scores.items()
                }
            },
            "validation": {"uncertain_points": []},
            "final_insight": {"one_line_summary": "Additional diligence recommended."},
        }
        result = main.calculate_latest_full_scout_filter(copy.deepcopy(record))
        self.assertEqual(result["status"], "PASS")
        self.assertNotIn("Theme/Cluster", result["reason"])

    def test_lifecycle_wording_in_notes_is_not_a_hard_blocker(self) -> None:
        for note in ("개발 중단 없음", "The asset is not discontinued."):
            with self.subTest(note=note):
                self.assertFalse(main.full_scout_has_hard_blocker(note))
        self.assertFalse(main.full_scout_has_hard_blocker("The asset was terminated."))

    def test_review_uncertainty_is_limited_to_stage_rights_identity_or_source(self) -> None:
        scores = {
            "target_relevance": 3,
            "competitive_landscape": 2,
            "moa_validity": 3,
            "platform_attractiveness": 2,
            "expansion_potential": 2,
            "data_maturity": 3,
            "marketability": 2,
        }

        def record_with_note(note: str) -> dict[str, object]:
            return {
                "structured_table": {"development_stage": "Preclinical Candidate"},
                "hard_filter": {"status": "PASS", "reason": "Score gate met."},
                "scoring": {
                    "criteria": {
                        key: {
                            "score": value,
                            "main_line_summary": note if key == "marketability" else "Confirmed evidence.",
                            "uncertain_points": [],
                        }
                        for key, value in scores.items()
                    }
                },
                "validation": {"uncertain_points": []},
                "final_insight": {"one_line_summary": "Shortlist."},
            }

        ordinary_uncertainty = main.calculate_latest_full_scout_filter(
            record_with_note("CMC and price assumptions remain uncertain.")
        )
        self.assertEqual(ordinary_uncertainty["status"], "PASS")

        rights_uncertainty = main.calculate_latest_full_scout_filter(
            record_with_note("Ownership remains uncertain.")
        )
        self.assertEqual(rights_uncertainty["status"], "PASS")

        identity_failure = record_with_note("Asset identity is not verified.")
        self.assertEqual(main.calculate_latest_full_scout_filter(identity_failure)["status"], "FAIL")

    def test_full_scout_discontinued_stage_is_the_lifecycle_gate(self) -> None:
        scores = {
            "target_relevance": 3,
            "competitive_landscape": 2,
            "moa_validity": 2,
            "platform_attractiveness": 2,
            "expansion_potential": 2,
            "data_maturity": 2,
            "marketability": 2,
        }

        def passing_record() -> dict[str, object]:
            return {
                "structured_table": {"development_stage": "Preclinical Candidate"},
                "hard_filter": {"status": "PASS", "reason": "Score gate met.", "flags": []},
                "scoring": {
                    "criteria": {
                        key: {"score": value, "main_line_summary": "Confirmed evidence.", "uncertain_points": []}
                        for key, value in scores.items()
                    }
                },
                "validation": {"uncertain_points": []},
                "final_insight": {"one_line_summary": "Shortlist."},
            }

        stage_blocked = passing_record()
        stage_blocked["structured_table"]["development_stage"] = "Discontinued / inactive"
        self.assertEqual(main.calculate_latest_full_scout_filter(stage_blocked)["status"], "FAIL")

        flag_blocked = passing_record()
        flag_blocked["hard_filter"]["flags"] = ["terminated"]
        self.assertEqual(main.calculate_latest_full_scout_filter(flag_blocked)["status"], "REVIEW")


class StaticInstructionAndSchemaTests(unittest.TestCase):
    def test_fast_triage_prompt_uses_one_combined_copy_block(self) -> None:
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        start = app_js.index("function buildTriageInstructionPromptLegacy()")
        end = app_js.index("function buildTriageInstructionPrompt()", start)
        prompt = app_js[start:end]

        self.assertIn("exactly one copyable fenced code block", prompt)
        self.assertIn("--- JSON DATA ---", prompt)
        self.assertIn("Do not create inner Markdown or JSON fences", prompt)
        self.assertIn("copy this one combined block and paste it once", prompt)
        self.assertNotIn("exactly two fenced code blocks", prompt)
        self.assertNotIn("Output only the two fenced code blocks", prompt)

        parser_start = app_js.index("function splitCombinedGptResponse")
        parser_end = app_js.index("function fastTriageMarkdownStatusRows", parser_start)
        parser = app_js[parser_start:parser_end]
        self.assertIn("separatorPattern", parser)
        self.assertIn("splitAtRecoverableJsonSeparator(text)", parser)
        self.assertIn("유효한 최종 JSON 경계를 사용했습니다", parser)
        self.assertIn("최상위 JSON 뒤의 설명 문구를 저장 대상에서 제외했습니다", parser)
        self.assertIn("inputFormat: 'separator'", parser)
        self.assertIn("구분선은 전체 응답에 정확히 한 번", parser)
        self.assertNotIn("balancedJsonCandidates", app_js)
        self.assertIn("최상위 JSON 문법 오류", app_js)
        self.assertIn("The JSON suffix must start with [ and end with ]", prompt)
        self.assertIn("parse-check the complete JSON suffix", prompt)
        self.assertIn("score/count fields as JSON numbers", prompt)
        self.assertIn("Escape any double quote, backslash, or line break", prompt)
        self.assertIn('"ingestion_format": "compact_v2"', app_js)
        self.assertNotIn('"ingestion_format": "compact_v1"', app_js)
        self.assertIn("COMPACT_TRIAGE_JSON_TEMPLATE", app_js)
        self.assertIn("replaceInstructionJsonTemplate(prompt, COMPACT_TRIAGE_JSON_TEMPLATE", app_js)
        self.assertIn(
            "| # | Asset | Company | Target/MoA | Modality | Main indication | Pipeline Stage | Location |",
            prompt,
        )
        self.assertIn("SHARED_CANONICAL_INDICATION_RULE", app_js)
        self.assertIn("Lead disclosed indication: inflammatory bowel disease; expansion potential for MS", app_js)
        self.assertIn("['country', 'indication'].includes(kind)", app_js)
        self.assertIn("Compact v2에서는 main_indication을 생략하거나 비워둘 수 없습니다", app_js)
        self.assertIn("Protein Homeostasis", app_js)

    def test_full_scout_prompt_uses_one_combined_copy_block(self) -> None:
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        start = app_js.index("function buildGptInstructionPromptLegacy()")
        end = app_js.index("function buildGptInstructionPrompt()", start)
        prompt = app_js[start:end]

        self.assertIn("exactly one copyable fenced code block", prompt)
        self.assertIn("exactly one \\`\\`\\`text fenced code block", prompt)
        self.assertIn("--- JSON DATA ---", prompt)
        self.assertIn("copy this one combined block and paste it once", prompt)
        self.assertIn('single "GPT 지침 2 전체 응답" input', prompt)
        self.assertIn("Do not create inner Markdown or JSON fences", prompt)
        self.assertIn("The JSON suffix must start with { and end with }", prompt)
        self.assertIn("parse-check the complete JSON suffix", prompt)
        self.assertIn("Cross-check Marketability in Markdown before output", prompt)
        self.assertIn("never a quoted numeric string", prompt)
        self.assertIn("source_report.raw_markdown as an empty string", prompt)
        self.assertIn("COMPACT_FULL_SCOUT_JSON_TEMPLATE", app_js)
        self.assertIn("replaceInstructionJsonTemplate(prompt, COMPACT_FULL_SCOUT_JSON_TEMPLATE", app_js)
        compact_start = app_js.index("const COMPACT_FULL_SCOUT_JSON_TEMPLATE")
        compact_end = app_js.index("function replaceInstructionJsonTemplate", compact_start)
        compact = app_js[compact_start:compact_end]
        self.assertIn('"ingestion_format": "compact_v2"', compact)
        self.assertIn('"hard_blocker": false', compact)
        self.assertIn('"source_ids": []', compact)
        self.assertIn('"source_registry": []', compact)
        self.assertNotIn('"evidence_sources": []', compact)
        self.assertIn('"competitor_table": []', compact)
        self.assertIn('"similar_pipelines": []', compact)
        self.assertNotIn('"source_report": {', compact)
        self.assertNotIn('"raw_markdown":', compact)
        self.assertNotIn('"obsidian":', compact)
        self.assertIn('"evidence_type_reason":', compact)
        self.assertIn('"investigation_note":', compact)
        self.assertNotIn("exactly two fenced code blocks", prompt)
        self.assertNotIn("second copyable box", prompt)
        self.assertNotIn("one markdown fenced code block followed by one JSON fenced code block", prompt)

    def test_fast_triage_and_full_scout_share_the_cluster_taxonomy(self) -> None:
        # json_summary.theme/cluster are non-scoring dashboard-grouping metadata (they
        # feed no TR/MoA/Data score, hard_filter, or status derivation), but both GPT
        # instructions must still tell GPT the same canonical Theme/Cluster values so
        # the dashboard's fixed taxonomy (main.py's THEMES/CLUSTERS) is actually
        # populated instead of drifting to free text. Adding "Protein Homeostasis"
        # once consolidated the Theme rule into SHARED_CANONICAL_THEME_RULE but left
        # Fast Triage without the "Allowed clusters:" list Full Scout already had;
        # this guards against that regression recurring.
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")

        triage_start = app_js.index("function buildTriageInstructionPromptLegacy()")
        triage_end = app_js.index("function buildTriageInstructionPrompt()", triage_start)
        triage_prompt = app_js[triage_start:triage_end]

        full_start = app_js.index("function buildGptInstructionPromptLegacy()")
        full_end = app_js.index("function buildGptInstructionPrompt()", full_start)
        full_prompt = app_js[full_start:full_end]

        for prompt in (triage_prompt, full_prompt):
            self.assertIn("${SHARED_CANONICAL_THEME_RULE}", prompt)
            self.assertIn("${SHARED_CANONICAL_CLUSTER_RULE}", prompt)

        self.assertIn(
            "When Theme is Others, cluster must also be Others. When Theme is Unknown, cluster must also be Unknown.",
            app_js,
        )
        cluster_rule_start = app_js.index("const SHARED_CANONICAL_CLUSTER_RULE")
        cluster_rule_end = app_js.index("`;", cluster_rule_start)
        cluster_rule = app_js[cluster_rule_start:cluster_rule_end]
        self.assertIn("Allowed Theme values:", cluster_rule)
        self.assertIn("Allowed clusters:", cluster_rule)
        self.assertIn("Ion Channel, Inhibitory Tone 강화, Synaptic Transmission, Chloride Homeostasis, Network Modulation", cluster_rule)
        self.assertIn("CNS 손상 면역반응, 교세포 향상성, Cytokine 신경조절, 손상/질환 면역조절, 말초 면역기관 연결", cluster_rule)

    def test_shared_prompt_and_versioned_rubric_files(self) -> None:
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        shared_sentence = (
            "Use only asset-specific facts explicitly provided by the user or verified "
            "from credible public sources."
        )
        self.assertTrue(
            shared_sentence in app_js,
            "The exact shared Evidence Discipline block is missing from src/app.js.",
        )
        self.assertIn("Fast Triage v3.7", app_js)
        self.assertIn("Full Scout v3.8", app_js)
        for stale_or_forbidden in (
            "Fast Triage v3.3",
            "Full Scout v3.4",
            "company/target/indication cannot be credibly linked",
            "decision-ready data package",
            '"evidence_type": ""',
        ):
            self.assertNotIn(stale_or_forbidden, app_js)
        self.assertIn('active_asset', app_js)
        self.assertIn('Verify asset identity', app_js)
        self.assertIn('fastTriageMarkdownStatusRows', app_js)
        self.assertIn('legacy N/A 대신 INSUFFICIENT', app_js)
        self.assertIn('always evaluate in descending order: 3, then 2, then 1, then 0', app_js)
        self.assertIn('MoA evidence definitions:', app_js)
        compact_start = app_js.index("const COMPACT_FULL_SCOUT_JSON_TEMPLATE")
        compact_end = app_js.index("function replaceInstructionJsonTemplate", compact_start)
        compact = app_js[compact_start:compact_end]
        for research_only_key in (
            '"founded_year": null',
            '"differentiation_points": []',
            '"analysis_summary": ""',
            '"evidence_sources": []',
        ):
            self.assertNotIn(research_only_key, compact)
        self.assertIn('"headquarters": ""', compact)
        self.assertIn('"company_stage": ""', compact)
        self.assertIn('"platform_summary": ""', compact)
        self.assertIn('"source_registry": []', compact)
        self.assertIn('"source_ids": []', compact)

        triage_rules = (ROOT / "config" / "scoring_criteria" / "v3_5_triage.md").read_text(
            encoding="utf-8"
        )
        full_rules = (ROOT / "config" / "scoring_criteria" / "v3_8_full.md").read_text(
            encoding="utf-8"
        )
        for text in (triage_rules, full_rules):
            self.assertIn(shared_sentence, text)
            self.assertNotIn("decision-ready data package", text)
            self.assertIn("동일 underlying experiment", text)
        self.assertIn("INSUFFICIENT", triage_rules)
        self.assertIn("하나의 공개 source", triage_rules)
        self.assertIn("no SKBP Theme / Cluster fit", full_rules)
        self.assertIn("complete, self-contained decision reference", full_rules)
        self.assertIn("retains the v3.7 Evidence Discipline, Evidence Type, canonical taxonomy", full_rules)

        triage_detail_js = (ROOT / "src" / "triage-detail.js").read_text(encoding="utf-8")
        for label in (
            "사용자 입력정보 기반 · 공개자료 미확인",
            "공개자료 ${verifiedSourceCount}건 확인",
            "사용자 입력정보 + 공개자료 ${verifiedSourceCount}건 확인",
            "확인된 판단근거 없음",
        ):
            self.assertIn(label, triage_detail_js)
        self.assertNotIn("0 sources", triage_detail_js)

    def test_full_parameter_guide_keeps_the_scoring_tables(self) -> None:
        for filename in ("index.html", "detail.html"):
            markup = (ROOT / filename).read_text(encoding="utf-8")
            with self.subTest(filename=filename):
                self.assertIn("Full Scout", markup)
                self.assertIn("program progression", markup)
                self.assertIn("Marketability", markup)

    def test_json_schema_contains_new_controlled_vocabularies(self) -> None:
        schema = json.loads((ROOT / "json" / "drug-valuation.schema.json").read_text(encoding="utf-8"))
        schema_text = json.dumps(schema, ensure_ascii=False)
        for value in (
            "INSUFFICIENT",
            "Preclinical Candidate",
            "Preclinical unspecified",
            "IND filed/cleared",
        ):
            self.assertIn(value, schema_text)

        enum_values: list[object] = []

        def collect_enum_values(value: object) -> None:
            if isinstance(value, dict):
                if isinstance(value.get("enum"), list):
                    enum_values.extend(value["enum"])
                for child in value.values():
                    collect_enum_values(child)
            elif isinstance(value, list):
                for child in value:
                    collect_enum_values(child)

        collect_enum_values(schema)
        for markdown_only_value in (
            "user_input_only",
            "public_source",
            "user_input_and_public_source",
            "no_supporting_basis",
        ):
            self.assertNotIn(markdown_only_value, enum_values)

        definitions = schema.get("$defs", {})
        refs: list[str] = []

        def collect_refs(value: object) -> None:
            if isinstance(value, dict):
                ref = value.get("$ref")
                if isinstance(ref, str) and ref.startswith("#/$defs/"):
                    refs.append(ref.removeprefix("#/$defs/"))
                for child in value.values():
                    collect_refs(child)
            elif isinstance(value, list):
                for child in value:
                    collect_refs(child)

        collect_refs(schema)
        self.assertEqual(sorted(set(refs) - set(definitions)), [])
        self.assertEqual(
            schema["properties"]["meta"]["properties"]["storage_profile"]["const"],
            "dashboard_hybrid_v1",
        )
        score_criterion = schema["$defs"]["scoreCriterion"]
        self.assertEqual(
            score_criterion["required"],
            [
                "score",
                "evidence_type",
                "evidence_type_reason",
                "evidence_basis",
                "main_line_summary",
                "why_not_higher",
                "investigation_note",
                "uncertain_points",
                "source_ids",
            ],
        )
        self.assertFalse(score_criterion["additionalProperties"])
        full_branch = schema["allOf"][0]["else"]
        self.assertEqual(
            full_branch["properties"]["scoring"]["properties"]["max_score"]["const"],
            21,
        )

    def test_stage_synonym_dictionary_uses_only_current_canonical_values(self) -> None:
        dictionary = json.loads(
            (ROOT / "config" / "category-synonyms.json").read_text(encoding="utf-8")
        )
        stage_values = [entry["canonical"] for entry in dictionary["stage"]]
        self.assertNotIn("Lead Selection", stage_values)
        self.assertNotIn("IND", stage_values)
        phase_two = next(entry for entry in dictionary["stage"] if entry["canonical"] == "Phase 2")
        phase_two_terms = " ".join(phase_two.get("synonyms", []) + phase_two.get("patterns", [])).lower()
        self.assertNotIn("poc", phase_two_terms)
        self.assertNotIn("proof-of-concept", phase_two_terms)
        self.assertNotIn("proof[- ]?of[- ]?concept", phase_two_terms)
        for required in (
            "Hit Discovery",
            "Lead Optimization",
            "Preclinical Candidate",
            "IND-enabling",
            "Preclinical unspecified",
            "IND filed/cleared",
            "Unknown",
        ):
            self.assertIn(required, stage_values)


if __name__ == "__main__":
    unittest.main()
