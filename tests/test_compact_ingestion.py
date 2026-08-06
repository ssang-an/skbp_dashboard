import json
import copy
import shutil
import subprocess
import unittest
from pathlib import Path

from fastapi import HTTPException

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

    def test_route_qualified_modality_is_canonicalized_during_expansion(self):
        compact = {
            "meta": {"ingestion_format": "compact_v2", "review_type": "full_scout"},
            "input": {"company_input": "NeuShen Therapeutics", "asset_input": "NS-041"},
            "structured_table": {
                "company": "NeuShen Therapeutics",
                "asset_name": "NS-041",
                "modality_platform": "Oral small-molecule / tablet; CNS discovery platform",
                "development_stage": "Phase 2",
            },
            "scoring": {"criteria": {}},
        }
        expanded = self.expand(compact, "full")
        self.assertEqual(expanded["structured_table"]["modality_platform"], "Small molecule")

    def test_both_prompts_explain_route_qualified_modality_canonicalization(self):
        prompts = self.rendered_prompts()
        dictionary = json.loads(
            (ROOT / "config" / "category-synonyms.json").read_text(encoding="utf-8")
        )
        for mode, prompt in prompts.items():
            with self.subTest(mode=mode):
                self.assertIn('"oral small-molecule / tablet"', prompt)
                self.assertIn('"small-molecule CNS discovery platform" -> Small molecule', prompt)
                self.assertIn('"IV antibody" -> Antibody', prompt)
                self.assertIn('"topical peptide" -> Peptide', prompt)
                self.assertIn('"FOS Phase II recruiting; pain stage unclear" -> Phase 2', prompt)
                self.assertIn('"China / United States operations" -> China', prompt)
                self.assertIn('"Lead disclosed indication: inflammatory bowel disease; expansion potential for MS" -> Inflammatory bowel disease', prompt)
                self.assertIn("main_indication is mandatory", prompt)
                self.assertIn("single most advanced confirmed active clinical program", prompt)
                self.assertIn("Never select an indication merely because it appears first", prompt)
                self.assertIn('"CNS hypotheses include stroke and status epilepticus; no official lead or active trial" -> Unknown', prompt)
                self.assertIn("Protein Homeostasis", prompt)
                self.assertIn("The mere presence of protein aggregates in a disease does not establish this Theme", prompt)
                self.assertIn('use cluster="Unknown" for this Theme', prompt)
                for entry in dictionary["indication"]:
                    self.assertIn(entry["canonical"], prompt)

    def test_new_compact_v2_rejects_blank_main_indication(self):
        full = self.final_json_template(
            self.rendered_prompts()["full"],
            "\nFinal validation before output:",
        )
        full["structured_table"]["main_indication"] = ""
        with self.assertRaises(HTTPException) as caught:
            main.validate_records_for_save([full])
        self.assertIn("main_indication", str(caught.exception.detail))
        self.assertIn("Unknown", str(caught.exception.detail))

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

    def test_hybrid_v2_resolves_canonical_source_ids_without_duplicating_prompt_sources(self):
        full = self.final_json_template(
            self.rendered_prompts()["full"],
            "\nFinal validation before output:",
        )
        full["input"] = {"company_input": "Test Co", "asset_input": "H-1"}
        full["structured_table"].update({
            "company": "Test Co",
            "asset_name": "H-1",
            "target": "Target A",
            "moa": "Modulates Target A",
            "main_indication": "Unknown",
            "indication": "Unknown",
        })
        full["validation"]["source_registry"] = [{
            "source_id": "S1",
            "source_title": "Official pipeline",
            "source_url": "https://example.com/pipeline",
            "source_type": "official_company",
            "verified": True,
        }]
        target = full["scoring"]["criteria"]["target_relevance"]
        target.update({
            "evidence_type": "E1_company_claim_or_scientific_rationale_only",
            "evidence_type_reason": "Official pipeline claim.",
            "evidence_basis": "public_source",
            "main_line_summary": "Target A is listed for the asset.",
            "why_not_higher": "No independent validation.",
            "investigation_note": "Confirm target biology.",
            "source_ids": ["S1"],
        })
        full["competitive_analysis"]["competitor_table"] = [{
            "competitor_asset": "C-1",
            "company": "Competitor Co",
            "modality": "Small molecule",
            "target_or_moa": "Target A",
            "stage": "Preclinical Candidate",
            "similarity_level": "High",
            "why_it_matters": "Same target and indication.",
            "source_url": "https://example.com/pipeline",
            "source_ids": ["S1"],
        }]

        self.assertNotIn("evidence_sources", target)
        expanded = self.expand(full, "full")
        expanded_target = expanded["scoring"]["criteria"]["target_relevance"]
        self.assertEqual(expanded_target["source_ids"], ["S1"])
        self.assertNotIn("evidence_sources", expanded_target)
        self.assertEqual(
            expanded["validation"]["source_registry"][0]["source_url"],
            "https://example.com/pipeline",
        )
        self.assertEqual(
            expanded["competitive_analysis"]["competitor_table"][0]["source_ids"],
            ["S1"],
        )
        main.validate_records_for_save([expanded])

        duplicate = copy.deepcopy(full)
        duplicate["validation"]["source_registry"].append(
            copy.deepcopy(duplicate["validation"]["source_registry"][0])
        )
        with self.assertRaises(Exception):
            main.validate_records_for_save([self.expand(duplicate, "full")])

        dangling = copy.deepcopy(full)
        dangling["scoring"]["criteria"]["target_relevance"]["source_ids"] = ["S404"]
        with self.assertRaises(Exception):
            main.validate_records_for_save([self.expand(dangling, "full")])

    def test_v2_expansion_ignores_extra_keys_and_resolves_primary_source_id(self):
        full = self.final_json_template(
            self.rendered_prompts()["full"],
            "\nFinal validation before output:",
        )
        full["input"] = {"company_input": "Test Co", "asset_input": "SAFE-1"}
        full["structured_table"].update({
            "company": "Test Co",
            "asset_name": "SAFE-1",
            "sources": ["S1"],
            "unsupported_table_detail": "ignore me",
        })
        full["unsupported_research_section"] = {"verbose": True}
        source = {
            "source_id": "S1",
            "source_title": "Official source",
            "source_url": "https://example.com/official",
            "source_type": "official_company",
            "verified": True,
        }
        full["validation"]["source_registry"] = [source]
        target = full["scoring"]["criteria"]["target_relevance"]
        target["source_ids"] = ["S1"]
        target["evidence_sources"] = [{**source, "research_only_note": "ignore me"}]
        target["research_only_object"] = {"verbose": True}

        expanded = self.expand(full, "full")
        self.assertNotIn("unsupported_research_section", expanded)
        self.assertNotIn("unsupported_table_detail", expanded["structured_table"])
        self.assertNotIn("evidence_sources", expanded["scoring"]["criteria"]["target_relevance"])
        self.assertNotIn("research_only_object", expanded["scoring"]["criteria"]["target_relevance"])
        self.assertEqual(
            expanded["structured_table"]["sources"],
            [{"source_title": "Official source", "source_url": "https://example.com/official"}],
        )
        main.validate_records_for_save([expanded])

    def test_compact_type_preflight_accepts_v1_without_input_but_keeps_v2_strict(self):
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        start = app_js.index("function validateCompactInputTypes")
        end = app_js.index("function hasMarketabilityAbcdExplanation", start)
        snippet = app_js[start:end]
        module_uri = (ROOT / "src" / "compact-ingestion.js").resolve().as_uri()
        script = f"""
          import {{ isCompactIngestionRecord, isMinimalCompactIngestionRecord }} from {json.dumps(module_uri)};
          function isInputObject(value) {{
            return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
          }}
          function addInputIssue(issues, level, path, message) {{
            issues.push({{ level, path, message }});
          }}
          {snippet}
          const base = {{
            structured_table: {{ company: 'Legacy Co', asset_name: 'LEG-1' }},
            hard_filter: {{}}, scoring: {{ criteria: {{}} }}, validation: {{}}, final_insight: {{}}
          }};
          const v1Issues = [];
          validateCompactInputTypes(
            {{ ...base, meta: {{ ingestion_format: 'compact_v1', review_type: 'full_scout' }} }},
            'record[0]',
            v1Issues
          );
          const invalidV1Issues = [];
          validateCompactInputTypes(
            {{ ...base, meta: {{ ingestion_format: 'compact_v1' }}, input: [] }},
            'record[0]',
            invalidV1Issues
          );
          const v2Issues = [];
          validateCompactInputTypes(
            {{ ...base, meta: {{ ingestion_format: 'compact_v2', review_type: 'full_scout' }} }},
            'record[0]',
            v2Issues
          );
          process.stdout.write(JSON.stringify({{ v1Issues, invalidV1Issues, v2Issues }}));
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
        payload = json.loads(result.stdout)
        self.assertFalse(any(issue["path"].endswith(".input") for issue in payload["v1Issues"]))
        self.assertTrue(any(issue["path"].endswith(".input") for issue in payload["invalidV1Issues"]))
        self.assertTrue(any(issue["path"].endswith(".input") for issue in payload["v2Issues"]))

    def test_marketability_markdown_detection_requires_abcd_labels(self):
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        start = app_js.index("function hasMarketabilityAbcdExplanation")
        end = app_js.index("function validateCombinedInput", start)
        snippet = app_js[start:end]
        script = f"""
          {snippet}
          const us = '| **A. US TAP** | x |\\n| **B. US Unrisked Peak Sales** | y |\\n| **C. US Obtainable Peak Sales** | z |\\n| **D. Global Obtainable Peak Sales** | z x 1.5 |';
          const global = 'A. Global TAP\\nB. Global Unrisked Peak Sales\\nC. Global Obtainable Peak Sales\\nD. Global Obtainable Peak Sales';
          const incomplete = 'A. US TAP\\nB. US Unrisked Peak Sales\\nC. US Obtainable Peak Sales';
          process.stdout.write(JSON.stringify({{
            us: hasMarketabilityAbcdExplanation(us),
            global: hasMarketabilityAbcdExplanation(global),
            incomplete: hasMarketabilityAbcdExplanation(incomplete)
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
        payload = json.loads(result.stdout)
        self.assertTrue(payload["us"])
        self.assertTrue(payload["global"])
        self.assertFalse(payload["incomplete"])

    def test_verbose_record_is_left_unchanged(self):
        verbose = {"meta": {"review_type": "full_scout"}, "custom": {"keep": True}}
        self.assertEqual(self.expand(verbose, "full"), verbose)

    def test_home_hover_resolves_hybrid_source_ids_and_tolerates_malformed_fields(self):
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        start = app_js.index("function evidenceSourceUrl")
        end = app_js.index("function collectHardFilterNotes", start)
        snippet = app_js[start:end]
        script = f"""
          function get(value, path, fallback) {{
            let current = value;
            for (const part of path.split('.')) {{
              if (!current || typeof current !== 'object' || !(part in current)) return fallback;
              current = current[part];
            }}
            return current;
          }}
          function number(value) {{
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
          }}
          function isCurrentFastTriageContract() {{ return false; }}
          {snippet}
          const record = {{
            meta: {{ rubric_version: '3.3' }},
            scoring: {{ criteria: {{ target_relevance: {{
              score: 2,
              main_line_summary: 'Hybrid hover summary',
              source_ids: ['S1']
            }} }} }},
            validation: {{ source_registry: [{{
              source_id: 'S1',
              source_title: 'Official source',
              source_url: 'https://example.com/source',
              evidence_summary: 'Supports target identity.'
            }}] }}
          }};
          const hybrid = criterion(record, 'target_relevance');
          const malformed = criterion({{
            scoring: {{ criteria: {{ target_relevance: 'wrong-type' }} }},
            validation: {{ source_registry: 'wrong-type' }},
            rubric: {{ target_relevance: [] }}
          }}, 'target_relevance');
          process.stdout.write(JSON.stringify({{ hybrid, malformed }}));
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
        payload = json.loads(result.stdout)
        self.assertEqual(payload["hybrid"]["mainLineSummary"], "Hybrid hover summary")
        self.assertEqual(payload["hybrid"]["evidenceSources"][0]["source_id"], "S1")
        self.assertIn("Supports target identity.", payload["hybrid"]["supportingEvidenceSummary"])
        self.assertEqual(payload["malformed"]["evidenceSources"], [])
        self.assertEqual(payload["malformed"]["mainLineSummary"], "-")

    def test_frontend_preflight_rejects_v2_duplicate_and_dangling_source_ids(self):
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        start = app_js.index("function validateCompactSourceReferences")
        end = app_js.index("function validateCompactInputTypes", start)
        snippet = app_js[start:end]
        script = f"""
          function isCompactIngestionRecord() {{ return true; }}
          function isInputObject(value) {{
            return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
          }}
          function addInputIssue(issues, level, path, message) {{
            issues.push({{ level, path, message }});
          }}
          {snippet}
          const duplicate = {{
            validation: {{ source_registry: [{{ source_id: 'S1' }}, {{ source_id: 'S1' }}] }},
            scoring: {{ criteria: {{ target_relevance: {{ source_ids: ['S1'] }} }} }}
          }};
          const dangling = {{
            validation: {{ source_registry: [{{ source_id: 'S1' }}] }},
            scoring: {{ criteria: {{ target_relevance: {{ source_ids: ['S404'] }} }} }}
          }};
          const duplicateIssues = [];
          const danglingIssues = [];
          validateCompactSourceReferences(duplicate, 'record[0]', duplicateIssues);
          validateCompactSourceReferences(dangling, 'record[0]', danglingIssues);
          process.stdout.write(JSON.stringify({{ duplicateIssues, danglingIssues }}));
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
        payload = json.loads(result.stdout)
        self.assertTrue(any("source_id" in issue["path"] for issue in payload["duplicateIssues"]))
        self.assertTrue(any("source_ids" in issue["path"] for issue in payload["danglingIssues"]))

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
            "missing colon": '# Report\n--- JSON DATA ---\n{"a" 1}',
            "array hole": '# Report\n--- JSON DATA ---\n[1,,2]',
            "NaN": '# Report\n--- JSON DATA ---\n{"value":NaN}',
            "Infinity": '# Report\n--- JSON DATA ---\n{"value":Infinity}',
            "undefined": '# Report\n--- JSON DATA ---\n{"value":undefined}',
            "unterminated comment": '# Report\n--- JSON DATA ---\n{"a":1, /* never closed }',
            "two roots": '# Report\n--- JSON DATA ---\n{"a":1}\n{"b":2}',
            "prose then second root": '# Report\n--- JSON DATA ---\n{"a":1}\n완료\n{"b":2}',
            "inline prose then second root": '# Report\n--- JSON DATA ---\n{"a":1}\n완료 {"b":2}',
        }
        for label, value in blocked.items():
            with self.subTest(label=label):
                parsed = self.parse_combined(value)
                self.assertIsNone(parsed["payload"])
                self.assertTrue(parsed["errors"])

    def test_safe_preprocess_repairs_lossless_lexical_variants_and_is_idempotent(self):
        module_uri = (ROOT / "src" / "combined-ingestion.js").resolve().as_uri()
        script = r"""
          import { safePreprocessJson } from __MODULE__;

          const valid = '{"url":"https://example.com/a//b","literal":"keep /* text */","space":"A\\u00a0B"}';
          const validResult = safePreprocessJson(valid);
          if (validResult.text !== valid || validResult.actions.length !== 0) {
            throw new Error('valid JSON must remain byte-for-byte unchanged');
          }

          const cases = [
            {
              input: '{"a":1, /* ignored } { */ "active":True, missing:None,}',
              expected: { a: 1, active: true, missing: null },
            },
            {
              input: '{"a":1, // ignored } {\n"b":False}',
              expected: { a: 1, b: false },
            },
            {
              input: String.raw`{"path":"C:\Models\workspace","regex":"\d+\s","unicode":"\u12G4"}`,
              expected: { path: String.raw`C:\Models\workspace`, regex: String.raw`\d+\s`, unicode: String.raw`\u12G4` },
            },
            {
              input: '{\u00a0"score"\u2003:\u00a02,\u200bactive:\u00a0True}',
              expected: { score: 2, active: true },
            },
            {
              input: '{"text":"a' + String.fromCharCode(0, 8, 11, 12, 31) + 'b"}',
              expected: { text: 'a' + String.fromCharCode(0, 8, 11, 12, 31) + 'b' },
            },
          ];

          let repaired = 0;
          for (const testCase of cases) {
            const first = safePreprocessJson(testCase.input);
            const payload = JSON.parse(first.text);
            if (JSON.stringify(payload) !== JSON.stringify(testCase.expected)) {
              throw new Error(`payload changed: ${first.text}`);
            }
            if (!first.actions.length) throw new Error('expected a recorded repair action');
            const second = safePreprocessJson(first.text);
            if (second.text !== first.text || second.actions.length !== 0) {
              throw new Error('safe preprocessing must be idempotent');
            }
            repaired += 1;
          }

          let propertyCases = 0;
          for (let index = 0; index < 40; index += 1) {
            const original = {
              index,
              active: index % 2 === 0,
              missing: null,
              nested: { score: index % 4, label: `row-${index}` },
              items: [index, true, null],
            };
            let mutated = JSON.stringify(original, null, 2)
              .replace('"index"', 'index')
              .replace('"active"', 'active')
              .replace('"missing"', 'missing')
              .replace('"nested"', 'nested')
              .replace('"score"', 'score')
              .replace('"items"', 'items')
              .replace(/: true/g, ': True')
              .replace(/: false/g, ': False')
              .replace(/: null/g, ': None')
              .replace(/\btrue\b/g, 'True')
              .replace(/\bnull\b/g, 'None')
              .replace('{', '{/* generated comment with } { */')
              .replace(/\n/g, '\u00a0\n')
              .replace(/([}\]])/g, ',$1');
            const normalized = safePreprocessJson(mutated);
            const payload = JSON.parse(normalized.text);
            if (JSON.stringify(payload) !== JSON.stringify(original)) {
              throw new Error(`property fixture ${index} changed meaning`);
            }
            const repeated = safePreprocessJson(normalized.text);
            if (repeated.text !== normalized.text || repeated.actions.length) {
              throw new Error(`property fixture ${index} is not idempotent`);
            }
            propertyCases += 1;
          }

          process.stdout.write(JSON.stringify({ repaired, propertyCases }));
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
        self.assertEqual(summary["repaired"], 5)
        self.assertEqual(summary["propertyCases"], 40)

    def test_combined_parser_uses_comment_aware_root_scan_and_safe_preprocess(self):
        parsed = self.parse_combined(
            """# Report
--- JSON DATA ---
{
  /* a brace in this comment must not close the root: } */
  score: 2,
  "active": True,
}
// trailing comment with a fake root: {"ignored": true}
"""
        )
        self.assertEqual(parsed["errors"], [])
        self.assertEqual(parsed["payload"], {"score": 2, "active": True})
        self.assertTrue(any(issue["path"] == "JSON 자동 복구" for issue in parsed["warnings"]))

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

    def test_backend_backfills_d_only_for_explicit_us_million_usd_c(self):
        record = {
            "scoring": {"criteria": {"marketability": {
                "score": 2,
                "calculation": {
                    "C_obtainable_peak_sales": {
                        "obtainable_peak_sales": 800,
                        "sales_unit": "million USD",
                        "formula": "US Obtainable Peak Sales = US Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment",
                    }
                },
            }}}
        }
        self.assertTrue(main.normalize_marketability_global_conversion(record))
        step_d = record["scoring"]["criteria"]["marketability"]["calculation"]["D_global_obtainable_peak_sales"]
        self.assertEqual(step_d["global_multiplier"], 1.5)
        self.assertEqual(step_d["global_obtainable_peak_sales"], 1200)

        ambiguous = copy.deepcopy(record)
        ambiguous_calculation = ambiguous["scoring"]["criteria"]["marketability"]["calculation"]
        ambiguous_calculation.pop("D_global_obtainable_peak_sales")
        ambiguous_calculation["C_obtainable_peak_sales"]["formula"] = "Obtainable Peak Sales = Unrisked Peak Sales x adjustments"
        self.assertFalse(main.normalize_marketability_global_conversion(ambiguous))
        self.assertNotIn("D_global_obtainable_peak_sales", ambiguous_calculation)

    def test_compact_v2_expansion_backfills_d_from_us_c(self):
        full = self.final_json_template(
            self.rendered_prompts()["full"],
            "\nFinal validation before output:",
        )
        market = full["scoring"]["criteria"]["marketability"]
        market["calculation"]["commercial_rationale_status"] = "evidence_based"
        market["calculation"]["C_obtainable_peak_sales"]["obtainable_peak_sales"] = 900
        market["calculation"]["D_global_obtainable_peak_sales"]["global_obtainable_peak_sales"] = None
        expanded = self.expand(full, "full")
        step_d = expanded["scoring"]["criteria"]["marketability"]["calculation"]["D_global_obtainable_peak_sales"]
        self.assertEqual(step_d["global_obtainable_peak_sales"], 1350)
        self.assertEqual(step_d["global_multiplier"], 1.5)

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
        self.assertEqual(triage[0]["meta"]["ingestion_format"], "compact_v2")
        self.assertNotIn("source_report", triage[0])
        self.assertEqual(set(triage[0]["input"]), {"company_input", "asset_input"})
        self.assertEqual(full["meta"]["ingestion_format"], "compact_v2")
        self.assertEqual(set(full["input"]), {"company_input", "asset_input"})
        self.assertNotIn("obsidian", full)
        self.assertNotIn("source_report", full)
        self.assertEqual(
            set(full["validation"]),
            {"uncertain_points", "cross_checked_facts", "source_registry"},
        )
        self.assertIn("source_ids", full["scoring"]["criteria"]["target_relevance"])
        self.assertNotIn("schema_version", full["meta"])
        self.assertNotIn("instruction_version", full["meta"])
        self.assertIn("evidence_type_reason", full["scoring"]["criteria"]["target_relevance"])
        self.assertIn("investigation_note", full["scoring"]["criteria"]["target_relevance"])
        self.assertNotIn("what_was_checked", full["scoring"]["criteria"]["target_relevance"])
        expected_criterion_fields = {
                "score",
                "evidence_type",
                "evidence_type_reason",
                "evidence_basis",
                "main_line_summary",
                "why_not_higher",
                "investigation_note",
                "uncertain_points",
                "source_ids",
        }
        for criterion_id, criterion in full["scoring"]["criteria"].items():
            expected = expected_criterion_fields | ({"calculation"} if criterion_id == "marketability" else set())
            self.assertEqual(set(criterion), expected)
        calculation = full["scoring"]["criteria"]["marketability"]["calculation"]
        self.assertIn("D_global_obtainable_peak_sales", calculation)
        self.assertEqual(calculation["D_global_obtainable_peak_sales"]["global_multiplier"], 1.5)
        self.assertEqual(
            set(full["company_profile"]),
            {"headquarters", "company_stage", "platform_summary"},
        )
        self.assertEqual(
            set(full["competitive_analysis"]),
            {
                "competitive_density",
                "similarity_summary",
                "competitor_table",
                "similar_pipelines",
            },
        )
        self.assertEqual(
            set(triage[0]["triage"]),
            {
                "status",
                "identity_verified",
                "active_asset",
                "verified_public_source_count",
                "why",
                "missing_evidence_needed_for_full_scout",
            },
        )

        triage[0]["structured_table"]["asset_name"] = "T-V2"
        triage[0]["structured_table"]["sources"] = []
        full["structured_table"]["asset_name"] = "F-V2"
        full["structured_table"]["sources"] = []
        expanded_triage = self.expand(triage[0], "triage")
        expanded_full = self.expand(full, "full")
        self.assertEqual(expanded_triage["scoring"]["total_score"], 0)
        self.assertEqual(expanded_triage["scoring"]["max_score"], 9)
        self.assertEqual(expanded_full["scoring"]["total_score"], 0)
        self.assertEqual(expanded_full["scoring"]["max_score"], 21)
        main.validate_records_for_save([expanded_triage, expanded_full])

        hover_projection = copy.deepcopy(expanded_full)
        hover_projection["scoring"]["criteria"]["target_relevance"]["main_line_summary"] = "Concise hover summary"
        main.validate_records_for_save([hover_projection])

        extra_company_research = copy.deepcopy(expanded_full)
        extra_company_research["company_profile"]["website"] = "https://example.com"
        with self.assertRaises(Exception):
            main.validate_records_for_save([extra_company_research])

        two_table_sources = copy.deepcopy(expanded_full)
        two_table_sources["structured_table"]["sources"] = [
            {"source_title": "One", "source_url": "https://example.com/1"},
            {"source_title": "Two", "source_url": "https://example.com/2"},
        ]
        with self.assertRaises(Exception):
            main.validate_records_for_save([two_table_sources])


if __name__ == "__main__":
    unittest.main()
