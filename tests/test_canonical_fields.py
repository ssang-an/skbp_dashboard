"""Regression examples for dashboard canonical classification.

Run with: ``python -m unittest tests.test_canonical_fields``.
These cases deliberately cover planning language so a dictionary or parser change
cannot silently promote an unconfirmed milestone.
"""

import unittest

from main import (
    canonicalize_development_stage,
    canonicalize_modality,
    canonicalize_modality_tags,
    merge_listing_details,
    merge_pipeline_metadata,
)


class CanonicalFieldTests(unittest.TestCase):
    def test_confirmed_current_stage_beats_future_plan(self):
        self.assertEqual(
            canonicalize_development_stage("Phase 1 completed; Phase 2 planned"),
            "Phase 1",
        )

    def test_future_stage_alone_is_not_promoted(self):
        self.assertEqual(canonicalize_development_stage("Phase 2 planned"), "Unknown")

    def test_preclinical_and_ind_examples(self):
        self.assertEqual(canonicalize_development_stage("GLP tox and IND preparation underway"), "IND-enabling")
        self.assertEqual(canonicalize_development_stage("IND filed with the FDA"), "IND filed/cleared")
        self.assertEqual(canonicalize_development_stage("NDA under review"), "Registration")

    def test_combined_modality_keeps_primary_and_tag(self):
        wording = "AAV-delivered ASO, intrathecal"
        self.assertEqual(canonicalize_modality(wording), "RNA therapy")
        self.assertEqual(canonicalize_modality_tags(wording, "RNA therapy"), ["RNA therapy", "Gene therapy"])

    def test_absent_modality_is_the_only_unknown_case(self):
        self.assertEqual(canonicalize_modality("not disclosed"), "Unknown")
        self.assertEqual(canonicalize_modality_tags("not disclosed"), [])

    def test_imported_comments_and_contact_history_are_additive_and_idempotent(self):
        existing = {"comment": "Initial note", "contact": "Met at conference"}
        incoming = {"comment": "New note", "contact": "Follow-up call completed"}
        merged = merge_pipeline_metadata(existing, incoming)
        self.assertEqual(merged["comment"], "Initial note\nNew note")
        self.assertEqual(merged["contact"], "Met at conference\nFollow-up call completed")
        self.assertEqual(merge_pipeline_metadata(merged, incoming), merged)

    def test_direct_contact_edit_replaces_only_that_contact_post(self):
        updated = merge_pipeline_metadata(
            {"contact": "Old history"}, {"contact": "Corrected history"}, replace_contact=True
        )
        self.assertEqual(updated["contact"], "Corrected history")

    def test_listing_details_keep_a_more_specific_modality_without_renaming_pipeline(self):
        merged = merge_listing_details(
            {"modality": "ASO", "target": "SOD1", "country": "US"},
            {"modality": "AAV-delivered ASO, intrathecal", "stage": "Preclinical", "country": "US"},
        )
        self.assertEqual(merged["modality"], "AAV-delivered ASO, intrathecal")
        self.assertEqual(merged["target"], "SOD1")
        self.assertEqual(merged["stage"], "Preclinical")


if __name__ == "__main__":
    unittest.main()
