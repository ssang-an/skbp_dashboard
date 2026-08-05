import json
import copy
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

    def parse_combined(self, value: str) -> dict:
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        start = app_js.index("function isInputObject")
        end = app_js.index("function fastTriageMarkdownStatusRows", start)
        snippet = app_js[start:end]
        module_uri = (ROOT / "src" / "combined-ingestion.js").resolve().as_uri()
        script = f"""
          import {{ splitAtRecoverableJsonSeparator }} from {json.dumps(module_uri)};
          {snippet}
          process.stdout.write(JSON.stringify(splitCombinedGptResponse({json.dumps(value, ensure_ascii=False)})));
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
            "assessment_method": "insufficient_evidence",
            "score_basis_type": "insufficient_evidence",
            "calculation_status": "not_performed",
            "assessed_global_peak_sales_musd": None,
            "calculated_global_obtainable_peak_sales_musd": None,
            "external_normalized_global_peak_sales_musd": None,
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

    def test_parser_recovers_inner_json_fence_duplicate_separator_and_trailing_prose(self):
        combined = """```text
# Report
--- JSON DATA ---
format reminder
--- JSON DATA ---
```json
{"meta":{"review_type":"full_scout"}}
```
답변이 끝났습니다.
```"""
        parsed = self.parse_combined(combined)
        self.assertEqual(parsed["payload"]["meta"]["review_type"], "full_scout")
        self.assertEqual(parsed["errors"], [])
        self.assertGreaterEqual(len(parsed["warnings"]), 2)
        self.assertEqual(parsed["jsonText"], '{"meta":{"review_type":"full_scout"}}')

    def test_parser_rejects_two_top_level_json_values(self):
        parsed = self.parse_combined("# Report\n--- JSON DATA ---\n{\"a\":1}\n{\"b\":2}")
        self.assertIsNone(parsed["payload"])
        self.assertTrue(any("JSON" in issue["path"] for issue in parsed["errors"]))

    def test_parser_repairs_only_safe_json_syntax_variants(self):
        recoverable = {
            "object trailing comma": '# Report\n--- JSON DATA ---\n{"meta":{"review_type":"full_scout",},}',
            "array trailing comma": '# Report\n--- JSON DATA ---\n[{"meta":{"review_type":"fast_triage"}},]',
            "raw newline in string": '# Report\n--- JSON DATA ---\n{"note":"line one\nline two"}',
            "raw tab in string": '# Report\n--- JSON DATA ---\n{"note":"left\tright"}',
            "inner fence": '# Report\n--- JSON DATA ---\n```json\n{"ok":true}\n```',
            "trailing prose": '# Report\n--- JSON DATA ---\n{"ok":true}\n완료했습니다.',
            "quoted numeric": '# Report\n--- JSON DATA ---\n{"score":"2"}',
        }
        for label, value in recoverable.items():
            with self.subTest(label=label):
                parsed = self.parse_combined(value)
                self.assertEqual(parsed["errors"], [])
                self.assertIsNotNone(parsed["payload"])

        blocked = {
            "truncated": '# Report\n--- JSON DATA ---\n{"meta":{"review_type":"full_scout"}',
            "single quotes": "# Report\n--- JSON DATA ---\n{'ok': true}",
            "missing comma": '# Report\n--- JSON DATA ---\n{"a":1 "b":2}',
            "two roots": '# Report\n--- JSON DATA ---\n{"a":1}\n{"b":2}',
            "prose then second root": '# Report\n--- JSON DATA ---\n{"a":1}\n완료\n{"b":2}',
            "inline prose then second root": '# Report\n--- JSON DATA ---\n{"a":1}\n완료 {"b":2}',
        }
        for label, value in blocked.items():
            with self.subTest(label=label):
                parsed = self.parse_combined(value)
                self.assertIsNone(parsed["payload"])
                self.assertTrue(parsed["errors"])

    def test_parser_common_format_matrix(self):
        module_uri = (ROOT / "src" / "combined-ingestion.js").resolve().as_uri()
        script = """
          import { splitAtRecoverableJsonSeparator } from __MODULE__;
          const separators = ['--- JSON DATA ---', '   --- JSON DATA ---', '--- json data ---', '---   JSON   DATA   ---'];
          let accepted = 0;
          let total = 0;
          for (const separator of separators) {
            for (let mask = 0; mask < 64; mask += 1) {
              const outerFence = Boolean(mask & 1);
              const innerFence = Boolean(mask & 2);
              const trailingComma = Boolean(mask & 4);
              const rawControl = Boolean(mask & 8);
              const trailingProse = Boolean(mask & 16);
              const duplicateReminder = Boolean(mask & 32);
              let jsonText = rawControl
                ? '{"note":"line one\\nline two\\tvalue","score":2}'
                : '{"note":"ok","score":2}';
              if (trailingComma) jsonText = jsonText.replace(/}$/, ',}');
              let suffix = innerFence ? '```json\\n' + jsonText + '\\n```' : jsonText;
              if (trailingProse) suffix += '\\n완료했습니다.';
              let body = '# Report\\n';
              if (duplicateReminder) body += '--- JSON DATA ---\\nformat reminder\\n';
              body += separator + '\\n' + suffix;
              const input = outerFence ? '```text\\n' + body + '\\n```' : body;
              const parsed = splitAtRecoverableJsonSeparator(input);
              total += 1;
              if (parsed?.parsedSuffix?.payload?.score === 2) accepted += 1;
            }
          }
          const blockedInputs = [
            '# Report\\n--- JSON DATA ---\\n{"a":1,"a":2}',
            '# Report\\n--- JSON DATA ---\\n{"a":1 "b":2}',
            '# Report\\n--- JSON DATA ---\\n{"a":1',
            '# Report\\n--- JSON DATA ---\\n{"a":1} done {"b":2}',
            '# Report\\n--- JSON DATA ---\\n{"sample":true}\\n--- JSON DATA ---\\n{"actual":'
          ];
          const blocked = blockedInputs.filter((input) => !splitAtRecoverableJsonSeparator(input)?.parsedSuffix).length;
          process.stdout.write(JSON.stringify({ accepted, total, blocked, blockedTotal: blockedInputs.length }));
        """.replace("__MODULE__", json.dumps(module_uri))
        result = subprocess.run(
            [shutil.which("node"), "--input-type=module"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            input=script,
            text=True,
            encoding="utf-8",
        )
        summary = json.loads(result.stdout)
        self.assertEqual(summary["accepted"], summary["total"])
        self.assertEqual(summary["total"], 256)
        self.assertEqual(summary["blocked"], summary["blockedTotal"])

    def test_parser_accepts_separator_cosmetics_but_rejects_ambiguous_or_excessive_input(self):
        for separator in ("   --- JSON DATA ---", "--- json data ---", "---   JSON   DATA   ---"):
            with self.subTest(separator=separator):
                parsed = self.parse_combined(f"# Report\n{separator}\n{{\"ok\":true}}")
                self.assertEqual(parsed["errors"], [])
                self.assertTrue(parsed["payload"]["ok"])

        duplicate_key = self.parse_combined(
            '# Report\n--- JSON DATA ---\n{"outer":{"score":1,"score":3}}'
        )
        self.assertIsNone(duplicate_key["payload"])
        self.assertTrue(any("중복 JSON key" in issue["message"] for issue in duplicate_key["errors"]))

        last_separator_wins = self.parse_combined(
            '# Report\n--- JSON DATA ---\n{"sample":true}\n--- JSON DATA ---\n{"actual":'
        )
        self.assertIsNone(last_separator_wins["payload"])
        self.assertTrue(last_separator_wins["errors"])

        too_deep = self.parse_combined(
            "# Report\n--- JSON DATA ---\n" + "[" * 81 + "0" + "]" * 81
        )
        self.assertIsNone(too_deep["payload"])
        self.assertTrue(any("중첩 깊이" in issue["message"] for issue in too_deep["errors"]))

        too_large = self.parse_combined(
            "# Report\n--- JSON DATA ---\n{\"text\":\"" + "x" * 2_000_001 + "\"}"
        )
        self.assertIsNone(too_large["payload"])
        self.assertTrue(any("초과" in issue["message"] for issue in too_large["errors"]))

        excessive_trailing_prose = self.parse_combined(
            "# Report\n--- JSON DATA ---\n{\"ok\":true}\n" + "설" * 4_001
        )
        self.assertIsNone(excessive_trailing_prose["payload"])
        self.assertTrue(any("무시 가능한 설명" in issue["message"] for issue in excessive_trailing_prose["errors"]))

    def test_compact_marketability_normalizes_plain_numeric_strings(self):
        compact = {
            "meta": {"ingestion_format": "compact_v1", "review_type": "full_scout"},
            "scoring": {"criteria": {"marketability": {
                "score": "2",
                "assessment_method": "external_forecast",
                "score_basis_type": "external_forecast",
                "calculation_status": "not_performed",
                "assessed_global_peak_sales_musd": "1,500",
                "calculated_global_obtainable_peak_sales_musd": None,
                "external_normalized_global_peak_sales_musd": "1500",
                "external_forecast_source_ids": ["S1"],
                "calculation": {
                    "commercial_rationale_status": "evidence_based",
                    "commercial_rationale_failure_reason": "",
                    "A_targetable_addressable_patient": {"targetable_addressable_patient": None},
                    "B_unrisked_peak_sales": {"unrisked_peak_sales": None},
                    "C_obtainable_peak_sales": {"obtainable_peak_sales": None},
                },
            }}},
        }
        market = self.expand(compact, "full")["scoring"]["criteria"]["marketability"]
        self.assertEqual(market["score"], 2)
        self.assertEqual(market["assessed_global_peak_sales_musd"], 1500)
        self.assertEqual(market["external_normalized_global_peak_sales_musd"], 1500)
        main.validate_marketability(market, require_method=True)

        missing_forecast_source = copy.deepcopy(market)
        missing_forecast_source["external_forecast_source_ids"] = []
        with self.assertRaises(Exception):
            main.validate_marketability(missing_forecast_source, require_method=True)

        inconsistent = copy.deepcopy(market)
        inconsistent["score"] = 3
        with self.assertRaises(Exception):
            main.validate_marketability(inconsistent)

        insufficient_status_with_forecast = copy.deepcopy(market)
        insufficient_status_with_forecast["calculation"]["commercial_rationale_status"] = "insufficient_evidence"
        insufficient_status_with_forecast["calculation"]["commercial_rationale_failure_reason"] = "Conflicting state."
        with self.assertRaises(Exception):
            main.validate_marketability(insufficient_status_with_forecast)

        established_status_without_method = copy.deepcopy(market)
        established_status_without_method.update({
            "score": 0,
            "assessment_method": "insufficient_evidence",
            "score_basis_type": "insufficient_evidence",
            "assessed_global_peak_sales_musd": None,
            "external_normalized_global_peak_sales_musd": None,
        })
        established_status_without_method["calculation"]["commercial_rationale_status"] = "established"
        with self.assertRaises(Exception):
            main.validate_marketability(established_status_without_method)

    def test_fastapi_boundary_rejects_duplicate_or_dangling_sources_and_boolean_scores(self):
        duplicate_sources = {
            "meta": {"ingestion_format": "compact_v1"},
            "validation": {"source_registry": [{"source_id": "S1"}, {"source_id": "S1"}]},
        }
        with self.assertRaises(Exception):
            main.validate_compact_source_references(duplicate_sources, 0)

        dangling_source = {
            "meta": {"ingestion_format": "compact_v1"},
            "validation": {"source_registry": [{"source_id": "S1"}]},
            "scoring": {"criteria": {"target_relevance": {"source_ids": ["S2"]}}},
        }
        with self.assertRaises(Exception):
            main.validate_compact_source_references(dangling_source, 0)

        typed_record = {
            "meta": {},
            "structured_table": {},
            "hard_filter": {},
            "scoring": {
                "total_score": 1,
                "max_score": 9,
                "criteria": {"target_relevance": {"score": True}},
            },
        }
        with self.assertRaises(Exception):
            main.validate_typed_ingestion_contract(typed_record, 0)

    def test_home_and_detail_use_fastapi_preflight_before_save(self):
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        detail_js = (ROOT / "src" / "detail.js").read_text(encoding="utf-8")
        main_py = (ROOT / "main.py").read_text(encoding="utf-8")
        self.assertIn("fetch('/api/records/validate'", app_js)
        self.assertIn("fetch('/api/records/validate'", detail_js)
        self.assertIn('@app.post("/api/records/validate")', main_py)
        self.assertIn("validate_records_for_save(incoming)", main_py)

    def test_rendered_instructions_emit_valid_compact_templates(self):
        prompts = self.rendered_prompts()
        self.assertEqual(prompts["triage"].count("--- JSON DATA ---"), 1)
        self.assertEqual(prompts["full"].count("--- JSON DATA ---"), 1)
        self.assertNotIn("source_report", prompts["triage"])
        self.assertNotIn("source_report", prompts["full"])
        triage = self.final_json_template(prompts["triage"], "\nRemember:")
        full = self.final_json_template(prompts["full"], "\nFinal validation before output:")
        self.assertIsInstance(triage, list)
        self.assertEqual(triage[0]["meta"]["ingestion_format"], "compact_v1")
        self.assertNotIn("source_report", triage[0])
        self.assertNotIn("input", triage[0])
        self.assertEqual(full["meta"]["ingestion_format"], "compact_v1")
        self.assertNotIn("input", full)
        self.assertNotIn("obsidian", full)
        self.assertNotIn("source_report", full)
        self.assertIn("source_registry", full["validation"])
        self.assertIn("source_ids", full["scoring"]["criteria"]["target_relevance"])
        self.assertNotIn("schema_version", full["meta"])
        self.assertNotIn("instruction_version", full["meta"])
        self.assertNotIn("evidence_type_reason", full["scoring"]["criteria"]["target_relevance"])
        self.assertNotIn("investigation_note", full["scoring"]["criteria"]["target_relevance"])
        self.assertNotIn("what_was_checked", full["scoring"]["criteria"]["target_relevance"])
        self.assertNotIn(
            "A_targetable_addressable_patient",
            full["scoring"]["criteria"]["marketability"]["calculation"],
        )


if __name__ == "__main__":
    unittest.main()
