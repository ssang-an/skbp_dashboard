from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import export_pipeline_wiki


def record(asset: str, company: str, review_type: str, *, tracked: bool = False) -> dict:
    focus = {
        "is_tracked": tracked,
        "tracking_status": "stationary" if tracked else "",
        "partnership_type": "investment" if tracked else "unknown",
        "partnership_note": "Verified workflow fixture" if tracked else "",
        "partner_material_flags": {"ncdp": tracked, "admet": False},
    }
    return {
        "meta": {
            "output_filename_base": f"{company}_{asset}_{review_type}",
            "generated_at": "2026-08-22T10:00:00+00:00",
            "review_type": review_type,
            "pipeline_metadata": {"comment": "Listing context", "contact": "BD owner"},
            "focus_management": focus,
        },
        "input": {"company_input": company, "asset_input": asset},
        "source_report": {"raw_markdown": f"# {asset}"},
        "json_summary": {
            "company": company,
            "asset_name": asset,
            "target": "Target-X",
            "moa": "Inhibitor",
            "modality_platform": "Small molecule",
            "indication": "Example disease",
            "theme": "E/I Balance",
            "cluster": "Ion Channel",
        },
        "structured_table": {
            "company": company,
            "asset_name": asset,
            "target": "Target-X",
            "moa": "Inhibitor",
            "modality_platform": "Small molecule",
            "indication": "Example disease",
            "development_stage": "Preclinical",
            "sources": [],
        },
        "scoring": {"criteria": {}, "total_score": 12, "max_score": 21},
        "hard_filter": {"status": "PASS"},
        "competitive_analysis": {"competitor_table": []},
        "validation": {"source_registry": [], "uncertain_points": []},
        "final_insight": {"recommendation": "Shortlist", "one_line_summary": "Fixture"},
    }


class WorkflowWikiExportTests(unittest.TestCase):
    def test_listing_triage_full_scout_and_actual_shortlisting_are_separate_graph_states(self) -> None:
        records = [
            record("AX-101", "Acme Bio", "fast_triage"),
            record("AX101", "Acme Bio", "full_scout"),
            record("BX-1", "Beta Bio", "full_scout", tracked=True),
        ]
        queue = [
            {
                "id": "cq_ax101",
                "asset_input": "AX-101",
                "company_input": "Acme Bio",
                "added_at": "2026-08-20T00:00:00+00:00",
                "pipeline_metadata": {"comment": "Queue note", "contact": "Acme BD"},
            },
            {"id": "cq_listing", "asset_input": "Listing-only", "company_input": "Queue Bio"},
        ]
        with tempfile.TemporaryDirectory(prefix="skbp-workflow-wiki-") as temp_dir:
            root = Path(temp_dir)
            data_file = root / "pipeline-records.json"
            queue_file = root / "candidate-queue.json"
            vault = root / "wiki"
            data_file.write_text(json.dumps(records), encoding="utf-8")
            queue_file.write_text(json.dumps(queue), encoding="utf-8")
            with (
                patch.object(export_pipeline_wiki, "DATA_FILE", data_file),
                patch.object(export_pipeline_wiki, "CANDIDATE_QUEUE_FILE", queue_file),
                patch.object(export_pipeline_wiki, "VAULT_DIR", vault),
            ):
                report = export_pipeline_wiki.generate()

            graph = json.loads((vault / "13_Graph_Exports" / "graph.json").read_text(encoding="utf-8"))
            node_types = {node["type"] for node in graph["nodes"]}
            relationships = {edge["relationship"] for edge in graph["edges"]}
            self.assertEqual(2, report["listing_entries"])
            self.assertEqual(3, report["workflow_pipelines"])
            self.assertTrue({"workflow", "workflow_stage", "review", "oi_partnership"}.issubset(node_types))
            self.assertTrue({"IN_WORKFLOW_STAGE", "HAS_REVIEW", "HAS_SHORTLISTING_CLASSIFICATION"}.issubset(relationships))
            self.assertIn("Listing-only", (vault / "12_Dashboards" / "Dashboard__Listing.md").read_text(encoding="utf-8"))
            self.assertIn("BX-1", (vault / "12_Dashboards" / "Dashboard__OI_Shortlisting.md").read_text(encoding="utf-8"))
            self.assertIn("Recommendation Shortlist", (vault / "12_Dashboards" / "Dashboard__Shortlist.md").read_text(encoding="utf-8"))
            self.assertEqual(3, len(list((vault / "10_Scorecards").glob("Scorecard__*.md"))))


if __name__ == "__main__":
    unittest.main()
