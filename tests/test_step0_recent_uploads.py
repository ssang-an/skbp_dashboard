from __future__ import annotations

from datetime import datetime, timedelta, timezone
import unittest
from unittest.mock import patch

import main


def pipeline_record(*, review_type: str, uploaded_at: str | None = None, focus_added_at: str | None = None) -> dict:
    meta = {
        "review_type": review_type,
        "generated_at": (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat(),
        "output_filename_base": f"Recent Bio_{review_type}",
    }
    if uploaded_at:
        meta["dashboard_uploaded_at"] = uploaded_at
    if focus_added_at:
        meta["focus_management"] = {"is_tracked": True, "added_at": focus_added_at}
    return {
        "meta": meta,
        "structured_table": {
            "asset_name": "Recent Asset",
            "company": "Recent Bio",
            "company_country": "KR",
            "modality_platform": "Small molecule",
            "target": "Target X",
            "main_indication": "ALS",
            "development_stage": "Preclinical",
        },
        "json_summary": {"asset_name": "Recent Asset", "company": "Recent Bio"},
    }


class Step0RecentUploadTests(unittest.TestCase):
    def test_step0_progress_reports_recent_uploads_by_workflow(self) -> None:
        recent = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        fast = pipeline_record(review_type="fast_triage", uploaded_at=recent)
        # Legacy Full Scout records do not have an upload timestamp, so generated_at is used.
        full = pipeline_record(review_type="full_scout", focus_added_at=recent)
        full["structured_table"].update({
            "company_country": "US",
            "modality_platform": "Biologic",
            "target": "",
            "main_indication": "Parkinson's disease",
            "development_stage": "Phase 1",
        })
        group = {
            "asset_identity": "recent-bio::recent-asset",
            "asset_aliases": {"recent asset"},
            "company_aliases": {"recent bio"},
            "records": [fast, full],
        }
        queue = [{"id": "pending-recent", "asset_input": "Pending Asset", "company_input": "Pending Bio", "added_at": recent}]

        with (
            patch.object(main, "load_records", return_value=[fast, full]),
            patch.object(main, "dashboard_identity_groups", return_value=[group]),
            patch.object(main, "load_candidate_queue", return_value=queue),
        ):
            progress = main.get_candidate_queue_progress()

        # A historical researched record is already in the Listing inventory even when it
        # predates `pipeline_metadata.listed_at`; the pending queue contributes one more.
        self.assertEqual(progress["stats"], {"pending": 2, "fast_triage": 1, "full_scout": 1, "shortlisted": 1})
        self.assertEqual(progress["recent_15_days"], {"pending": 2, "fast_triage": 1, "full_scout": 1, "shortlisted": 1})
        researched = next(row for row in progress["rows"] if row["identity"] == "recent-bio::recent-asset")
        self.assertEqual(researched["listing_details"], {
            "country": "US",
            "modality": "Biologic",
            "target": "Target X",
            "main_indication": "Parkinson's disease",
            "stage": "Phase 1",
        })
        self.assertEqual(researched["listing_details_source"], "full_scout")
