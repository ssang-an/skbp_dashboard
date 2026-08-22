from __future__ import annotations

import unittest

import main


def pipeline_record(asset: str = "AX-101", company: str = "Acme Bio") -> dict:
    return {
        "meta": {
            "review_type": "fast_triage",
            "generated_at": "2026-08-22",
            "output_filename_base": f"{company}_{asset}",
        },
        "input": {"asset_input": asset, "company_input": company},
        "structured_table": {"asset_name": asset, "company": company},
        "json_summary": {"asset_name": asset, "company": company},
    }


class Step0PipelineMetadataTests(unittest.TestCase):
    def test_contact_absence_markers_normalize_but_notes_and_dates_remain_history(self) -> None:
        self.assertEqual(main.normalize_pipeline_metadata({"contact": "X"})["contact"], "")
        self.assertEqual(main.normalize_pipeline_metadata({"contact": " - "})["contact"], "")
        self.assertEqual(main.normalize_pipeline_metadata({"contact": "O"})["contact"], "O")
        self.assertEqual(main.normalize_pipeline_metadata({"contact": "2026-08-22"})["contact"], "2026-08-22")
        self.assertEqual(
            main.normalize_pipeline_metadata({"contact": "담당자에게 자료를 전달하고 회신 대기"})["contact"],
            "담당자에게 자료를 전달하고 회신 대기",
        )
        self.assertEqual(
            main.merge_pipeline_metadata({"contact": "2026-08-20 contacted"}, {"contact": "X"})["contact"],
            "",
        )
        self.assertEqual(
            main.merge_pipeline_metadata({"contact": "2026-08-20 contacted"}, {"contact": ""})["contact"],
            "2026-08-20 contacted",
        )

    def test_tab_delimited_four_columns_keep_blank_cells_and_multiline_comment(self) -> None:
        parsed = main.parse_candidate_pair_lines(
            'Asset\tCompany\tComment\tContact\n'
            'AX-101\tAcme Bio\t"Call before review\nNeeds deck"\towner@acme.test\n'
            'BX-2\tBeta\t\tDr. Kim\n'
        )

        self.assertEqual(parsed["unparsed"], [])
        self.assertEqual(parsed["rows"], [
            {
                "asset_input": "AX-101",
                "company_input": "Acme Bio",
                "comment": "Call before review\nNeeds deck",
                "contact": "owner@acme.test",
            },
            {
                "asset_input": "BX-2",
                "company_input": "Beta",
                "comment": "",
                "contact": "Dr. Kim",
            },
        ])

    def test_legacy_two_column_paste_remains_supported(self) -> None:
        parsed = main.parse_candidate_pair_lines("AX-101  Acme Bio\nBX-2  Beta\nAsset with  internal spacing  Gamma")

        self.assertEqual([(row["asset_input"], row["company_input"], row["comment"], row["contact"]) for row in parsed["rows"]], [
            ("AX-101", "Acme Bio", "", ""),
            ("BX-2", "Beta", "", ""),
            ("Asset with internal spacing", "Gamma", "", ""),
        ])

    def test_structured_listing_grid_keeps_optional_context(self) -> None:
        parsed = main.normalize_candidate_queue_rows([{
            "company_input": "Acme Bio",
            "country": "KR",
            "asset_input": "AX-101",
            "modality": "Small molecule",
            "target": "Target X",
            "main_indication": "ALS",
            "stage": "Preclinical",
            "comment": "BD review",
            "contact": "owner@acme.test",
            "website": "https://acme.test/company",
        }])

        self.assertEqual(parsed["unparsed"], [])
        self.assertEqual(parsed["rows"][0]["company_input"], "Acme Bio")
        self.assertEqual(parsed["rows"][0]["asset_input"], "AX-101")
        self.assertEqual(parsed["rows"][0]["main_indication"], "ALS")
        self.assertEqual(parsed["rows"][0]["contact"], "owner@acme.test")
        self.assertEqual(parsed["rows"][0]["website"], "https://acme.test/company")

    def test_structured_listing_grid_requires_company_and_asset(self) -> None:
        parsed = main.normalize_candidate_queue_rows([
            {"company_input": "Acme Bio", "asset_input": ""},
            {"company_input": "", "asset_input": "AX-101"},
        ])

        self.assertEqual(parsed["rows"], [])
        self.assertEqual(len(parsed["unparsed"]), 2)

    def test_structured_listing_grid_rejects_asset_placeholder_markers(self) -> None:
        parsed = main.normalize_candidate_queue_rows([
            {"company_input": "Acme Bio", "asset_input": "-"},
            {"company_input": "Acme Bio", "asset_input": "X"},
            {"company_input": "Acme Bio", "asset_input": "×"},
        ])

        self.assertEqual(parsed["rows"], [])
        self.assertEqual(len(parsed["unparsed"]), 3)
        self.assertTrue(main.is_listing_asset_placeholder("\u00d7"))

    def test_listing_details_fill_blanks_but_keep_conflicts_from_a_less_complete_duplicate(self) -> None:
        merged = main.merge_listing_details(
            {"country": "KR", "modality": "Small molecule", "target": "Target X"},
            {"country": "", "modality": "Biologic", "target": "", "website": "https://acme.test"},
        )

        self.assertEqual(merged["country"], "KR")
        self.assertEqual(merged["modality"], "Small molecule")
        self.assertEqual(merged["target"], "Target X")
        self.assertEqual(merged["website"], "https://acme.test")

    def test_richer_duplicate_listing_replaces_conflicting_details(self) -> None:
        merged = main.merge_listing_details(
            {"country": "KR", "modality": "Small molecule"},
            {
                "country": "CN",
                "modality": "RNA",
                "target": "SOD1",
                "main_indication": "ALS",
                "stage": "Preclinical",
                "website": "https://psk.example/path",
            },
        )

        self.assertEqual(merged["country"], "CN")
        self.assertEqual(merged["modality"], "RNA")
        self.assertEqual(merged["website"], "https://psk.example/path")

    def test_listing_website_keeps_only_first_valid_http_url(self) -> None:
        self.assertEqual(
            main.normalize_listing_website("See https://first.example/a and https://second.example/b"),
            "https://first.example/a",
        )
        self.assertEqual(main.normalize_listing_website("www.example.com"), "")
        self.assertEqual(main.normalize_listing_website("javascript:alert(1)"), "")

    def test_latest_nonblank_website_replaces_the_previous_operational_url(self) -> None:
        merged = main.merge_pipeline_metadata(
            {"website": "https://old.example/pipeline"},
            {"website": "https://new.example/pipeline"},
        )

        self.assertEqual(merged["website"], "https://new.example/pipeline")

    def test_pending_listing_inline_edit_marks_only_the_changed_field(self) -> None:
        entry = {
            "company_input": "Acme Bio",
            "asset_input": "AX-101",
            "listing_details": {"country": "KR", "stage": "Preclinical"},
        }

        changed = main.update_candidate_queue_listing_field(
            entry,
            "stage",
            "IND-enabling",
            edited_by="Admin",
            changed_at="2026-08-22T00:00:00+00:00",
        )

        self.assertTrue(changed)
        self.assertEqual(main.candidate_queue_entry_details(entry)["stage"], "IND-enabling")
        self.assertEqual(main.candidate_queue_manual_fields(entry)["stage"], {
            "updated_at": "2026-08-22T00:00:00+00:00",
            "edited_by": "Admin",
        })
        self.assertFalse(main.update_candidate_queue_listing_field(
            entry,
            "stage",
            "IND-enabling",
            edited_by="Admin",
            changed_at="2026-08-22T00:05:00+00:00",
        ))

    def test_pending_listing_inline_edit_keeps_company_and_asset_required(self) -> None:
        entry = {"company_input": "Acme Bio", "asset_input": "AX-101"}
        with self.assertRaises(ValueError):
            main.update_candidate_queue_listing_field(
                entry,
                "asset",
                "",
                edited_by="Admin",
                changed_at="2026-08-22T00:00:00+00:00",
            )

    def test_blank_import_values_never_erase_existing_metadata(self) -> None:
        existing = {
            "listed_at": "2026-08-01T00:00:00+00:00",
            "comment": "Keep this note",
            "contact": "owner@acme.test",
            "updated_at": "2026-08-01T00:00:00+00:00",
        }
        merged = main.merge_pipeline_metadata(existing, {"comment": "", "contact": ""})

        self.assertEqual(merged["comment"], "Keep this note")
        self.assertEqual(merged["contact"], "owner@acme.test")

    def test_reimported_listing_comments_accumulate_without_duplicate_blocks(self) -> None:
        merged = main.merge_pipeline_metadata(
            {"comment": "Initial meeting note"},
            {"comment": "Follow-up requested"},
        )
        self.assertEqual(merged["comment"], "Initial meeting note\nFollow-up requested")

        duplicate = main.merge_pipeline_metadata(merged, {"comment": "follow-up   requested"})
        self.assertEqual(duplicate["comment"], "Initial meeting note\nFollow-up requested")

    def test_admin_listing_comment_post_replaces_bulk_comment_and_records_author(self) -> None:
        merged = main.merge_pipeline_metadata(
            {
                "comment": "Bulk team review note",
                "comment_author": "Tab 0 Team Review",
                "comment_source": "team_review_import",
                "comment_created_at": "2026-08-22T09:00:00+00:00",
            },
            {
                "comment": "Administrator follow-up note",
                "comment_author": "Admin Kim",
                "comment_source": "admin_listing_post",
                "comment_created_at": "2026-08-22T10:00:00+00:00",
                "comment_updated_at": "2026-08-22T10:00:00+00:00",
            },
            replace_comment=True,
        )

        self.assertEqual(merged["comment"], "Administrator follow-up note")
        self.assertEqual(merged["comment_author"], "Admin Kim")
        self.assertEqual(merged["comment_source"], "admin_listing_post")
        feed = main.pipeline_human_comment_feed({}, merged)
        self.assertEqual(feed[0]["source"], "Tab 0 · Listing Comment")
        self.assertEqual(feed[0]["author"], "Admin Kim")

    def test_bulk_listing_comment_is_labelled_as_team_comment(self) -> None:
        feed = main.pipeline_human_comment_feed({}, {
            "comment": "Shared review note",
            "comment_author": "Tab 0 Team Review",
            "comment_source": "team_review_import",
            "comment_created_at": "2026-08-22T09:00:00+00:00",
        })

        self.assertEqual(feed[0]["source"], "Tab 0 · Team Comment")
        self.assertEqual(feed[0]["author"], "Tab 0 Team Review")

    def test_explicit_edit_can_clear_a_metadata_field(self) -> None:
        merged = main.merge_pipeline_metadata(
            {"comment": "Remove me", "contact": "owner@acme.test"},
            {"comment": "", "updated_at": "2026-08-22T00:00:00+00:00"},
            allow_empty_fields={"comment"},
        )

        self.assertEqual(merged["comment"], "")
        self.assertEqual(merged["contact"], "owner@acme.test")

    def test_listing_metadata_promotes_to_matching_research_record(self) -> None:
        record = pipeline_record()
        queue = [{
            "id": "cq_ax101",
            "asset_input": "AX101",
            "company_input": "Acme Bio",
            "added_at": "2026-08-20T00:00:00+00:00",
            "pipeline_metadata": {"comment": "Discuss rights", "contact": "J. Lee"},
        }]

        consumed = main.promote_candidate_queue_metadata([record], queue)

        self.assertEqual(consumed, {"cq_ax101"})
        self.assertEqual(record["meta"]["pipeline_metadata"]["comment"], "Discuss rights")
        self.assertEqual(record["meta"]["pipeline_metadata"]["contact"], "J. Lee")
        self.assertEqual(record["meta"]["pipeline_metadata"]["listed_at"], "2026-08-20T00:00:00+00:00")

    def test_existing_metadata_hydrates_a_new_full_scout_record(self) -> None:
        existing = pipeline_record()
        existing["meta"]["pipeline_metadata"] = {
            "listed_at": "2026-08-20T00:00:00+00:00",
            "comment": "Keep private",
            "contact": "owner@acme.test",
            "updated_at": "2026-08-21T00:00:00+00:00",
        }
        incoming = pipeline_record()
        incoming["meta"]["review_type"] = "full_scout"

        main.hydrate_records_pipeline_metadata_from_existing([incoming], [existing])

        self.assertEqual(incoming["meta"]["pipeline_metadata"]["comment"], "Keep private")
        self.assertEqual(incoming["meta"]["pipeline_metadata"]["contact"], "owner@acme.test")

    def test_cross_workflow_comment_sync_promotes_listing_and_fast_triage_human_notes_once(self) -> None:
        triage = pipeline_record("AX-101", "Acme Bio")
        triage["meta"]["pipeline_metadata"] = {"comment": "Tab 0 meeting note", "website": "https://acme.example"}
        triage["meta"]["human_review"] = {
            "overrides": {"final_comment": "Proceed after BD confirmation."},
            "final_comment_updated_at": "2026-08-22T10:00:00+00:00",
        }
        triage["meta"]["topic_notes"] = [{
            "id": "target-note-1",
            "topic_id": "triage-score-target_relevance",
            "topic_title": "Fast Triage · Target Area Relevance",
            "body": "Confirm the target genetics evidence.",
            "author_name": "Admin",
            "created_at": "2026-08-22T11:00:00+00:00",
        }]
        full = pipeline_record("AX101", "Acme Bio")
        full["meta"]["review_type"] = "full_scout"

        self.assertEqual(main.synchronize_cross_workflow_comments([triage, full]), 4)
        comments = full["meta"]["collaboration"]["comments"]
        self.assertEqual([(item["author"], item["body"]) for item in comments], [
            ("Tab 0 Team Review", "Tab 0 meeting note"),
            ("Fast Triage · Final Comment", "Proceed after BD confirmation."),
            ("Fast Triage · Target Area Relevance", "Confirm the target genetics evidence."),
        ])
        self.assertEqual(triage["meta"]["collaboration"]["comments"][0]["author"], "Tab 0 Team Review")
        self.assertEqual(main.synchronize_cross_workflow_comments([triage, full]), 0)
        self.assertEqual(len(full["meta"]["collaboration"]["comments"]), 3)

    def test_cross_workflow_comment_sync_excludes_ai_qualitative_entries(self) -> None:
        triage = pipeline_record("AX-101", "Acme Bio")
        triage["meta"]["topic_notes"] = [{
            "id": "ai-note",
            "topic_id": "triage-score-target_relevance",
            "body": "AI generated copy",
            "is_ai": True,
        }]
        full = pipeline_record("AX101", "Acme Bio")
        full["meta"]["review_type"] = "full_scout"

        self.assertEqual(main.synchronize_cross_workflow_comments([triage, full]), 0)
        self.assertNotIn("collaboration", full["meta"])

    def test_deleted_import_key_prevents_a_comment_from_returning_on_later_sync(self) -> None:
        record = pipeline_record()
        import_key = main.imported_comment_key("Tab 0", "AX-101", "Listing note")
        record["meta"]["collaboration"] = {"deleted_import_keys": [import_key]}

        changed = main.upsert_system_comment(
            record,
            import_key=import_key,
            author="Tab 0",
            body="Listing note",
            source="tab0_listing_comment",
        )

        self.assertFalse(changed)
        self.assertEqual(record["meta"]["collaboration"].get("comments", []), [])

    def test_tab0_comment_feed_keeps_listing_and_human_review_comments_separate_from_ai(self) -> None:
        record = pipeline_record()
        record["meta"]["human_review"] = {
            "overrides": {"final_comment": "Proceed after BD confirmation."},
            "final_comment_author_name": "Admin",
            "final_comment_updated_at": "2026-08-22T10:00:00+00:00",
        }
        record["meta"]["qualitative_review"] = {
            "criteria": {
                "efficacy": {
                    "entries": [
                        {"author": "Admin", "body": "Check the in-vivo comparator.", "is_ai": False, "created_at": "2026-08-22T11:00:00+00:00"},
                        {"author": "AI", "body": "This AI response must not appear.", "is_ai": True, "created_at": "2026-08-22T12:00:00+00:00"},
                    ]
                }
            }
        }

        feed = main.pipeline_human_comment_feed(
            {"records": [record]},
            {"comment": "Listing owner note"},
        )

        self.assertEqual([entry["body"] for entry in feed], [
            "Listing owner note",
            "Proceed after BD confirmation.",
            "Check the in-vivo comparator.",
        ])
        self.assertEqual(feed[0]["author"], "Tab 0 Team Review")
        self.assertFalse(any("AI response" in entry["body"] for entry in feed))


if __name__ == "__main__":
    unittest.main()
