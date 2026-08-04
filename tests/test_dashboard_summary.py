from __future__ import annotations

import copy
import unittest
from datetime import date
from unittest.mock import patch

import main


def criterion(score: int) -> dict[str, object]:
    return {"score": score}


def fast_record(
    company: str,
    asset: str,
    *,
    status: str = "SELECT",
    generated_at: str = "2026-08-01",
    tr: int = 2,
    moa: int = 2,
    data: int = 2,
    indication: str = "Parkinson's disease",
    modality: str = "Small molecule",
    record_id: str | None = None,
    overrides: dict[str, object] | None = None,
) -> dict[str, object]:
    meta: dict[str, object] = {
        "review_type": "fast_triage",
        "generated_at": generated_at,
        "output_filename_base": record_id or f"{company}_{asset}_{generated_at}_fast",
    }
    if overrides is not None:
        meta["human_review"] = {"overrides": overrides}
    return {
        "meta": meta,
        "structured_table": {
            "company": company,
            "asset_name": asset,
            "company_country": "Republic of Korea",
            "main_indication": indication,
            "indication": indication,
            "development_stage": "Preclinical unspecified",
            "modality_platform": modality,
        },
        "triage": {"status": status},
        "hard_filter": {"status": status},
        "scoring": {
            "total_score": None,
            "criteria": {
                "target_relevance": criterion(tr),
                "moa_validity": criterion(moa),
                "data_maturity": criterion(data),
            },
        },
    }


def full_record(
    company: str,
    asset: str,
    *,
    status: str = "REVIEW",
    generated_at: str = "2026-08-01",
    total: int = 12,
    tr: int = 2,
    data: int = 2,
    indication: str = "Alzheimer's disease",
    modality: str = "Small molecule",
    record_id: str | None = None,
    focus: dict[str, object] | None = None,
    overrides: dict[str, object] | None = None,
) -> dict[str, object]:
    meta: dict[str, object] = {
        "review_type": "full_scout",
        "generated_at": generated_at,
        "output_filename_base": record_id or f"{company}_{asset}_{generated_at}_full",
    }
    if focus is not None:
        meta["focus_management"] = focus
    if overrides is not None:
        meta["human_review"] = {"overrides": overrides}
    return {
        "meta": meta,
        "structured_table": {
            "company": company,
            "asset_name": asset,
            "company_country": "United States",
            "main_indication": indication,
            "indication": indication,
            "development_stage": "IND-enabling",
            "modality_platform": modality,
        },
        "hard_filter": {"status": status},
        "scoring": {
            "total_score": total,
            "max_score": 21,
            "criteria": {
                "target_relevance": criterion(tr),
                "competitive_landscape": criterion(1),
                "moa_validity": criterion(2),
                "platform_attractiveness": criterion(2),
                "expansion_potential": criterion(1),
                "data_maturity": criterion(data),
                "marketability": criterion(1),
            },
        },
    }


def distribution_counts(rows: list[dict[str, object]]) -> dict[str, int]:
    return {str(row["key"]): int(row["count"]) for row in rows}


