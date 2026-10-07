from __future__ import annotations

from datetime import datetime, timedelta, timezone
import unittest
import asyncio
import copy
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace
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
        "json_summary": {
            "asset_name": "Recent Asset",
            "company": "Recent Bio",
            "theme": "E/I Balance",
            "cluster": "Ion channel",
        },
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
        self.assertEqual(progress["recent_15_days"], {"pending": 1, "fast_triage": 1, "full_scout": 1, "shortlisted": 1})
        researched = next(row for row in progress["rows"] if row["identity"] == "recent-bio::recent-asset")
        self.assertEqual(researched["listing_details"], {
            "country": "US",
            "modality": "Biologic",
            "target": "Target X",
            "main_indication": "Parkinson's disease",
            "stage": "Phase 1",
            "website": "",
        })
        self.assertEqual(researched["listing_details_source"], "full_scout")
        self.assertEqual(researched["theme"], "E/I Balance")
        self.assertEqual(researched["cluster"], "Ion channel")
        self.assertEqual(researched["fast_triage"]["completed_at"], recent)
        self.assertTrue(researched["full_scout"]["completed_at"])
        self.assertEqual(researched["shortlisting"]["completed_at"], recent)


class WorkflowReflectionTests(unittest.TestCase):
    def setUp(self):
        self.recent = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        self.old = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()

    def outputs(self, records, queue=None):
        with patch.object(main, "load_records", return_value=records), patch.object(main, "load_candidate_queue", return_value=queue or []):
            progress = main.get_candidate_queue_progress()
            stats = main.get_candidate_queue_stats()
        self.assertEqual(progress["stats"], stats["stats"])
        self.assertEqual(progress["recent_15_days"], stats["recent_15_days"])
        return progress

    def test_advanced_upload_does_not_imply_listing_or_simple_reflection(self):
        full = pipeline_record(review_type="full_scout", uploaded_at=self.recent)
        result = self.outputs([full])
        self.assertEqual(result["recent_15_days"], {"pending":0,"fast_triage":0,"full_scout":1,"shortlisted":0})
        self.assertTrue(result["rows"][0]["fast_triage"]["done"])
        self.assertEqual(result["rows"][0]["fast_triage"]["reflected_at"], "")
        self.assertEqual(result["rows"][0]["pending"]["reflected_at"], "")

    def test_import_and_research_updates_count_once_per_asset(self):
        full = pipeline_record(review_type="full_scout", uploaded_at=self.old)
        full["meta"]["pipeline_metadata"] = {"listed_at": self.old, "listing_imported_at": self.recent}
        full["meta"]["edit_history"] = [
            {"source":"paste_json_upsert","field":"source_report.raw_markdown","changed_at":self.recent},
            {"source":"paste_json_upsert","field":"research_content","changed_at":self.recent}]
        fast = pipeline_record(review_type="fast_triage", uploaded_at=self.old)
        fast["meta"]["pipeline_metadata"] = copy.deepcopy(full["meta"]["pipeline_metadata"])
        result = self.outputs([fast,full])
        self.assertEqual(result["recent_15_days"], {"pending":1,"fast_triage":0,"full_scout":1,"shortlisted":0})
        self.assertEqual(len(result["rows"]),1)

    def test_manual_edits_and_unchanged_saves_do_not_count(self):
        full = pipeline_record(review_type="full_scout", uploaded_at=self.old, focus_added_at=self.old)
        full["meta"]["pipeline_metadata"] = {"listed_at":self.recent,"updated_at":self.recent}
        full["meta"]["edit_history"] = [
            {"source":"dashboard_pipeline_metadata","field":"pipeline_metadata.comment","changed_at":self.recent},
            {"source":"paste_json_upsert","field":"record","changed_at":self.recent},
            {"source":"dashboard_tab3_focus_management","changed_at":self.recent,"previous_value":"X","new_value":"X"}]
        self.assertEqual(sum(self.outputs([full])["recent_15_days"].values()),0)
        full["meta"]["edit_history"][-1]["new_value"] = "O"
        self.assertEqual(self.outputs([full])["recent_15_days"]["shortlisted"],0)

    def test_custom_counts_star_additions_but_not_edits_or_repeated_adds(self):
        full = pipeline_record(review_type="full_scout", uploaded_at=self.old, focus_added_at=self.recent)
        self.assertEqual(self.outputs([full])["recent_15_days"]["shortlisted"],1)
        full["meta"]["focus_management"]["added_at"] = self.old
        event = {"source":"dashboard_tab3_focus_management", "field":"focus_management.add",
                 "changed_at":self.recent, "previous_value":True, "new_value":True}
        full["meta"]["edit_history"] = [event]
        self.assertEqual(self.outputs([full])["recent_15_days"]["shortlisted"],0)
        event["previous_value"] = False  # Removed and explicitly starred again.
        self.assertEqual(self.outputs([full])["recent_15_days"]["shortlisted"],1)
        full["meta"]["edit_history"].append(copy.deepcopy(event))
        self.assertEqual(self.outputs([full])["recent_15_days"]["shortlisted"],1)
        full["meta"]["focus_management"]["is_tracked"] = False
        self.assertEqual(self.outputs([full])["recent_15_days"]["shortlisted"],0)

    def test_legacy_import_history_queue_updates_and_invalid_dates(self):
        full = pipeline_record(review_type="full_scout", uploaded_at=self.old)
        full["meta"]["edit_history"] = [{"source":"tab0_listing_import_metadata_sync","changed_at":self.recent}]
        queue = [{"id":"q","asset_input":"Different Asset","company_input":"Other Company","added_at":self.old,
                  "pipeline_metadata":{"listing_imported_at":self.recent}}]
        self.assertEqual(self.outputs([full],queue)["recent_15_days"]["pending"],2)
        tomorrow=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()
        self.assertEqual(main.latest_reflection_timestamp("invalid",tomorrow,self.old),self.old)

    def test_listing_import_new_update_and_noop_for_queue_and_researched(self):
        row={"asset_input":"AX-101","company_input":"Recent Bio","target":"Target A"}
        queue=[]; records=[]
        async def request_json(): return {"rows":[row]}
        request=SimpleNamespace(json=request_json)
        def run():
            with patch.object(main,"load_records",side_effect=lambda:copy.deepcopy(records)), patch.object(main,"load_candidate_queue",side_effect=lambda:copy.deepcopy(queue)), patch.object(main,"save_records",side_effect=lambda value:records.__setitem__(slice(None),copy.deepcopy(value))), patch.object(main,"save_candidate_queue",side_effect=lambda value:queue.__setitem__(slice(None),copy.deepcopy(value))), patch.object(main,"require_authenticated_user",return_value={"name":"Test"}), patch.object(main,"get_client_ip",return_value="test"), patch.object(main,"synchronize_cross_workflow_comments"):
                return asyncio.run(main.import_candidate_queue(request))
        self.assertEqual(run()["added"],1)
        first=copy.deepcopy(queue)
        self.assertEqual(run()["metadata_updated"],0)
        self.assertEqual(queue,first)
        row["target"]="Target B"
        self.assertGreater(run()["metadata_updated"],0)
        self.assertEqual(queue[0]["added_at"],first[0]["added_at"])
        self.assertGreater(queue[0]["pipeline_metadata"]["listing_imported_at"],first[0]["pipeline_metadata"]["listing_imported_at"])
        queue.clear();records.append(pipeline_record(review_type="full_scout",uploaded_at=self.old))
        records[0]["structured_table"]["asset_name"] = "AX-101"
        records[0]["json_summary"]["asset_name"] = "AX-101"
        self.assertGreater(run()["metadata_updated"],0)
        first=copy.deepcopy(records)
        self.assertEqual(run()["metadata_updated"],0)
        self.assertEqual(records,first)
        row["target"]="Target C"
        self.assertGreater(run()["metadata_updated"],0)
        self.assertEqual(records[0]["meta"]["pipeline_metadata"]["listed_at"],first[0]["meta"]["pipeline_metadata"]["listed_at"])

    def test_browser_uses_reflection_dates_not_completion_fallback(self):
        from tests.test_dashboard_ia import function_body
        source=(Path(main.ROOT)/"src/app.js").read_text(encoding="utf-8")
        script='function step0IsRecentCompletion(value) {'+function_body(source,'step0IsRecentCompletion')+'}\n'
        script+='function step0FilteredStageStats(rows) {'+function_body(source,'step0FilteredStageStats')+'}\n'
        script+='const rows='+json.dumps([{"pending":{"done":True,"completed_at":self.recent,"reflected_at":""},"full_scout":{"done":True,"completed_at":self.old,"reflected_at":self.recent}}])+';\n'
        script+='const r=step0FilteredStageStats(rows);if(r.recent.pending!==0 || r.recent.full_scout!==1)throw Error(JSON.stringify(r));'
        subprocess.run(['node','--input-type=module'],input=script,text=True,encoding='utf-8',check=True,capture_output=True)

    def test_research_comparison_ignores_storage_and_operational_metadata(self):
        record = pipeline_record(review_type="full_scout", uploaded_at=self.old)
        record["source_report"] = {"raw_markdown": "Original report"}
        stored = main.minimize_record_for_dashboard_storage(record)
        self.assertEqual(main.research_content_snapshot(record), main.research_content_snapshot(stored))
        stored["meta"]["generated_at"] = self.recent
        stored["meta"]["pipeline_metadata"] = {"comment":"Internal note", "listing_imported_at":self.recent}
        self.assertEqual(main.research_content_snapshot(record), main.research_content_snapshot(stored))
        stored["structured_table"]["moa"] = "Updated mechanism"
        self.assertNotEqual(main.research_content_snapshot(record), main.research_content_snapshot(stored))
