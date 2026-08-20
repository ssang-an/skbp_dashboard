import copy
import unittest

import main


def full_record(record_id: str, company: str = "Xenon Pharmaceuticals", asset: str = "Azetukalner"):
    return {
        "meta": {
            "output_filename_base": record_id,
            "review_type": "full_scout",
            "human_review": {
                "overrides": {
                    "scores": {"target_relevance": 2},
                    "total_score": 12,
                },
                "history": [{"field": "scores.target_relevance", "previous_value": 3, "new_value": 2}],
            },
        },
        "structured_table": {"company": company, "asset_name": asset},
        "json_summary": {"company": company, "asset_name": asset},
        "source_report": {"raw_markdown": "# report"},
        "scoring": {
            "criteria": {
                criterion_id: {"score": 3 if criterion_id == "target_relevance" else 2}
                for criterion_id in main.CRITERION_IDS
            },
            "total_score": 15,
            "max_score": 21,
        },
    }


class DataReuploadTests(unittest.TestCase):
    def test_duplicate_record_key_groups_preserve_all_input_positions(self):
        first = full_record("Neuracle Genetics (now Elisigen)_NG201", company="Neuracle Genetics")
        second = full_record("Neuracle Genetics (now Elisigen)_NG201", company="Neuracle Science")
        distinct = full_record("Helixmith_NM301", company="Helixmith", asset="NM301")

        self.assertEqual(
            main.duplicate_record_key_groups([first, second, distinct]),
            [{
                "record_id": "Neuracle Genetics (now Elisigen)_NG201",
                "indexes": [0, 1],
            }],
        )

    def test_identity_matches_across_dated_record_ids(self):
        old = full_record("Xenon_Azetukalner_20260801")
        new = full_record("Xenon_Azetukalner_20260803", company="Xenon  Pharmaceuticals")

        self.assertEqual(main.pipeline_identity(old), main.pipeline_identity(new))

    def test_code_formatting_and_leading_zeroes_are_asset_aliases(self):
        canonical = main.normalized_pipeline_asset_identity("AR1001")

        self.assertEqual(canonical, main.normalized_pipeline_asset_identity("AR-1001"))
        self.assertEqual(canonical, main.normalized_pipeline_asset_identity("AR01001"))
        self.assertTrue(main.pipeline_asset_identities_match(canonical, main.normalized_pipeline_asset_identity("AR-1001")))

    def test_distinct_numeric_asset_codes_are_not_reupload_matches(self):
        self.assertFalse(main.pipeline_asset_identities_match(
            main.normalized_pipeline_asset_identity("AR1001"),
            main.normalized_pipeline_asset_identity("AR1002"),
        ))
        self.assertFalse(main.pipeline_asset_identities_match(
            main.normalized_pipeline_asset_identity("AS-301"),
            main.normalized_pipeline_asset_identity("AS-401"),
        ))

    def test_structured_code_signatures_keep_complex_code_components(self):
        exact_pairs = [
            ("CLZ-003", "CLZ003"),
            ("JBPOS0755", "JBPOS-0755"),
            ("DDN-A-0101", "DDNA0101"),
            ("AST-51X", "AST51X"),
        ]
        for left, right in exact_pairs:
            with self.subTest(left=left, right=right):
                self.assertEqual(main.pipeline_asset_match_reason(left, right, "Same Co", "Same Co")[0], "exact")

    def test_structured_code_conflicts_and_meaningful_suffixes_are_excluded(self):
        rejected_pairs = [
            ("AST-003", "AST-004"),
            ("ATC-101", "ATC-105"),
            ("ABC101A", "ABC101B"),
            ("DDN-A-0101", "DDN-FA-0001"),
        ]
        for left, right in rejected_pairs:
            with self.subTest(left=left, right=right):
                self.assertIsNone(main.pipeline_asset_match_reason(left, right, "Same Co", "Same Co"))

    def test_same_company_code_prefix_gap_or_missing_prefix_is_review_only(self):
        self.assertEqual(main.pipeline_asset_match_reason("AR1001", "1001", "AriBio", "AriBio")[0], "review")
        self.assertEqual(main.pipeline_asset_match_reason("ABC101", "XYZ101", "AriBio", "AriBio")[0], "review")
        self.assertIsNone(main.pipeline_asset_match_reason("AR1001", "1001", "AriBio", "Other Co"))

    def test_descriptive_assets_are_company_scoped_and_semantic(self):
        self.assertEqual(main.pipeline_asset_match_reason("AD Therapy", "Alzheimer's Disease Therapy", "AriBio", "AriBio")[0], "review")
        self.assertEqual(main.pipeline_asset_match_reason("CNS Research Program", "CNS Disease Research Program", "AriBio", "AriBio")[0], "review")
        self.assertIsNone(main.pipeline_asset_match_reason("AD Therapy", "Alzheimer's Disease Therapy", "AriBio", "Other Co"))
        self.assertIsNone(main.pipeline_asset_match_reason("CNS Research Program", "CNS Research Program", "AriBio", "Other Co"))

    def test_named_assets_can_match_exactly_but_variants_are_not_collapsed(self):
        self.assertEqual(main.pipeline_asset_match_reason("lecanemab", "Lecanemab", "AriBio", "Other Co")[0], "exact")
        self.assertIsNone(main.pipeline_asset_match_reason("AB-12", "AB-12 (IV)", "AriBio", "AriBio"))

    def test_confirmed_reupload_reuses_existing_record_id(self):
        old = full_record("Xenon_Azetukalner_20260801")
        new = full_record("Xenon_Azetukalner_20260803")

        confirmed = main.apply_confirmed_reupload_replacements(
            [new],
            [old],
            [{
                "incoming_record_id": "Xenon_Azetukalner_20260803",
                "existing_record_id": "Xenon_Azetukalner_20260801",
            }],
        )

        self.assertEqual(confirmed, {"Xenon_Azetukalner_20260801"})
        self.assertEqual(main.record_key(new), "Xenon_Azetukalner_20260801")

    def test_explicit_review_can_replace_same_asset_when_company_differs(self):
        old = full_record("Legacy_Azetukalner_20260801", company="Legacy Bio")
        new = full_record("Xenon_Azetukalner_20260803", company="Xenon Pharmaceuticals")

        confirmed = main.apply_confirmed_reupload_replacements(
            [new],
            [old],
            [{
                "incoming_record_id": "Xenon_Azetukalner_20260803",
                "existing_record_id": "Legacy_Azetukalner_20260801",
            }],
        )

        self.assertEqual(confirmed, {"Legacy_Azetukalner_20260801"})
        self.assertEqual(main.record_key(new), "Legacy_Azetukalner_20260801")

    def test_reupload_clears_active_score_override_and_keeps_audit_values(self):
        record = full_record("Xenon_Azetukalner_20260801")
        original_history = copy.deepcopy(record["meta"]["human_review"]["history"])
        changed_at = "2026-08-03T00:00:00+00:00"

        cleared = main.clear_manual_scoring_overrides_for_rubric_refresh(
            record,
            changed_at,
            reset_source="paste_json_score_reset",
        )
        main.append_scoring_override_reset_history(
            record,
            cleared,
            actor_ip="127.0.0.1",
            source="paste_json_score_reset",
            changed_at=changed_at,
        )

        self.assertEqual(cleared["scores"]["target_relevance"], 2)
        self.assertNotIn("scores", record["meta"]["human_review"]["overrides"])
        self.assertNotIn("total_score", record["meta"]["human_review"]["overrides"])
        self.assertEqual(record["meta"]["human_review"]["history"][0], original_history[0])
        reset_events = record["meta"]["human_review"]["history"][1:]
        self.assertEqual(
            [(event["field"], event["previous_value"], event["new_value"]) for event in reset_events],
            [
                ("scores.target_relevance", 2, 3),
                ("total_score", 12, 15),
            ],
        )
        self.assertEqual(record["meta"]["human_review"]["last_updated_source"], "paste_json_score_reset")

    def test_reupload_preserves_dashboard_workspace_metadata(self):
        existing = full_record("Xenon_Azetukalner_20260801")
        existing["meta"].update({
            "attachments": [{"id": "file-1", "filename": "NCDP.pdf"}],
            "collaboration": {"comments": [{"id": "comment-1", "body": "retain"}]},
            "qualitative_review": {"criteria": {"efficacy": {"entries": [{"id": "q-1"}]}}},
            "focus_management": {"is_tracked": True, "partnership_type": "investment"},
        })
        incoming = full_record("Xenon_Azetukalner_20260803")

        main.preserve_dashboard_meta(incoming, existing)

        for key in ("attachments", "collaboration", "qualitative_review", "focus_management", "human_review"):
            self.assertEqual(incoming["meta"][key], existing["meta"][key])


if __name__ == "__main__":
    unittest.main()