class DashboardSummaryTests(unittest.TestCase):
    def test_unique_asset_identity_and_awaiting_full_scout(self) -> None:
        records = [
            fast_record(
                "Alpha Therapeutics",
                "Alpha / AX-1",
                status="SELECT",
                generated_at="2026-01-01",
                data=3,
                record_id="alpha_old",
            ),
            fast_record(
                "Alpha",
                "AX-1",
                status="REJECT",
                generated_at="2026-02-01",
                record_id="alpha_new",
            ),
            fast_record("Actio", "ABS-1230", record_id="abs_fast"),
            full_record("Actio Biosciences", "ABS-1230 / ABS1230", status="PASS", record_id="abs_full"),
            fast_record("Wait Bio", "WAIT-2", data=3, moa=2, record_id="wait_fast"),
            fast_record("Mystery Bio", "Mystery program", status="N/A", record_id="mystery_fast"),
        ]

        summary = main.build_dashboard_summary(records, as_of_date=date(2026, 8, 1))
        fast = summary["tabs"]["fast_triage"]

        self.assertEqual(
            fast["kpis"],
            {
                "assets": 4,
                "select": 2,
                "reject": 1,
                "unverified": 1,
                "average_total_score": 6.2,
                "max_score": 9,
            },
        )
        self.assertEqual(distribution_counts(fast["status_distribution"])["UNVERIFIED"], 1)
        self.assertEqual(
            distribution_counts(fast["indication_distribution"])["Parkinson's disease"],
            4,
        )
        self.assertEqual([item["asset"] for item in fast["awaiting_full_scout"]], ["WAIT-2"])
        self.assertEqual(
            summary["record_asset_identities"]["abs_fast"],
            summary["record_asset_identities"]["abs_full"],
        )
        self.assertEqual(
            summary["record_asset_identities"]["alpha_old"],
            summary["record_asset_identities"]["alpha_new"],
        )

    def test_fast_triage_average_uses_effective_three_criterion_scores(self) -> None:
        complete = fast_record("Complete Bio", "FT-1", tr=2, moa=2, data=2)
        overridden = fast_record(
            "Override Bio",
            "FT-2",
            tr=3,
            moa=1,
            data=1,
            overrides={"scores": {"moa_validity": 3}},
        )
        incomplete = fast_record("Incomplete Bio", "FT-3", tr=3, moa=3, data=3)
        incomplete["scoring"]["criteria"]["data_maturity"]["score"] = None

        # Persisted Fast Triage totals are intentionally ignored for this read-only KPI.
        complete["scoring"]["total_score"] = 9
        overridden["scoring"]["total_score"] = None
        records = [complete, overridden, incomplete]
        before = copy.deepcopy(records)

        summary = main.build_dashboard_summary(
            records,
            as_of_date=date(2026, 8, 1),
        )
        kpis = summary["tabs"]["fast_triage"]["kpis"]

        self.assertEqual(kpis["average_total_score"], 6.5)
        self.assertEqual(kpis["max_score"], 9)
        self.assertEqual(records, before)

    def test_fast_triage_average_is_zero_when_no_complete_score_set_exists(self) -> None:
        incomplete = fast_record("Incomplete Bio", "FT-4")
        incomplete["scoring"]["criteria"]["moa_validity"]["score"] = None

        summary = main.build_dashboard_summary([incomplete], as_of_date=date(2026, 8, 1))

        self.assertEqual(summary["tabs"]["fast_triage"]["kpis"]["average_total_score"], 0)
        self.assertEqual(summary["tabs"]["fast_triage"]["kpis"]["max_score"], 9)

    def test_full_scout_kpis_average_overrides_and_priority_order(self) -> None:
        records = [
            full_record(
                "Alpha Bio",
                "A-1",
                status="FAIL",
                total=5,
                generated_at="2026-01-01",
                record_id="alpha_old",
            ),
            full_record(
                "Alpha",
                "A-1 / AlphaOne",
                status="PASS",
                total=10,
                tr=2,
                data=1,
                generated_at="2026-02-01",
                record_id="alpha_new",
                overrides={
                    "filter_status": "REVIEW",
                    "total_score": 20,
                    "scores": {"target_relevance": 3, "data_maturity": 3},
                },
            ),
            full_record("Beta Bio", "B-2", status="PASS", total=18, tr=3, data=1, record_id="beta"),
            full_record("Gamma Bio", "G-3", status="FAIL", total=21, tr=3, data=3, record_id="gamma"),
        ]

        summary = main.build_dashboard_summary(records, as_of_date=date(2026, 8, 1))
        full = summary["tabs"]["full_scout"]

        self.assertEqual(full["kpis"]["assets"], 3)
        self.assertEqual(full["kpis"]["pass"], 1)
        self.assertEqual(full["kpis"]["review"], 1)
        self.assertEqual(full["kpis"]["fail"], 1)
        self.assertEqual(full["kpis"]["average_total_score"], 19.7)
        self.assertEqual(
            [(item["asset"], item["total_score"], item["filter2"]) for item in full["priority_pipelines"]],
            [("A-1 / AlphaOne", 20, "REVIEW"), ("B-2", 18, "PASS")],
        )
        self.assertEqual(full["priority_pipelines"][0]["data_maturity"], 3)
        self.assertEqual(full["priority_pipelines"][0]["target_relevance"], 3)

    def test_priority_pipeline_score_ties_use_latest_completed_record(self) -> None:
        records = [
            full_record("Older Bio", "OLD-1", status="PASS", total=18, generated_at="2026-01-01", record_id="older"),
            full_record("Newer Bio", "NEW-1", status="PASS", total=18, generated_at="2026-07-01", record_id="newer"),
        ]

        full = main.build_dashboard_summary(records, as_of_date=date(2026, 8, 1))["tabs"]["full_scout"]
        self.assertEqual([item["asset"] for item in full["priority_pipelines"]], ["NEW-1", "OLD-1"])

    def test_shortlisting_effective_partnership_kpis_and_action_order(self) -> None:
        records = [
            full_record(
                "Overdue Bio",
                "OD-1",
                record_id="overdue",
                focus={
                    "is_tracked": True,
                    "due_date": "2026-07-31",
                    "partnership_type": "investment",
                    "partnership_auto_suggestion": "value_up",
                    "partnership_classification_source": "manual",
                },
            ),
            full_record(
                "Soon Bio",
                "SOON-1",
                record_id="soon",
                focus={
                    "is_tracked": True,
                    "due_date": "2026-08-20",
                    "partnership_type": "investment",
                    "partnership_auto_suggestion": "value_up",
                    "partnership_classification_source": "auto",
                },
            ),
            full_record(
                "Unknown Bio",
                "UNK-1",
                record_id="unknown",
                focus={
                    "is_tracked": True,
                    "due_date": "2026-12-01",
                    "partnership_type": "unknown",
                    "partnership_auto_suggestion": "unknown",
                    "partnership_classification_source": "auto",
                },
            ),
            full_record(
                "Missing Bio",
                "MISS-1",
                record_id="missing",
                focus={
                    "is_tracked": True,
                    "due_date": "",
                    "partnership_type": "joint_research",
                    "partnership_auto_suggestion": "joint_research",
                    "partnership_classification_source": "auto",
                },
            ),
            full_record(
                "NA Bio",
                "NA-1",
                generated_at="2026-07-01",
                record_id="n_a",
                focus={
                    "is_tracked": True,
                    "due_date": "2026-12-01",
                    "partnership_type": "n_a",
                    "partnership_auto_suggestion": "n_a",
                    "partnership_classification_source": "auto",
                },
            ),
            # A newer Full Scout record does not silently remove an asset that
            # was explicitly shortlisted on an earlier persisted Full record.
            full_record(
                "NA Bio",
                "NA-1 / NAOne",
                generated_at="2026-08-01",
                record_id="n_a_new_untracked",
                focus={"is_tracked": False},
            ),
        ]

        summary = main.build_dashboard_summary(records, as_of_date=date(2026, 8, 1))
        shortlist = summary["tabs"]["shortlisting"]

        self.assertEqual(
            shortlist["kpis"],
            {
                "pipelines": 5,
                "ongoing": 3,
                "investment": 1,
                "value_up": 1,
                "joint_research": 1,
                "unknown": 1,
                "average_total_score": 12.0,
                "max_score": 21,
            },
        )
        self.assertNotIn("n_a", shortlist["kpis"])

        self.assertEqual(
            distribution_counts(shortlist["partnership_distribution"]),
            {"investment": 1, "value_up": 1, "joint_research": 1, "tbd": 2},
        )
        self.assertEqual(
            [item["action_status"] for item in shortlist["action_required"]],
            ["OVERDUE", "WITHIN_30_DAYS", "FILTER3_UNKNOWN", "MISSING_ACTION_DATE"],
        )
        overdue = shortlist["action_required"][0]
        soon = shortlist["action_required"][1]
        self.assertEqual((overdue["partnership_type"], overdue["partnership_source"]), ("investment", "manual"))
        self.assertTrue(overdue["human_override"])
        self.assertEqual((soon["partnership_type"], soon["partnership_source"]), ("value_up", "auto"))

    def test_action_required_equal_priority_uses_latest_update(self) -> None:
        records = [
            full_record(
                "Older Action Bio",
                "OLD-ACT",
                generated_at="2026-01-01",
                record_id="older_action",
                focus={"is_tracked": True, "due_date": "2026-08-10", "partnership_type": "investment"},
            ),
            full_record(
                "Newer Action Bio",
                "NEW-ACT",
                generated_at="2026-07-01",
                record_id="newer_action",
                focus={"is_tracked": True, "due_date": "2026-08-10", "partnership_type": "investment"},
            ),
        ]

        actions = main.build_dashboard_summary(records, as_of_date=date(2026, 8, 1))["tabs"]["shortlisting"]["action_required"]
        self.assertEqual([item["asset"] for item in actions], ["NEW-ACT", "OLD-ACT"])

    def test_shortlisting_charts_use_only_the_shortlisted_pool(self) -> None:
        records = [
            full_record(
                "Tracked AD Bio",
                "TRACK-AD",
                indication="Alzheimer's disease",
                modality="Small molecule",
                focus={
                    "is_tracked": True,
                    "partnership_auto_suggestion": "investment",
                    "partnership_classification_source": "auto",
                },
            ),
            full_record(
                "Tracked PD Bio",
                "TRACK-PD",
                indication="Parkinson's disease",
                modality="Antibody",
                focus={
                    "is_tracked": True,
                    "partnership_auto_suggestion": "unknown",
                    "partnership_classification_source": "auto",
                },
            ),
            full_record(
                "Pool ALS Bio",
                "POOL-ALS",
                indication="Amyotrophic lateral sclerosis",
                modality="Gene Therapy",
                focus={"is_tracked": False},
            ),
            full_record(
                "Pool AD Bio",
                "POOL-AD",
                indication="Alzheimer's disease",
                modality="Peptide",
            ),
            fast_record(
                "Fast Only Bio",
                "FAST-ONLY",
                indication="Epilepsy",
                modality="RNA therapy",
            ),
        ]

        shortlist = main.build_dashboard_summary(records, as_of_date=date(2026, 8, 2))["tabs"]["shortlisting"]

        self.assertEqual(shortlist["kpis"]["pipelines"], 2)
        self.assertEqual(
            shortlist["distribution_population"],
            {"scope": "shortlisted_pool", "assets": 2},
        )
        indication_counts = distribution_counts(shortlist["indication_distribution"])
        self.assertEqual(indication_counts["Alzheimer's disease"], 1)
        self.assertEqual(indication_counts["Parkinson's disease"], 1)
        self.assertEqual(
            indication_counts["Amyotrophic lateral sclerosis / motor neuron disease"],
            0,
        )
        self.assertEqual(
            sum(item["count"] for item in shortlist["modality_distribution"]),
            2,
        )
        self.assertEqual(
            sum(item["count"] for item in shortlist["partnership_distribution"]),
            2,
        )

    def test_modality_distribution_uses_each_tabs_unique_assets_and_top_six_plus_others(self) -> None:
        modalities = [
            "Small Molecule",
            "SM",
            "oral compound",
            "Antibody",
            "bispecific antibody",
            "Cell Therapy",
            "Gene Therapy",
            "Peptide",
            "RNA therapy",
            "Other",
            "Unknown",
            "",
        ]
        records: list[dict[str, object]] = [
            fast_record(
                "Fast Modality Bio",
                "FT-MOD-0",
                generated_at="2025-01-01",
                modality="RNA therapy",
                record_id="fast_modality_old_duplicate",
            )
        ]
        for index, modality in enumerate(modalities):
            records.append(
                fast_record(
                    "Fast Modality Bio",
                    f"FT-MOD-{index}",
                    modality=modality,
                    record_id=f"fast_modality_{index}",
                )
            )
            records.append(
                full_record(
                    "Full Modality Bio",
                    f"FS-MOD-{index}",
                    modality=modality,
                    record_id=f"full_modality_{index}",
                    focus={
                        "is_tracked": True,
                        "partnership_auto_suggestion": "unknown",
                        "partnership_classification_source": "auto",
                    },
                )
            )

        summary = main.build_dashboard_summary(records, as_of_date=date(2026, 8, 2))
        expected = [
            ("Small molecule", 3),
            ("Antibody", 2),
            ("CGT", 2),
            ("Peptide", 1),
            ("RNA therapy", 1),
            ("Others", 3),
        ]
        for tab_name in ("fast_triage", "full_scout", "shortlisting"):
            distribution = summary["tabs"][tab_name]["modality_distribution"]
            self.assertEqual(
                [(item["label"], item["count"]) for item in distribution],
                expected,
                tab_name,
            )

        self.assertEqual(summary["tabs"]["fast_triage"]["kpis"]["assets"], 12)
        self.assertEqual(summary["tabs"]["full_scout"]["kpis"]["assets"], 12)
        self.assertEqual(summary["tabs"]["shortlisting"]["kpis"]["pipelines"], 12)

    def test_endpoint_is_read_only_and_uses_saved_records_only(self) -> None:
        records = [fast_record("Persisted Bio", "PB-1", record_id="persisted")]
        original_records = copy.deepcopy(records)
        with (
            patch.object(main, "load_records", return_value=records) as load_mock,
            patch.object(main, "save_records") as save_mock,
            patch.object(main, "refresh_tracked_oi_classifications") as refresh_mock,
            patch.object(main, "post_openrouter") as openrouter_mock,
        ):
            response = main.get_dashboard_summary()

        load_mock.assert_called_once_with()
        save_mock.assert_not_called()
        refresh_mock.assert_not_called()
        openrouter_mock.assert_not_called()
        self.assertEqual(records, original_records)
        self.assertEqual(response["basis"], "persisted_records")
        self.assertEqual(response["aggregation_unit"], "unique_asset")
        self.assertFalse(response["filters_applied"])
        self.assertEqual(response["tabs"]["fast_triage"]["kpis"]["assets"], 1)
        self.assertEqual(
            response["tabs"]["fast_triage"]["modality_distribution"],
            [
                {"key": "Small molecule", "label": "Small molecule", "count": 1},
                {"key": "others", "label": "Others", "count": 0},
            ],
        )
        self.assertIn("modality_distribution", response["tabs"]["full_scout"])
        self.assertIn("modality_distribution", response["tabs"]["shortlisting"])
        self.assertIn("/api/dashboard-summary", {route.path for route in main.app.routes})


if __name__ == "__main__":
    unittest.main()
