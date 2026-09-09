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

    def test_excel_contact_rules_keep_history_but_move_x_prefixed_note_to_comment(self) -> None:
        parsed = main.parse_candidate_pair_lines(
            "Asset\tCompany\tComment\tContact\n"
            "AX-101\tAcme Bio\tInitial note\tX: Do not contact before legal review\n"
            "BX-2\tBeta\t\t2026-08-24 · Introductory call completed\n"
            "CX-3\tCore Bio\t\tSent deck; reply pending\n"
            "DX-4\tDelta\t\tO\n"
        )

        self.assertEqual(parsed["unparsed"], [])
        self.assertEqual(parsed["rows"], [
            {
                "asset_input": "AX-101",
                "company_input": "Acme Bio",
                "comment": "Initial note\nDo not contact before legal review",
                "contact": "X",
            },
            {
                "asset_input": "BX-2",
                "company_input": "Beta",
                "comment": "",
                "contact": "2026-08-24 · Introductory call completed",
            },
            {
                "asset_input": "CX-3",
                "company_input": "Core Bio",
                "comment": "",
                "contact": "Sent deck; reply pending",
            },
            {
                "asset_input": "DX-4",
                "company_input": "Delta",
                "comment": "",
                "contact": "O",
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

    def test_structured_listing_grid_moves_x_prefixed_contact_note_to_comment(self) -> None:
        parsed = main.normalize_candidate_queue_rows([{
            "company_input": "Acme Bio",
            "asset_input": "AX-101",
            "comment": "Initial note",
            "contact": "X · wait for internal approval",
        }])

        self.assertEqual(parsed["unparsed"], [])
        self.assertEqual(parsed["rows"][0]["comment"], "Initial note\nwait for internal approval")
        self.assertEqual(parsed["rows"][0]["contact"], "X")

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

    def test_distinct_listing_import_comments_remain_dated_tab0_cards(self) -> None:
        first = {
            "comment": "Initial meeting note",
            "comment_source": "team_review_import",
            "comment_entries": [main.listing_comment_entry(
                "Initial meeting note",
                entry_id="import-a",
                author="Team",
                source="team_review_import",
                created_at="2026-09-02T01:00:00+00:00",
                import_batch_id="batch-a",
            )],
        }
        second = {
            "comment": "Follow-up requested",
            "comment_source": "team_review_import",
            "comment_entries": [main.listing_comment_entry(
                "Follow-up requested",
                entry_id="import-b",
                author="Team",
                source="team_review_import",
                created_at="2026-09-02T02:00:00+00:00",
                import_batch_id="batch-b",
            )],
        }
        merged = main.merge_pipeline_metadata(first, second)
        duplicate = main.merge_pipeline_metadata(merged, {
            "comment": "follow-up   requested",
            "comment_entries": [main.listing_comment_entry(
                "follow-up   requested",
                entry_id="import-c",
                author="Team",
                source="team_review_import",
                created_at="2026-09-02T03:00:00+00:00",
                import_batch_id="batch-c",
            )],
        })

        self.assertEqual(merged["comment"], "Initial meeting note\nFollow-up requested")
        self.assertEqual([entry["body"] for entry in merged["comment_entries"]], [
            "Initial meeting note", "Follow-up requested",
        ])
        self.assertEqual([entry["body"] for entry in duplicate["comment_entries"]], [
            "Initial meeting note", "Follow-up requested",
        ])
        feed = main.pipeline_human_comment_feed({}, merged)
        self.assertEqual([entry["source"] for entry in feed], [
            "일괄 업로드: Tab 0 · Comment", "일괄 업로드: Tab 0 · Comment",
        ])
        self.assertEqual([entry["created_at"] for entry in feed], [
            "2026-09-02T01:00:00+00:00", "2026-09-02T02:00:00+00:00",
        ])

        record = pipeline_record()
        record["meta"]["pipeline_metadata"] = merged
        main.synchronize_cross_workflow_comments([record])
        mirrored = [
            item for item in record["meta"]["collaboration"]["comments"]
            if item.get("source") == "listing_comment_post"
        ]
        self.assertEqual([item["body"] for item in mirrored], [
            "Initial meeting note", "Follow-up requested",
        ])

    def test_exact_asset_company_listing_values_prefer_incoming_and_fill_missing(self) -> None:
        existing = {
            "listing_details": {
                "target": "Existing target",
                "main_indication": "Multiple sclerosis",
                "stage": "Preclinical",
            }
        }
        incoming = {
            "listing_details": {
                "target": "Newly listed target",
                "main_indication": "Unknown",
                "stage": "",
            }
        }
        merged = main.merge_pipeline_metadata(
            existing,
            incoming,
            listing_details_preference="incoming",
        )
        self.assertEqual(merged["listing_details"]["target"], "Newly listed target")
        self.assertEqual(merged["listing_details"]["main_indication"], "Multiple sclerosis")
        self.assertEqual(merged["listing_details"]["stage"], "Preclinical")

        record = pipeline_record("AX-101", "Acme Bio")
        group = main.dashboard_identity_groups([record])[0]
        self.assertTrue(main.listing_pair_is_exact_for_group("AX-101", "Acme Bio", group))
        self.assertFalse(main.listing_pair_is_exact_for_group("AX-101", "Different Company", group))

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

        self.assertEqual(feed[0]["source"], "일괄 Excel 업로드: Tab 0 · Listing Comment")
        self.assertEqual(feed[0]["author"], "Team Review")

    def test_any_logged_in_user_can_manage_bulk_and_legacy_listing_comments(self) -> None:
        administrator = {"role": main.ROLE_ADMIN, "id": "admin-1"}
        standard_user = {"role": main.ROLE_USER, "id": "user-1"}

        self.assertTrue(main.can_edit_listing_comment({
            "comment": "Imported team note",
            "comment_source": "team_review_import",
        }, administrator))
        self.assertTrue(main.can_edit_listing_comment({
            "comment": "Legacy note without provenance",
        }, administrator))
        self.assertTrue(main.can_edit_listing_comment({
            "comment": "Imported team note",
            "comment_source": "team_review_import",
        }, standard_user))
        self.assertFalse(main.can_edit_listing_comment({
            "comment": "Imported team note",
            "comment_source": "team_review_import",
        }, {}))

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

        self.assertEqual(main.synchronize_cross_workflow_comments([triage, full]), 3)
        comments = full["meta"]["collaboration"]["comments"]
        self.assertEqual([(item["author"], item["body"]) for item in comments], [
            ("Team", "Tab 0 meeting note"),
            ("Fast Triage", "Proceed after BD confirmation."),
            ("Admin", "Confirm the target genetics evidence."),
        ])
        self.assertNotIn("collaboration", triage["meta"])
        self.assertEqual(main.synchronize_cross_workflow_comments([triage, full]), 0)
        self.assertEqual(len(full["meta"]["collaboration"]["comments"]), 3)

    def test_cross_workflow_comment_sync_promotes_human_team_comments_to_full_scout(self) -> None:
        triage = pipeline_record("AX-101", "Acme Bio")
        triage["meta"]["collaboration"] = {
            "comments": [{
                "id": "triage-comment-1",
                "author": "J. Lee",
                "author_user_id": "user-1",
                "author_email": "j.lee@example.test",
                "body": "Confirm BD timing before outreach.",
                "created_at": "2026-08-22T11:00:00+00:00",
                "category": "comment",
            }]
        }
        full = pipeline_record("AX101", "Acme Bio")
        full["meta"]["review_type"] = "full_scout"

        self.assertEqual(main.synchronize_cross_workflow_comments([triage, full]), 1)
        comments = full["meta"]["collaboration"]["comments"]
        self.assertEqual(len(comments), 1)
        self.assertEqual(comments[0]["body"], "Confirm BD timing before outreach.")
        self.assertEqual(comments[0]["label"], "Tab 1 · Fast Triage · Comment")
        self.assertEqual(comments[0]["origin_kind"], "triage_team_comment")
        self.assertTrue(comments[0]["system_import"])
        self.assertIsNotNone(main.delegated_triage_comment_origin([triage, full], comments[0]))
        self.assertEqual(main.synchronize_cross_workflow_comments([triage, full]), 0)

    def test_contact_history_syncs_to_full_scout_and_x_clears_only_listing_contact(self) -> None:
        triage = pipeline_record("AX-101", "Acme Bio")
        triage["meta"]["pipeline_metadata"] = {
            "contact": "2026-08-24 · BD call completed",
            "contact_author": "Team",
            "contact_source": "team_review_import",
        }
        triage["meta"]["collaboration"] = {
            "comments": [{
                "id": "contact-1",
                "author": "J. Lee",
                "body": "Sent NDA and awaiting reply.",
                "created_at": "2026-08-24T10:00:00+00:00",
                "category": "contact_history",
            }]
        }
        full = pipeline_record("AX101", "Acme Bio")
        full["meta"]["review_type"] = "full_scout"

        self.assertEqual(main.synchronize_cross_workflow_comments([triage, full]), 2)
        contacts = full["meta"]["collaboration"]["comments"]
        self.assertEqual([(item["category"], item["label"], item["body"]) for item in contacts], [
            ("contact_history", "Tab 0 · Contact History", "2026-08-24 · BD call completed"),
            ("contact_history", "Tab 1 · Fast Triage · Contact History", "Sent NDA and awaiting reply."),
        ])

        triage["meta"]["pipeline_metadata"] = main.merge_pipeline_metadata(
            triage["meta"]["pipeline_metadata"], {"contact": "X"}
        )
        self.assertEqual(main.synchronize_cross_workflow_comments([triage, full]), 1)
        contacts = full["meta"]["collaboration"]["comments"]
        self.assertEqual(len(contacts), 1)
        self.assertEqual(contacts[0]["body"], "Sent NDA and awaiting reply.")

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
        self.assertEqual(feed[0]["author"], "Team Review")
        self.assertFalse(any("AI response" in entry["body"] for entry in feed))

    def test_previously_merged_listing_alias_does_not_reopen_reverse_pair_review(self) -> None:
        queue = [{
            "id": "cq_molgen",
            "asset_input": "MG-TA",
            "company_input": "Molgen Bio Co Ltd",
            "pipeline_metadata": {
                "asset_aliases": "MG-TA\nMG-RZ",
                "company_aliases": "Molgen Bio Co Ltd",
            },
        }]
        rows = [{
            "asset_input": "MG-RZ",
            "company_input": "Molgen Bio Co Ltd",
            "stage": "Discovery",
        }]

        self.assertEqual(main.listing_import_review_matches(rows, [], queue), [])
        self.assertIn(
            main.normalized_pipeline_asset_identity("MG-RZ"),
            main.candidate_queue_entry_asset_aliases(queue[0]),
        )

    def test_representative_listing_values_win_conflicts_and_fill_only_their_blanks(self) -> None:
        existing = {
            "target": "Existing target",
            "main_indication": "Existing indication",
            "stage": "Preclinical",
            "website": "https://existing.example",
        }
        incoming = {
            "modality": "Small molecule",
            "target": "Incoming target",
            "stage": "Phase 1",
            "website": "https://incoming.example",
        }

        self.assertEqual(
            main.merge_listing_details_with_preference(existing, incoming, preference="existing"),
            {
                "country": "",
                "modality": "Small molecule",
                "target": "Existing target",
                "main_indication": "Existing indication",
                "stage": "Preclinical",
                "website": "https://existing.example",
            },
        )
        self.assertEqual(
            main.merge_listing_details_with_preference(existing, incoming, preference="incoming"),
            {
                "country": "",
                "modality": "Small molecule",
                "target": "Incoming target",
                "main_indication": "Existing indication",
                "stage": "Phase 1",
                "website": "https://incoming.example",
            },
        )

    def test_listing_merge_treats_unknown_stage_as_blank_for_the_other_listing_value(self) -> None:
        existing = {"stage": "Unknown", "target": "Existing target"}
        incoming = {"stage": "Discovery", "target": "Incoming target"}

        self.assertEqual(
            main.merge_listing_details_with_preference(existing, incoming, preference="existing"),
            {
                "country": "",
                "modality": "",
                "target": "Existing target",
                "main_indication": "",
                "stage": "Discovery",
                "website": "",
            },
        )

    def test_listing_merge_fills_all_canonical_missing_markers_from_the_other_row(self) -> None:
        existing = {
            "country": "Unknown",
            "modality": "-",
            "target": "N/A",
            "main_indication": "Not Available",
            "stage": " ",
        }
        incoming = {
            "country": "Republic of Korea",
            "modality": "Small molecule",
            "target": "DAPK1",
            "main_indication": "Alzheimer's disease",
            "stage": "Discovery",
        }

        self.assertEqual(
            main.merge_listing_details_with_preference(existing, incoming, preference="existing"),
            {
                "country": "Republic of Korea",
                "modality": "Small molecule",
                "target": "DAPK1",
                "main_indication": "Alzheimer's disease",
                "stage": "Discovery",
                "website": "",
            },
        )
        self.assertEqual(
            main.merge_listing_identity_value("Unknown", "New Asset", preference="existing"),
            "New Asset",
        )
        self.assertEqual(
            main.merge_listing_identity_value("Existing Asset", "N/A", preference="incoming"),
            "Existing Asset",
        )

    def test_descriptive_listing_match_ignores_small_molecule_inhibit_scaffolding(self) -> None:
        reason = main.pipeline_asset_match_reason(
            "Small Molecule to Inhibit DAPK1 and CSF1R for Tauopathies",
            "Small Molecule to Inhibit Dopamine Transporter, Noradrenaline Transporter and Serotonin Transporter for Major Depressive Disorder",
            "Korea Institute of Science and Technology",
            "Korea Institute of Science and Technology",
        )

        self.assertIsNone(reason)

    def test_descriptive_listing_match_ignores_plural_molecule_target_scaffolding(self) -> None:
        reason = main.pipeline_asset_match_reason(
            "Small Molecules to Target 5-HT7R for Sleep Disorders",
            "Small Molecules to Target TSPO for Alzheimer's Disease",
            "Korea Institute of Science and Technology",
            "Korea Institute of Science and Technology",
        )

        self.assertIsNone(reason)

    def test_descriptive_listing_match_requires_two_meaningful_terms(self) -> None:
        self.assertIsNone(main.pipeline_asset_match_reason(
            "Gene therapy for CNS disease",
            "Gene therapy for neuromuscular disease",
            "GenKOre",
            "GenKOre",
        ))
        self.assertEqual(main.pipeline_asset_match_reason(
            "Gene therapy for neuromuscular disease",
            "Neuromuscular gene therapy",
            "GenKOre",
            "GenKOre",
        ), ("review", "same company and at least two overlapping meaningful descriptive terms"))

    def test_listing_website_respects_representative_without_retaining_other_url(self) -> None:
        existing = {"website": "https://existing.example"}
        incoming = {"website": "https://incoming.example"}

        existing_primary = main.merge_pipeline_metadata(
            existing,
            incoming,
            website_preference="existing",
        )
        incoming_primary = main.merge_pipeline_metadata(
            existing,
            incoming,
            website_preference="incoming",
        )

        self.assertEqual(existing_primary["website"], "https://existing.example")
        self.assertEqual(incoming_primary["website"], "https://incoming.example")
        self.assertNotIn("website_alternates", existing_primary)
        self.assertNotIn("website_alternates", incoming_primary)


if __name__ == "__main__":
    unittest.main()
