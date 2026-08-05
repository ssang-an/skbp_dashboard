import json
import shutil
import subprocess
import unittest
from pathlib import Path

import main


ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which("node"), "Node.js is required for compact-ingestion module tests")
class CompactIngestionTests(unittest.TestCase):
    @classmethod
    def rendered_prompts(cls) -> dict[str, str]:
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        start = app_js.index("const SHARED_EVIDENCE_DISCIPLINE")
        end = app_js.index("async function copyPromptToClipboard", start)
        snippet = app_js[start:end]
        script = f"""
          {snippet}
          process.stdout.write(JSON.stringify({{
            triage: buildTriageInstructionPrompt(),
            full: buildGptInstructionPrompt()
          }}));
        """
        result = subprocess.run(
            [shutil.which("node"), "--input-type=module"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            input=script,
            text=True,
            encoding="utf-8",
        )
        return json.loads(result.stdout)

    @staticmethod
    def final_json_template(prompt: str, final_marker: str):
        template_end = prompt.rfind(final_marker)
        template_start = prompt.rfind("\n--- JSON DATA ---", 0, template_end)
        fenced = prompt[template_start + len("\n--- JSON DATA ---"):template_end]
        json_text = fenced.rsplit("```", 1)[0].strip()
        return json.loads(json_text)

    def expand(self, record: dict, mode: str) -> dict:
        module_uri = (ROOT / "src" / "compact-ingestion.js").resolve().as_uri()
        script = f"""
          import {{ expandCompactInputRecord }} from {json.dumps(module_uri)};
          const record = {json.dumps(record, ensure_ascii=False)};
          process.stdout.write(JSON.stringify(expandCompactInputRecord(record, {json.dumps(mode)})));
        """
        result = subprocess.run(
            [shutil.which("node"), "--input-type=module", "--eval", script],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        return json.loads(result.stdout)

    def test_triage_compact_record_expands_to_existing_dashboard_shape(self):
        criterion = {
            "score": 1,
            "evidence_basis": "public_source",
            "main_line_summary": "TR 1점: verified summary.",
            "source_ids": ["S1"],
            "uncertain_points": [],
        }
        compact = {
            "meta": {"ingestion_format": "compact_v1", "review_type": "fast_triage"},
            "structured_table": {"company": "Test Co", "asset_name": "T-1", "development_stage": "Unknown"},
            "hard_filter": {"status": "REJECT", "reason": "Insufficient priority evidence.", "flags": []},
            "triage": {"status": "REJECT", "identity_verified": True, "active_asset": None},
            "scoring": {"criteria": {
                "target_relevance": criterion,
                "moa_validity": {**criterion, "main_line_summary": "MOA 1점: verified summary."},
                "data_maturity": {**criterion, "main_line_summary": "Data 1점: verified summary."},
            }},
            "validation": {"source_registry": [{
                "source_id": "S1", "source_title": "Official", "source_type": "official_company",
                "source_url": "https://example.com/source", "verified": True, "evidence_summary": "Supports identity."
            }]},
            "final_insight": {"recommendation": "Do not run Full Scout"},
        }
        expanded = self.expand(compact, "triage")
        self.assertEqual(expanded["scoring"]["total_score"], 3)
        self.assertEqual(expanded["scoring"]["max_score"], 9)
        self.assertEqual(expanded["input"]["asset_input"], "T-1")
        self.assertEqual(expanded["json_summary"]["company"], "Test Co")
        self.assertEqual(expanded["structured_table"]["sources"][0]["source_id"], "S1")
        self.assertEqual(
            expanded["scoring"]["criteria"]["target_relevance"]["evidence_sources"][0]["source_url"],
            "https://example.com/source",
        )
        main.validate_records_for_save([expanded])

    def test_full_compact_record_preserves_meaningful_fields_and_fills_boilerplate(self):
        criterion_ids = [
            "target_relevance", "competitive_landscape", "moa_validity", "platform_attractiveness",
            "expansion_potential", "data_maturity",
        ]
        criteria = {
            criterion_id: {
                "score": 2,
                "evidence_type": "E2_indirect_or_class_level_evidence",
                "main_line_summary": f"{criterion_id} summary",
                "source_ids": ["S1"],
                "why_not_higher": "Needs stronger evidence.",
                "uncertain_points": [],
            }
            for criterion_id in criterion_ids
        }
        criteria["marketability"] = {
            "score": 0,
            "evidence_type": "E0_not_found_or_not_assessable",
            "main_line_summary": "No reliable forecast.",
            "source_ids": [],
            "why_not_higher": "No commercial basis.",
            "uncertain_points": [],
            "calculation": {
                "commercial_rationale_status": "insufficient_evidence",
                "commercial_rationale_failure_reason": "No reliable inputs.",
                "A_targetable_addressable_patient": {"targetable_addressable_patient": None},
                "B_unrisked_peak_sales": {"unrisked_peak_sales": None},
                "C_obtainable_peak_sales": {"obtainable_peak_sales": None},
            },
        }
        compact = {
            "meta": {"ingestion_format": "compact_v1", "review_type": "full_scout"},
            "company_profile": {"company_name": "Test Co", "platform_summary": "Reusable platform"},
            "structured_table": {"company": "Test Co", "asset_name": "F-1", "development_stage": "Preclinical Candidate"},
            "hard_filter": {"status": "REVIEW", "reason": "Additional evidence required.", "flags": []},
            "scoring": {"criteria": criteria},
            "competitive_analysis": {
                "competitive_density": "Medium",
                "competitor_table": [{"asset": "C-1", "source_ids": ["S1"]}],
            },
            "validation": {"source_registry": [{
                "source_id": "S1", "source_title": "Paper", "source_type": "peer_reviewed",
                "source_url": "https://example.org/paper", "verified": True, "evidence_summary": "Class evidence."
            }]},
            "final_insight": {"one_line_summary": "Review candidate.", "recommendation": "Further diligence"},
        }
        expanded = self.expand(compact, "full")
        self.assertEqual(expanded["scoring"]["total_score"], 12)
        self.assertEqual(expanded["scoring"]["max_score"], 21)
        self.assertEqual(expanded["company_profile"]["platform_summary"], "Reusable platform")
        self.assertIn("aliases", expanded["company_profile"])
        self.assertIn("similarity_summary", expanded["competitive_analysis"])
        self.assertEqual(expanded["obsidian"]["note_title"], "Test Co F-1")
        target = expanded["scoring"]["criteria"]["target_relevance"]
        self.assertEqual(target["evidence_sources"][0]["source_id"], "S1")
        self.assertEqual(target["evidence_trail"], ["Class evidence."])
        competitor = expanded["competitive_analysis"]["competitor_table"][0]
        self.assertEqual(competitor["source_url"], "https://example.org/paper")
        self.assertEqual(competitor["evidence_sources"][0]["source_id"], "S1")
        self.assertTrue(expanded["scoring"]["criteria"]["marketability"]["calculation"]["A_targetable_addressable_patient"]["formula"])
        main.validate_records_for_save([expanded])

    def test_verbose_record_is_left_unchanged(self):
        verbose = {"meta": {"review_type": "full_scout"}, "custom": {"keep": True}}
        self.assertEqual(self.expand(verbose, "full"), verbose)

    def test_rendered_instructions_emit_valid_compact_templates(self):
        prompts = self.rendered_prompts()
        triage = self.final_json_template(prompts["triage"], "\nRemember:")
        full = self.final_json_template(prompts["full"], "\nFinal validation before output:")
        self.assertIsInstance(triage, list)
        self.assertEqual(triage[0]["meta"]["ingestion_format"], "compact_v1")
        self.assertNotIn("source_report", triage[0])
        self.assertNotIn("input", triage[0])
        self.assertEqual(full["meta"]["ingestion_format"], "compact_v1")
        self.assertNotIn("input", full)
        self.assertNotIn("obsidian", full)
        self.assertNotIn("raw_markdown", full["source_report"])
        self.assertIn("source_registry", full["validation"])
        self.assertIn("source_ids", full["scoring"]["criteria"]["target_relevance"])


if __name__ == "__main__":
    unittest.main()
