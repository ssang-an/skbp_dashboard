from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from record_storage import minimize_record_for_dashboard_storage
from scripts import export_obsidian, export_pipeline_wiki


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "json" / "pipeline-records.json"
LEGACY_GIT_REF = "19aa4b9"


def exporter_fixture(*, canonical_sources: bool) -> dict:
    source = {
        "source_id": "SRC-PRIMARY",
        "source_title": "Primary program page",
        "source_url": "https://example.com/program",
        "source_type": "primary",
        "reliability": "high",
        "evidence_summary": "Asset-specific evidence",
    }
    criterion = {
        "score": 2,
        "evidence_type": "E3",
        "main_line_summary": "Supported by asset-specific evidence.",
        "why_not_higher": "No clinical evidence.",
        "uncertain_points": [],
    }
    validation: dict = {"uncertain_points": [], "source_registry": []}
    if canonical_sources:
        criterion["source_ids"] = [source["source_id"]]
        validation["source_registry"] = [source]
    else:
        criterion["evidence_sources"] = [source]

    return {
        "meta": {
            "output_filename_base": "Fixture__FX-1",
            "generated_at": "2026-08-06",
            "review_type": "full_scout",
        },
        "input": {"company_input": "Fixture Bio", "asset_input": "FX-1"},
        "source_report": {"raw_markdown": "# Fixture report\n\nAudit text."},
        "json_summary": {
            "company": "Fixture Bio",
            "asset_name": "FX-1",
            "target": "Target-X",
            "moa": "Inhibitor",
            "modality_platform": "Small molecule",
            "indication": "Example disease",
            "theme": "E/I Balance",
            "cluster": "Ion Channel",
        },
        "structured_table": {
            "company": "Fixture Bio",
            "asset_name": "FX-1",
            "target": "Target-X",
            "moa": "Inhibitor",
            "modality_platform": "Small molecule",
            "indication": "Example disease",
            "development_stage": "Preclinical",
            "sources": [],
        },
        "hard_filter": {"status": "PASS"},
        "scoring": {
            "criteria": {"target_relevance": criterion},
            "total_score": 2,
            "max_score": 21,
        },
        "competitive_analysis": {
            "competitor_table": [
                {
                    "company": "Competitor Co",
                    "competitor_asset": "COMP-1",
                    "target_or_moa": "Target-X inhibitor",
                    "modality": "Small molecule",
                    "stage": "Phase 1",
                    "similarity_level": "High",
                    "why_it_matters": "Same target and modality.",
                    "source_url": "https://example.com/competitor",
                }
            ]
        },
        "validation": validation,
        "final_insight": {
            "one_line_summary": "Fixture insight",
            "recommendation": "Watch",
        },
    }


def graph_projection(graph: dict) -> tuple[set[tuple], set[tuple]]:
    nodes = {
        (node["id"], node["label"], node["type"])
        for node in graph.get("nodes", [])
    }
    edges = {
        (edge["source"], edge["target"], edge["relationship"])
        for edge in graph.get("edges", [])
    }
    return nodes, edges


class MinimalRecordExporterCompatibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source_bytes = DATA_FILE.read_bytes()
        cls.source_sha256 = hashlib.sha256(cls.source_bytes).hexdigest()
        records = json.loads(cls.source_bytes.decode("utf-8"))
        cls.records = [minimize_record_for_dashboard_storage(record) for record in records]
        cls.addClassCleanup(cls._assert_source_file_unchanged)

    @classmethod
    def _assert_source_file_unchanged(cls) -> None:
        current = DATA_FILE.read_bytes()
        if current != cls.source_bytes:
            raise AssertionError("exporter compatibility tests changed json/pipeline-records.json bytes")
        if hashlib.sha256(current).hexdigest() != cls.source_sha256:
            raise AssertionError("exporter compatibility tests changed json/pipeline-records.json SHA-256")

    def test_both_exporters_generate_current_minimized_records_in_temporary_directories(self) -> None:
        with tempfile.TemporaryDirectory(prefix="skbp-minimal-export-") as temp_dir:
            temp = Path(temp_dir)
            compact_data = temp / "pipeline-records.json"
            compact_data.write_text(json.dumps(self.records, ensure_ascii=False), encoding="utf-8")
            obsidian_dir = temp / "obsidian"
            wiki_dir = temp / "wiki"

            with (
                patch.object(export_obsidian, "DATA_FILE", compact_data),
                patch.object(export_obsidian, "OUTPUT_DIR", obsidian_dir),
            ):
                export_obsidian.generate()

            with (
                patch.object(export_pipeline_wiki, "DATA_FILE", compact_data),
                patch.object(export_pipeline_wiki, "VAULT_DIR", wiki_dir),
            ):
                report = export_pipeline_wiki.generate()

            self.assertEqual(len(self.records), report["records"])
            self.assertEqual([], report["warnings"])
            self.assertTrue((obsidian_dir / "Pipeline_Index.md").is_file())
            self.assertTrue((obsidian_dir / "README.md").is_file())
            self.assertTrue((wiki_dir / "README.md").is_file())
            self.assertTrue((wiki_dir / "13_Graph_Exports" / "graph.json").is_file())

            expected_raw_reports: dict[str, str] = {}
            for record in self.records:
                filename, content = export_pipeline_wiki.render_raw_report(record)
                expected_raw_reports[filename] = content.rstrip() + "\n"
            for filename, expected in expected_raw_reports.items():
                with self.subTest(raw_report=filename):
                    self.assertEqual(
                        expected,
                        (wiki_dir / "01_Raw_Reports" / filename).read_text(encoding="utf-8"),
                    )

    def test_source_ids_resolve_to_same_score_output_as_embedded_legacy_sources(self) -> None:
        legacy = exporter_fixture(canonical_sources=False)
        canonical = exporter_fixture(canonical_sources=True)

        self.assertEqual(export_obsidian.score_table(legacy), export_obsidian.score_table(canonical))
        self.assertEqual(
            export_obsidian.scoring_rationale_sections(legacy),
            export_obsidian.scoring_rationale_sections(canonical),
        )

        legacy_sources = {
            (source.get("source_title"), source.get("source_url"))
            for source in export_pipeline_wiki.source_items(legacy)
        }
        canonical_sources = {
            (source.get("source_title"), source.get("source_url"))
            for source in export_pipeline_wiki.source_items(canonical)
        }
        self.assertEqual(legacy_sources, canonical_sources)
        self.assertIn(("Primary program page", "https://example.com/program"), canonical_sources)

    def test_obsidian_competitor_table_reads_hybrid_and_legacy_field_names(self) -> None:
        hybrid = exporter_fixture(canonical_sources=True)
        rendered = export_obsidian.competitive_summary(hybrid)
        self.assertIn("COMP-1", rendered)
        self.assertIn("Phase 1", rendered)
        self.assertIn("Same target and modality.", rendered)
        self.assertIn("https://example.com/competitor", rendered)

        legacy = exporter_fixture(canonical_sources=True)
        legacy["competitive_analysis"]["competitor_table"] = [
            {
                "competitor_name": "LEGACY-COMP",
                "company": "Legacy Competitor",
                "modality": "Antibody",
                "target_or_moa": "Target-Y",
                "development_stage": "Phase 2",
                "relevance_to_asset": "Legacy relevance",
                "source": "https://example.com/legacy-competitor",
            }
        ]
        legacy_rendered = export_obsidian.competitive_summary(legacy)
        self.assertIn("LEGACY-COMP", legacy_rendered)
        self.assertIn("Phase 2", legacy_rendered)
        self.assertIn("Legacy relevance", legacy_rendered)
        self.assertIn("https://example.com/legacy-competitor", legacy_rendered)

    def test_dangling_or_malformed_source_ids_degrade_without_export_failure(self) -> None:
        record = exporter_fixture(canonical_sources=True)
        criterion = record["scoring"]["criteria"]["target_relevance"]
        criterion["source_ids"] = ["SRC-PRIMARY", "MISSING", {"bad": "id"}]
        record["validation"]["source_registry"].extend([None, "bad source"])

        resolved = export_pipeline_wiki.criterion_source_items(record, criterion)
        self.assertEqual(1, len(resolved))
        self.assertEqual("Primary program page", resolved[0]["source_title"])
        self.assertIn("Primary program page", export_obsidian.score_table(record))

    def test_registry_title_url_aliases_are_normalized_for_both_exporters(self) -> None:
        record = exporter_fixture(canonical_sources=True)
        record["validation"]["source_registry"] = [
            {
                "id": "SRC-PRIMARY",
                "title": "Aliased primary page",
                "url": "https://example.com/aliased-program",
                "type": "primary",
            }
        ]

        self.assertIn("Aliased primary page", export_obsidian.score_table(record))
        sources = export_pipeline_wiki.source_items(record)
        self.assertIn(
            ("Aliased primary page", "https://example.com/aliased-program", "primary"),
            {
                (source.get("source_title"), source.get("source_url"), source.get("source_type"))
                for source in sources
            },
        )

    def test_legacy_and_canonical_source_graphs_have_exact_node_edge_parity(self) -> None:
        graphs: dict[str, dict] = {}
        reports: dict[str, dict] = {}
        with tempfile.TemporaryDirectory(prefix="skbp-source-parity-") as temp_dir:
            root = Path(temp_dir)
            for name, record in (
                ("legacy", exporter_fixture(canonical_sources=False)),
                ("canonical", exporter_fixture(canonical_sources=True)),
            ):
                case_dir = root / name
                case_dir.mkdir()
                data_file = case_dir / "pipeline-records.json"
                data_file.write_text(json.dumps([record], ensure_ascii=False), encoding="utf-8")
                vault_dir = case_dir / "wiki"
                with (
                    patch.object(export_pipeline_wiki, "DATA_FILE", data_file),
                    patch.object(export_pipeline_wiki, "VAULT_DIR", vault_dir),
                ):
                    reports[name] = export_pipeline_wiki.generate()
                graphs[name] = json.loads(
                    (vault_dir / "13_Graph_Exports" / "graph.json").read_text(encoding="utf-8")
                )

        self.assertEqual(graph_projection(graphs["legacy"]), graph_projection(graphs["canonical"]))
        self.assertEqual(12, reports["legacy"]["nodes"])
        self.assertEqual(13, reports["legacy"]["edges"])
        self.assertEqual(reports["legacy"]["nodes"], reports["canonical"]["nodes"])
        self.assertEqual(reports["legacy"]["edges"], reports["canonical"]["edges"])

    def test_full_legacy_dataset_and_checked_in_hybrid_have_exact_graph_parity(self) -> None:
        legacy_bytes = subprocess.run(
            ["git", "show", f"{LEGACY_GIT_REF}:json/pipeline-records.json"],
            cwd=ROOT,
            check=True,
            capture_output=True,
        ).stdout
        datasets = {
            "legacy": json.loads(legacy_bytes.decode("utf-8")),
            "hybrid": json.loads(self.source_bytes.decode("utf-8")),
        }
        graphs: dict[str, dict] = {}
        reports: dict[str, dict] = {}
        with tempfile.TemporaryDirectory(prefix="skbp-full-graph-parity-") as temp_dir:
            root = Path(temp_dir)
            for name, records in datasets.items():
                case_dir = root / name
                case_dir.mkdir()
                data_file = case_dir / "pipeline-records.json"
                data_file.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
                vault_dir = case_dir / "wiki"
                with (
                    patch.object(export_pipeline_wiki, "DATA_FILE", data_file),
                    patch.object(export_pipeline_wiki, "VAULT_DIR", vault_dir),
                ):
                    reports[name] = export_pipeline_wiki.generate()
                graphs[name] = json.loads(
                    (vault_dir / "13_Graph_Exports" / "graph.json").read_text(encoding="utf-8")
                )

        self.assertEqual(graph_projection(graphs["legacy"]), graph_projection(graphs["hybrid"]))
        self.assertEqual(reports["legacy"]["nodes"], reports["hybrid"]["nodes"])
        self.assertEqual(reports["legacy"]["edges"], reports["hybrid"]["edges"])
        for node_type in ("competitor", "source"):
            legacy_nodes = {node["id"] for node in graphs["legacy"]["nodes"] if node.get("type") == node_type}
            hybrid_nodes = {node["id"] for node in graphs["hybrid"]["nodes"] if node.get("type") == node_type}
            self.assertEqual(legacy_nodes, hybrid_nodes)


if __name__ == "__main__":
    unittest.main()
