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
    return {
        "meta": {
            "schema_version": "3.2",
            "instruction_version": "3.2",
            "rubric_version": "3.2",
            "review_type": "fast_triage",
            "generated_at": "2026-08-01",
            "output_filename_base": "Acceptance_Test_Asset_fast_triage_20260801",
        },
        "input": {
            "company_input": "Acceptance Test Biotech",
            "asset_input": "Acceptance Test Asset",
            "notes": "Indication = Parkinson's disease; Target/MoA = Unknown",
        },
        "source_report": {
            "source_format": "fast_triage_markdown",
            "parser_status": "fast_triage",
        },
        "structured_table": {
            "company": "Acceptance Test Biotech",
            "asset_name": "Acceptance Test Asset",
            "target": "Unknown",
            "moa": "Unknown",
            "main_indication": "Parkinson's disease",
            "development_stage": "Unknown",
        },
        "hard_filter": {"status": "REJECT", "reason": "SELECT gate 미충족", "flags": []},
        "triage": {
            "instruction_version": "3.2",
            "status": "REJECT",
            "identity_verified": True,
            "active_asset": True,
        },
        "scoring": {
            "total_score": None,
            "max_score": None,
            "criteria": {
                "target_relevance": triage_criterion(
                    2,
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
            "recommendation": "Do not run Full Scout",
            "most_important_diligence_question": "Can the missing public evidence be verified?",
        },
    }


class VersionAndPolicyTests(unittest.TestCase):
    def test_current_versions(self) -> None:
        self.assertEqual(main.TRIAGE_CRITERIA_VERSION, "3.2")
        self.assertEqual(main.TRIAGE_SCHEMA_VERSION, "3.2")
        self.assertEqual(main.SCORING_CRITERIA_VERSION, "3.3")
        self.assertEqual(main.FULL_SCOUT_SCHEMA_VERSION, "3.2")
        self.assertTrue(main.SCORING_CRITERIA_FULL_MD.name.startswith("v3_3_"))
        self.assertTrue(main.SCORING_CRITERIA_DISPLAY_MD.name.startswith("v3_3_"))

    def test_fast_triage_select_formula_and_identity_gate(self) -> None:
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=2,
                moa_validity=2,
                data_maturity=0,
                active_asset=True,
            ),
            "SELECT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=2,
                moa_validity=0,
                data_maturity=2,
                active_asset=True,
            ),
            "SELECT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=2,
                moa_validity=0,
                data_maturity=0,
                active_asset=True,
            ),
            "REJECT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=False,
                target_relevance=3,
                moa_validity=3,
                data_maturity=3,
                active_asset=True,
            ),
            "UNVERIFIED",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=3,
                moa_validity=3,
                data_maturity=3,
                active_asset=False,
            ),
            "REJECT",
        )
        self.assertEqual(
            main.calculate_fast_triage_status(
                identity_verified=True,
                target_relevance=3,
                moa_validity=3,
                data_maturity=3,
                active_asset=None,
            ),
            "REJECT",
        )

    def test_target_relevance_acceptance_cases_1_to_7(self) -> None:
        self.assertEqual(main.calculate_target_relevance_score("Alzheimer's disease"), 2)
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
            1,
        )
        self.assertEqual(
            main.match_skbp_interest_indication("Diabetic peripheral neuropathic pain"),
            "Neuropathic pain",
        )
        self.assertEqual(
            main.calculate_target_relevance_score("Diabetic peripheral neuropathic pain"),
            2,
        )
        self.assertEqual(main.calculate_target_relevance_score("Pain, subtype unspecified"), 1)
        self.assertEqual(main.calculate_target_relevance_score("Parkinson's disease"), 2)

    def test_user_input_only_hallucinated_cell_claim_is_detected(self) -> None:
        record = current_triage_record()
        criterion = record["scoring"]["criteria"]["target_relevance"]
        criterion["main_line_summary"] = "TR is 2 points. This asset is microglia-directed in Parkinson's disease."
        self.assertIn(
            "microglia",
            main.unsupported_user_input_only_summary_claims(record, "target_relevance"),
        )
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("not found in user input", str(caught.exception.detail))

    def test_user_input_only_hallucinated_target_and_data_claims_are_detected(self) -> None:
        cases = (
            (
                "target_relevance",
                "Target은 LRRK2이며 Parkinson's disease에 해당하여 TR 2점입니다.",
                "target/MoA=LRRK2",
            ),
            (
                "moa_validity",
                "해당 asset은 LRRK2 kinase를 억제한다는 설명만 있어 MoA 1점입니다.",
                "target/MoA=LRRK2",
            ),
            (
                "data_maturity",
                "해당 asset에서 in vivo efficacy 80% 개선이 확인됐으나 단편적이어서 Data 1점입니다.",
                "data=80%",
            ),
        )
        for criterion_id, summary, expected_claim in cases:
            record = current_triage_record()
            criterion = record["scoring"]["criteria"][criterion_id]
            criterion["evidence_basis"] = "user_input_only"
            criterion["score"] = 1 if criterion_id != "target_relevance" else 2
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
            "Parkinson's disease is an SKBP interest indication, so TR is 2 points. "
            "Direct target/MoA biology fit was not used for this preliminary score."
        )
        self.assertEqual(
            main.unsupported_user_input_only_summary_claims(record, "target_relevance"),
            [],
        )
        criterion["main_line_summary"] = (
            "Parkinson's disease is in scope, so TR is 2 points. "
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

    def test_fast_hard_filter_and_triage_status_must_match(self) -> None:
        record = current_triage_record()
        record["hard_filter"]["status"] = "SELECT"
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("hard_filter.status and record[0].triage.status must match", str(caught.exception.detail))

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


class EvidenceContractTests(unittest.TestCase):
    def test_case_7_user_input_only_record_is_valid(self) -> None:
        record = current_triage_record()
        main.validate_records_for_save([record])
        criterion = record["scoring"]["criteria"]["target_relevance"]
        self.assertEqual(criterion["score"], 2)
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
            record["hard_filter"]["status"] = "SELECT"
            record["triage"]["status"] = "SELECT"
            record["final_insight"]["recommendation"] = "Run Full Scout"
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
            record["hard_filter"]["status"] = "SELECT"
            record["triage"]["status"] = "SELECT"
            record["final_insight"]["recommendation"] = "Run Full Scout"
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

    def test_current_contract_rejects_legacy_na_status(self) -> None:
        record = current_triage_record()
        record["hard_filter"]["status"] = "N/A"
        record["triage"]["status"] = "N/A"
        with self.assertRaises(HTTPException):
            main.validate_records_for_save([record])

    def test_current_contract_requires_explicit_active_asset(self) -> None:
        record = current_triage_record()
        del record["triage"]["active_asset"]
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("active_asset", str(caught.exception.detail))

    def test_unknown_activity_is_explicit_null_and_cannot_select(self) -> None:
        record = current_triage_record()
        record["triage"]["active_asset"] = None
        main.validate_records_for_save([record])

        record["hard_filter"]["status"] = "SELECT"
        record["triage"]["status"] = "SELECT"
        record["final_insight"]["recommendation"] = "Run Full Scout"
        with self.assertRaises(HTTPException):
            main.validate_records_for_save([record])

    def test_lifecycle_flag_matching_is_phrase_aware_and_negation_safe(self) -> None:
        self.assertTrue(main.fast_triage_lifecycle_text_has_hard_blocker(["program terminated"]))
        self.assertTrue(main.fast_triage_lifecycle_text_has_hard_blocker(["development clearly_failed"]))
        self.assertFalse(main.fast_triage_lifecycle_text_has_hard_blocker(["not discontinued"]))
        self.assertFalse(main.fast_triage_lifecycle_text_has_hard_blocker(["개발 중단 없음"]))

        record = current_triage_record()
        record["scoring"]["criteria"]["moa_validity"] = triage_criterion(
            2,
            "public_source",
            "동일 target/class의 독립 functional validation이 확인되어 MoA 2점입니다.",
            [{"source_url": "https://example.org/mechanism", "verified": True}],
        )
        record["hard_filter"]["status"] = "SELECT"
        record["triage"]["status"] = "SELECT"
        record["final_insight"]["recommendation"] = "Run Full Scout"
        record["hard_filter"]["flags"] = ["program terminated"]
        self.assertTrue(main.fast_triage_record_has_hard_blocker(record))
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("status must be REJECT", str(caught.exception.detail))

    def test_current_status_requires_matching_recommendation(self) -> None:
        record = current_triage_record()
        record["final_insight"]["recommendation"] = "Run Full Scout"
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([record])
        self.assertIn("recommendation", str(caught.exception.detail))

    def test_total_score_null_contract_and_optional_max_nine(self) -> None:
        record = current_triage_record()
        main.validate_records_for_save([record])

        invalid = current_triage_record()
        invalid["scoring"]["max_score"] = 9
        with self.assertRaises(HTTPException):
            main.validate_records_for_save([invalid])

        aggregate = current_triage_record()
        aggregate["scoring"]["total_score"] = 2
        aggregate["scoring"]["max_score"] = 9
        main.validate_records_for_save([aggregate])


class FullScoutFilterTests(unittest.TestCase):
    def test_current_full_scout_requires_schema_32(self) -> None:
        record = {
            "meta": {
                "schema_version": "3.1",
                "instruction_version": "3.3",
                "rubric_version": "3.3",
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
            "target_relevance": 2,
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
        self.assertEqual(result["status"], "REVIEW")
        self.assertNotIn("Theme/Cluster", result["reason"])

    def test_negated_inactive_wording_is_not_a_hard_blocker(self) -> None:
        for note in ("개발 중단 없음", "The asset is not discontinued."):
            with self.subTest(note=note):
                self.assertFalse(main.full_scout_has_hard_blocker(note))
        for blocker in (
            "discontinued",
            "terminated",
            "withdrawn",
            "suspended",
            "dormant",
            "inactive",
            "clearly failed",
        ):
            with self.subTest(blocker=blocker):
                self.assertTrue(main.full_scout_has_hard_blocker(f"The asset was {blocker}."))

    def test_review_uncertainty_is_limited_to_stage_rights_identity_or_source(self) -> None:
        scores = {
            "target_relevance": 3,
            "competitive_landscape": 2,
            "moa_validity": 2,
            "platform_attractiveness": 2,
            "expansion_potential": 2,
            "data_maturity": 2,
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
        self.assertEqual(rights_uncertainty["status"], "REVIEW")

        identity_failure = record_with_note("Asset identity is not verified.")
        self.assertEqual(main.calculate_latest_full_scout_filter(identity_failure)["status"], "FAIL")

    def test_full_scout_discontinued_stage_and_flags_are_hard_blockers(self) -> None:
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
        self.assertEqual(main.calculate_latest_full_scout_filter(flag_blocked)["status"], "FAIL")


class StaticInstructionAndSchemaTests(unittest.TestCase):
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
        self.assertIn("Fast Triage v3.2", app_js)
        self.assertIn("Full Scout v3.3", app_js)
        for stale_or_forbidden in (
            "Fast Triage v3.1",
            "Full Scout v3.2",
            "company/target/indication cannot be credibly linked",
            "decision-ready data package",
            '"evidence_type": ""',
        ):
            self.assertNotIn(stale_or_forbidden, app_js)
        self.assertIn('active_asset', app_js)
        self.assertIn('Verify asset identity', app_js)
        self.assertIn('fastTriageMarkdownStatusRows', app_js)
        self.assertIn('legacy N/A 대신 UNVERIFIED', app_js)
        self.assertIn('always evaluate in descending order: 3, then 2, then 1, then 0', app_js)
        self.assertIn('MoA evidence definitions:', app_js)
        self.assertGreaterEqual(app_js.count('"founded_year": null'), 2)
        self.assertGreaterEqual(app_js.count('"differentiation_points": []'), 2)
        self.assertGreaterEqual(app_js.count('"analysis_summary": ""'), 2)

        triage_rules = (ROOT / "config" / "scoring_criteria" / "v3_2_triage.md").read_text(
            encoding="utf-8"
        )
        full_rules = (ROOT / "config" / "scoring_criteria" / "v3_3_full.md").read_text(
            encoding="utf-8"
        )
        for text in (triage_rules, full_rules):
            self.assertIn(shared_sentence, text)
            self.assertNotIn("decision-ready data package", text)
            self.assertIn("동일 underlying experiment", text)
        self.assertIn("UNVERIFIED", triage_rules)
        self.assertIn("하나의 공개 source", triage_rules)
        self.assertIn("Theme/Cluster direct fit이 없다는 이유만으로 자동 FAIL 처리하지 않는다", full_rules)

        triage_detail_js = (ROOT / "src" / "triage-detail.js").read_text(encoding="utf-8")
        for label in (
            "사용자 입력정보 기반 · 공개자료 미확인",
            "공개자료 ${verifiedSourceCount}건 확인",
            "사용자 입력정보 + 공개자료 ${verifiedSourceCount}건 확인",
            "확인된 판단근거 없음",
        ):
            self.assertIn(label, triage_detail_js)
        self.assertNotIn("0 sources", triage_detail_js)

    def test_full_parameter_guide_shows_moa_and_data_operating_details(self) -> None:
        for filename in ("index.html", "detail.html"):
            markup = (ROOT / filename).read_text(encoding="utf-8")
            with self.subTest(filename=filename):
                self.assertIn("Same target/class", markup)
                self.assertIn("Asset-specific", markup)
                self.assertIn("중복 계산 방지", markup)
                self.assertIn("program progression", markup)
                self.assertIn("Human data", markup)

    def test_json_schema_contains_new_controlled_vocabularies(self) -> None:
        schema = json.loads((ROOT / "json" / "drug-valuation.schema.json").read_text(encoding="utf-8"))
        schema_text = json.dumps(schema, ensure_ascii=False)
        for value in (
            "UNVERIFIED",
            "user_input_only",
            "public_source",
            "user_input_and_public_source",
            "no_supporting_basis",
            "Preclinical Candidate",
            "Preclinical unspecified",
            "IND filed/cleared",
        ):
            self.assertIn(value, schema_text)

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
        full_v33_branch = schema["allOf"][2]["then"]["properties"]["meta"]
        self.assertEqual(full_v33_branch["properties"]["schema_version"]["const"], "3.2")
        self.assertIn("schema_version", full_v33_branch["required"])

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
