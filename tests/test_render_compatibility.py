import copy
import json
import shutil
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

import main
from record_storage import minimize_record_for_dashboard_storage


ROOT = Path(__file__).resolve().parents[1]
CRITERIA = (
    "target_relevance",
    "competitive_landscape",
    "moa_validity",
    "platform_attractiveness",
    "expansion_potential",
    "data_maturity",
    "marketability",
)
TRIAGE_CRITERIA = ("target_relevance", "moa_validity", "data_maturity")


def rich_criterion(score: int = 3) -> dict:
    return {
        "score": score,
        "evidence_type": "E3_asset_specific_preclinical_or_technical_evidence",
        "evidence_type_reason": "Asset-specific evidence.",
        "main_line_summary": "Supported by the saved report.",
        "why_not_higher": "No higher-stage evidence.",
        "investigation_note": "Review the original report.",
        "source_ids": ["S1"],
        "evidence_sources": [
            {
                "source_id": "S1",
                "source_title": "Official source",
                "source_url": "https://example.com/source",
                "verified": True,
                "evidence_summary": "Supports the score.",
            }
        ],
        "uncertain_points": [],
    }


def verbose_full_record(asset: str = "LEGACY-1") -> dict:
    return {
        "meta": {
            "review_type": "full_scout",
            "schema_version": "3.1",
            "rubric_version": "3.1",
            "generated_at": "2026-07-01",
            "output_filename_base": f"Legacy_Bio_{asset}",
        },
        "input": {"company_input": "Legacy Bio", "asset_input": asset},
        "source_report": {
            "raw_markdown": (
                f"# Legacy Bio {asset}\n\nSaved verbose report.\n\n"
                '[1]: https://example.com/report "Report reference"'
            ),
            "parser_status": "gpt_structured_output",
        },
        "json_summary": {
            "company": "Legacy Bio",
            "asset_name": asset,
            "target": "TARGET1",
            "theme": "E/I Balance",
            "cluster": "Ion channel",
            "company_country": "United States",
            "target_description": "Target description from the legacy record.",
        },
        "structured_table": {
            "company": "Legacy Bio",
            "asset_name": asset,
            "target": "TARGET1",
            "moa": "Negative allosteric modulator",
            "modality_platform": "Small molecule",
            "main_indication": "Epilepsy",
            "indication": "Epilepsy",
            "development_stage": "Preclinical Candidate",
            "company_country": "United States",
            "sources": [
                {
                    "source_title": "Official source",
                    "source_url": "https://example.com/source",
                }
            ],
        },
        "hard_filter": {
            "status": "PASS",
            "reason": "No hard blocker.",
            "flags": [],
            "hard_blocker": False,
            "decision_uncertainty": False,
        },
        "scoring": {
            "criteria": {criterion_id: rich_criterion() for criterion_id in CRITERIA},
            "total_score": 21,
            "max_score": 21,
        },
        "validation": {
            "uncertain_points": [],
            "source_registry": [
                {
                    "source_id": "S1",
                    "source_title": "Official source",
                    "source_url": "https://example.com/source",
                }
            ],
        },
        "final_insight": {
            "one_line_summary": "Legacy record remains renderable.",
            "recommendation": "Prioritize",
        },
        "company_profile": {
            "company_name": "Legacy Bio",
            "country": "United States",
            "headquarters": "Boston",
            "company_stage": "Private",
            "platform_summary": "Small-molecule discovery.",
            "official_source_urls": [],
        },
        "competitive_analysis": {
            "competitive_density": "Medium",
            "similarity_summary": {
                "similar_pipeline_count": 2,
                "high_similarity_count": 1,
                "medium_similarity_count": 1,
                "low_similarity_count": 0,
            },
        },
    }


def compact_v1_input() -> dict:
    criterion = rich_criterion()
    return {
        "meta": {
            "ingestion_format": "compact_v1",
            "review_type": "full_scout",
            "generated_at": "2026-08-01",
            "output_filename_base": "Compact_V1_CV1-1",
        },
        "structured_table": {
            "company": "Compact V1",
            "asset_name": "CV1-1",
            "target": "TARGET2",
            "moa": "Inhibitor",
            "modality_platform": "Small molecule",
            "main_indication": "Depression",
            "indication": "Depression",
            "development_stage": "IND-enabling",
            "company_country": "Republic of Korea",
            "sources": [],
        },
        "hard_filter": {"status": "PASS", "reason": "Eligible.", "flags": []},
        "scoring": {
            "criteria": {criterion_id: copy.deepcopy(criterion) for criterion_id in CRITERIA},
            "total_score": 21,
            "max_score": 21,
        },
        "validation": {
            "uncertain_points": [],
            "source_registry": [
                {
                    "source_id": "S1",
                    "source_title": "Compact source",
                    "source_url": "https://example.org/compact-v1",
                    "verified": True,
                    "evidence_summary": "Compact evidence.",
                }
            ],
        },
        "final_insight": {
            "one_line_summary": "Compact v1 expanded record.",
            "recommendation": "Prioritize",
        },
        "json_summary": {
            "theme": "Neuroimmune",
            "cluster": "Microglia",
            "target_description": "Compact v1 target.",
        },
        "company_profile": {"company_name": "Compact V1", "country": "Republic of Korea"},
        "competitive_analysis": {
            "competitive_density": "Low",
            "similarity_summary": {
                "similar_pipeline_count": 0,
                "high_similarity_count": 0,
                "medium_similarity_count": 0,
                "low_similarity_count": 0,
            },
        },
    }


def compact_v2_full_input() -> dict:
    return {
        "meta": {
            "ingestion_format": "compact_v2",
            "review_type": "full_scout",
            "generated_at": "2026-08-02",
            "output_filename_base": "Compact_V2_CV2-1",
        },
        "input": {"company_input": "Compact V2", "asset_input": "CV2-1"},
        "json_summary": {
            "theme": "E/I Balance",
            "cluster": "Synaptic signaling",
            "target_description": "Compact v2 target.",
        },
        "structured_table": {
            "company": "Compact V2",
            "asset_name": "CV2-1",
            "target": "TARGET3",
            "moa": "Agonist",
            "modality_platform": "Biologic",
            "main_indication": "Schizophrenia",
            "indication": "Schizophrenia",
            "development_stage": "Phase 1",
            "company_country": "Japan",
            "sources": [
                {
                    "source_title": "Primary source",
                    "source_url": "https://example.net/compact-v2",
                }
            ],
        },
        "hard_filter": {
            "status": "PASS",
            "reason": "Eligible.",
            "flags": [],
            "hard_blocker": False,
            "decision_uncertainty": False,
        },
        "scoring": {"criteria": {criterion_id: {"score": 3} for criterion_id in CRITERIA}},
        "validation": {"uncertain_points": []},
        "final_insight": {"one_line_summary": "Compact v2 record.", "recommendation": "Prioritize"},
        "company_profile": {
            "headquarters": "Tokyo",
            "company_stage": "Private",
            "platform_summary": "Biologic platform.",
        },
        "competitive_analysis": {
            "competitive_density": "Low",
            "similarity_summary": {
                "similar_pipeline_count": 1,
                "high_similarity_count": 0,
                "medium_similarity_count": 1,
                "low_similarity_count": 0,
            },
        },
    }


def compact_v2_triage_input() -> dict:
    return {
        "meta": {
            "ingestion_format": "compact_v2",
            "review_type": "fast_triage",
            "generated_at": "2026-08-02",
            "output_filename_base": "Compact_Triage_CT-1",
        },
        "input": {"company_input": "Compact Triage", "asset_input": "CT-1"},
        "json_summary": {
            "theme": "Unknown",
            "cluster": "Unknown",
            "target_description": "Triage target description.",
        },
        "structured_table": {
            "company": "Compact Triage",
            "asset_name": "CT-1",
            "target": "TARGET4",
            "moa": "Modulator",
            "modality_platform": "Small molecule",
            "main_indication": "Anxiety",
            "indication": "Anxiety",
            "development_stage": "Preclinical unspecified",
            "company_country": "United Kingdom",
            "sources": [],
        },
        "hard_filter": {
            "status": "SELECT",
            "reason": "Eligible for Full Scout.",
            "flags": [],
            "hard_blocker": False,
            "decision_uncertainty": False,
        },
        "scoring": {"criteria": {criterion_id: {"score": 3} for criterion_id in TRIAGE_CRITERIA}},
        "validation": {"uncertain_points": []},
        "final_insight": {"one_line_summary": "Triage record.", "recommendation": "Run Full Scout"},
        "triage": {
            "status": "SELECT",
            "identity_verified": True,
            "active_asset": True,
            "verified_public_source_count": 1,
        },
    }


def malformed_optional_record() -> dict:
    record = verbose_full_record("ODD-TYPES")
    record["source_report"]["raw_markdown"] = ""
    malformed_values = (
        (None, None, "https://example.com/not-an-array", "uncertain text"),
        (17, "S1", {"source_url": "https://example.com/object"}, {"note": "object"}),
        (["E3"], {"source": "S1"}, None, None),
        ({"type": "E2"}, 42, 42, 42),
    )
    for index, criterion_id in enumerate(CRITERIA):
        evidence_type, source_ids, evidence_sources, uncertain_points = malformed_values[index % len(malformed_values)]
        criterion = record["scoring"]["criteria"][criterion_id]
        criterion["evidence_type"] = evidence_type
        criterion["source_ids"] = source_ids
        criterion["evidence_sources"] = evidence_sources
        criterion["uncertain_points"] = uncertain_points
    record["validation"]["uncertain_points"] = "validation uncertainty as text"
    return record


def run_node(script: str) -> dict:
    try:
        result = subprocess.run(
            [shutil.which("node"), "--input-type=module"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            input=script,
            text=True,
            encoding="utf-8",
        )
    except subprocess.CalledProcessError as exc:
        raise AssertionError(exc.stderr or exc.stdout or "Node compatibility harness failed") from exc
    return json.loads(result.stdout)


def fake_dom_prelude() -> str:
    return r"""
      function fakeNode(tagName = 'DIV') {
        const classes = new Set();
        return {
          tagName, innerHTML: '', textContent: '', value: '', title: '', href: '',
          hidden: false, disabled: false, scrollHeight: 0, clientWidth: 0, dataset: {},
          style: { setProperty() {} },
          classList: {
            add: (...names) => names.forEach((name) => classes.add(name)),
            remove: (...names) => names.forEach((name) => classes.delete(name)),
            contains: (name) => classes.has(name),
            toggle: (name, force) => {
              const enabled = force === undefined ? !classes.has(name) : Boolean(force);
              if (enabled) classes.add(name); else classes.delete(name);
              return enabled;
            },
          },
          setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {},
          insertBefore() {}, replaceChildren() {}, scrollTo() {}, focus() {}, reset() {},
          closest() { return this; },
          querySelector() { return null; }, querySelectorAll() { return []; },
          getClientRects() { return []; }, getBoundingClientRect() {
            return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
          },
        };
      }
      const nodes = new Map();
      globalThis.window = {
        location: { search: '', href: '' }, innerWidth: 1280, innerHeight: 800,
        addEventListener() {}, removeEventListener() {}, setTimeout,
        confirm: () => false, alert() {}, prompt: () => null, open() {},
      };
      globalThis.document = {
        title: '', body: fakeNode('BODY'), activeElement: null,
        querySelector(selector) {
          if (!nodes.has(selector)) nodes.set(selector, fakeNode());
          return nodes.get(selector);
        },
        querySelectorAll() { return []; },
        createElement(tagName) { return fakeNode(String(tagName || 'div').toUpperCase()); },
        createDocumentFragment() { return fakeNode('#fragment'); },
        addEventListener() {},
      };
      globalThis.localStorage = {
        getItem() { return null; }, setItem() {}, removeItem() {},
      };
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: async () => {} } }, configurable: true,
      });
      globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
      globalThis.cancelAnimationFrame = () => {};
      globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
      globalThis.getCurrentUser = () => ({ id: 'tester', name: 'Tester', is_admin: true });
      globalThis.requireAuth = async () => ({ id: 'tester', name: 'Tester', is_admin: true });
      globalThis.openAuthModal = async () => null;
      globalThis.initAuthUI = () => {};
      globalThis.setupThemeToggle = () => {};
      globalThis.initFloatingAgent = () => ({});
      globalThis.expandCompactInputRecord = (record) => record;
      globalThis.splitAtRecoverableJsonSeparator = () => null;
    """


@unittest.skipUnless(shutil.which("node"), "Node.js is required for frontend compatibility tests")
class FrontendRenderCompatibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        module_uri = (ROOT / "src" / "compact-ingestion.js").resolve().as_uri()
        compact_inputs = [
            {"mode": "full", "record": compact_v1_input()},
            {"mode": "full", "record": compact_v2_full_input()},
            {"mode": "triage", "record": compact_v2_triage_input()},
        ]
        expanded = run_node(
            f"""
              import {{ expandCompactInputRecord }} from {json.dumps(module_uri)};
              const inputs = {json.dumps(compact_inputs, ensure_ascii=False)};
              process.stdout.write(JSON.stringify(inputs.map(
                (item) => expandCompactInputRecord(item.record, item.mode)
              )));
            """
        )
        cls.expanded_v1, cls.expanded_v2, cls.expanded_triage = expanded
        cls.raw_v1 = compact_v1_input()
        cls.raw_v2 = compact_v2_full_input()
        cls.raw_triage_v2 = compact_v2_triage_input()
        cls.hybrid_minimal = minimize_record_for_dashboard_storage(copy.deepcopy(cls.expanded_v2))
        cls.hybrid_minimal["source_report"]["raw_markdown"] = (
            '# Compact V2 report\n\n[Source](https://example.net/report "Reference")'
        )
        cls.hybrid_rich = minimize_record_for_dashboard_storage(verbose_full_record("HYBRID-RICH"))
        cls.malformed = malformed_optional_record()
        cls.full_records = [
            verbose_full_record(),
            cls.raw_v1,
            cls.raw_v2,
            cls.expanded_v1,
            cls.expanded_v2,
            cls.hybrid_minimal,
            cls.hybrid_rich,
            cls.malformed,
        ]

    def test_dashboard_projection_helpers_render_mixed_record_contracts(self) -> None:
        app_source = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        executable = app_source[
            app_source.index("const API_URL"):app_source.index("\nelements.searchInput.addEventListener")
        ]
        records = [*self.full_records, self.raw_triage_v2, self.expanded_triage]
        script = f"""
          {fake_dom_prelude()}
          {executable}
          const records = {json.dumps(records, ensure_ascii=False)};
          const rows = records.map((record, index) => flattenRecord(record, index));
          state.rawRecords = records;
          state.rows = rows;
          state.tableMode = 'full';
          renderTable();
          const fullTableHtml = elements.pipelineTable.innerHTML;
          state.tableMode = 'triage';
          renderTable();
          const triageTableHtml = elements.pipelineTable.innerHTML;
          const projections = rows.map((row) => ({{
            id: row.id,
            company: row.company,
            asset: row.asset,
            totalScore: row.totalScore,
            hardFilter: row.hardFilter,
            targetDescription: row.targetDescription,
            criteria: Object.fromEntries(Object.entries(row.criteria).map(([key, value]) => [key, {{
              score: value.score,
              evidenceType: String(value.evidenceType ?? ''),
              evidenceSources: Array.isArray(value.evidenceSources) ? value.evidenceSources.length : -1,
              uncertaintyFallbackIsArray: Array.isArray(value.conflictingOrMissingEvidence),
              tooltipType: typeof scoreTooltip(key, value, 3),
              tooltipContainsObjectString: scoreTooltip(key, value, 3).includes('[object Object]'),
            }}])),
          }}));
          process.stdout.write(JSON.stringify({{
            count: rows.length,
            projections,
            fullTableHtmlType: typeof fullTableHtml,
            triageTableHtmlType: typeof triageTableHtml,
          }}));
        """
        result = run_node(script)
        self.assertEqual(result["count"], len(records))
        self.assertEqual(len(result["projections"]), len(records))
        self.assertEqual(result["fullTableHtmlType"], "string")
        self.assertEqual(result["triageTableHtmlType"], "string")
        self.assertTrue(all(item["id"] and item["asset"] for item in result["projections"]))
        self.assertTrue(all(
            criterion["tooltipType"] == "string"
            and criterion["evidenceSources"] >= 0
            and not criterion["tooltipContainsObjectString"]
            for item in result["projections"]
            for criterion in item["criteria"].values()
        ))
        self.assertTrue(all(
            criterion["uncertaintyFallbackIsArray"]
            for item in result["projections"]
            for criterion in item["criteria"].values()
        ))

    def test_full_detail_helpers_and_page_renderer_fall_back_on_optional_type_drift(self) -> None:
        detail_source = (ROOT / "src" / "detail.js").read_text(encoding="utf-8")
        executable = detail_source[
            detail_source.index("const params"):detail_source.index("\nelements.form.addEventListener")
        ]
        script = f"""
          {fake_dom_prelude()}
          {executable}
          const records = {json.dumps(self.full_records, ensure_ascii=False)};
          const results = records.map((record) => {{
            const scoreHtml = renderScoreEvidence(record);
            const fallbackMarkdown = buildReadableSourceReport(record);
            const sources = collectGlobalSources(record);
            const targetCriterion = record?.scoring?.criteria?.target_relevance;
            renderRecord(record);
            return {{
              asset: record?.structured_table?.asset_name || '',
              scoreHtmlType: typeof scoreHtml,
              scoreHtmlHasOfficialSource: scoreHtml.includes('Official source'),
              scoreHtmlContainsObjectString: scoreHtml.includes('[object Object]'),
              criterionSourceCount: criterionEvidenceSources(record, targetCriterion).length,
              fallbackType: typeof fallbackMarkdown,
              sourceCount: sources.length,
              titleType: typeof elements.title.textContent,
              reportHtmlType: typeof elements.sourceReportViewer.innerHTML,
            }};
          }});
          process.stdout.write(JSON.stringify({{ count: results.length, results }}));
        """
        result = run_node(script)
        self.assertEqual(result["count"], len(self.full_records))
        self.assertTrue(all(item["scoreHtmlType"] == "string" for item in result["results"]))
        self.assertTrue(all(not item["scoreHtmlContainsObjectString"] for item in result["results"]))
        self.assertTrue(all(item["fallbackType"] == "string" for item in result["results"]))
        self.assertTrue(all(item["titleType"] == "string" for item in result["results"]))
        self.assertTrue(all(item["reportHtmlType"] == "string" for item in result["results"]))
        self.assertGreater(result["results"][-1]["sourceCount"], 0)
        hybrid_rich = next(item for item in result["results"] if item["asset"] == "HYBRID-RICH")
        self.assertGreater(hybrid_rich["criterionSourceCount"], 0)
        self.assertTrue(hybrid_rich["scoreHtmlHasOfficialSource"])

    def test_triage_page_renderer_handles_minimal_and_wrong_optional_evidence_fields(self) -> None:
        triage_source = (ROOT / "src" / "triage-detail.js").read_text(encoding="utf-8")
        executable = triage_source[
            triage_source.index("const params"):triage_source.index("\nelements.criteriaDrawerButton?.addEventListener")
        ]
        malformed_triage = copy.deepcopy(self.expanded_triage)
        malformed_triage["source_report"]["raw_markdown"] = (
            "# Triage report\n\n[Official](https://example.org/triage)"
        )
        malformed_triage["structured_table"]["sources"] = [
            {"source_title": "Fallback source", "source_url": "https://example.org/fallback"}
        ]
        malformed_values = [None, "not-an-array", {"source_url": "https://example.org/object"}]
        for index, criterion_id in enumerate(TRIAGE_CRITERIA):
            item = malformed_triage["scoring"]["criteria"][criterion_id]
            item["evidence_type"] = malformed_values[index]
            item["source_ids"] = malformed_values[(index + 1) % len(malformed_values)]
            item["evidence_sources"] = malformed_values[(index + 2) % len(malformed_values)]
            item["uncertain_points"] = malformed_values[index]
        malformed_triage["validation"]["uncertain_points"] = "not-an-array"
        script = f"""
          {fake_dom_prelude()}
          {executable}
          const records = {json.dumps([self.raw_triage_v2, self.expanded_triage, malformed_triage], ensure_ascii=False)};
          const results = records.map((record) => {{
            renderRecord(record);
            return {{
              sources: collectSources(record).length,
              decisionHtmlType: typeof elements.decisionHero.innerHTML,
              scoreHtmlType: typeof elements.scoreGrid.innerHTML,
              diligenceHtmlType: typeof elements.diligence.innerHTML,
              reportHtmlType: typeof elements.rawReport.innerHTML,
              containsObjectString: [
                elements.decisionHero.innerHTML,
                elements.scoreGrid.innerHTML,
                elements.diligence.innerHTML,
                elements.rawReport.innerHTML,
              ].some((html) => html.includes('[object Object]')),
            }};
          }});
          process.stdout.write(JSON.stringify({{ results }}));
        """
        result = run_node(script)
        self.assertEqual(len(result["results"]), 3)
        self.assertTrue(all(item["decisionHtmlType"] == "string" for item in result["results"]))
        self.assertTrue(all(item["scoreHtmlType"] == "string" for item in result["results"]))
        self.assertTrue(all(item["diligenceHtmlType"] == "string" for item in result["results"]))
        self.assertTrue(all(item["reportHtmlType"] == "string" for item in result["results"]))
        self.assertTrue(all(not item["containsObjectString"] for item in result["results"]))
        self.assertGreaterEqual(result["results"][2]["sources"], 1)


class BackendProjectionCompatibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if shutil.which("node"):
            module_uri = (ROOT / "src" / "compact-ingestion.js").resolve().as_uri()
            compact_inputs = [
                {"mode": "full", "record": compact_v1_input()},
                {"mode": "full", "record": compact_v2_full_input()},
                {"mode": "triage", "record": compact_v2_triage_input()},
            ]
            cls.expanded_v1, cls.expanded_v2, cls.expanded_triage = run_node(
                f"""
                  import {{ expandCompactInputRecord }} from {json.dumps(module_uri)};
                  const inputs = {json.dumps(compact_inputs, ensure_ascii=False)};
                  process.stdout.write(JSON.stringify(inputs.map(
                    (item) => expandCompactInputRecord(item.record, item.mode)
                  )));
                """
            )
        else:
            cls.expanded_v1 = compact_v1_input()
            cls.expanded_v2 = compact_v2_full_input()
            cls.expanded_triage = compact_v2_triage_input()
        cls.hybrid_minimal = minimize_record_for_dashboard_storage(copy.deepcopy(cls.expanded_v2))
        cls.records = [
            verbose_full_record(),
            compact_v1_input(),
            compact_v2_full_input(),
            cls.expanded_v1,
            cls.expanded_v2,
            cls.hybrid_minimal,
            malformed_optional_record(),
            compact_v2_triage_input(),
            cls.expanded_triage,
        ]

    def test_records_get_projection_returns_mixed_saved_shapes_without_normalizing_optional_fields(self) -> None:
        original = copy.deepcopy(self.records)
        with (
            patch.object(main, "load_records", return_value=copy.deepcopy(self.records)) as load_mock,
            patch.object(main, "refresh_tracked_oi_classifications", return_value=False) as refresh_mock,
            patch.object(main, "save_records") as save_mock,
        ):
            response = main.get_records()

        load_mock.assert_called_once_with()
        refresh_mock.assert_called_once()
        save_mock.assert_not_called()
        self.assertEqual(response["records"], original)
        self.assertEqual(len(response["records"]), len(self.records))
        json.dumps(response, ensure_ascii=False)

    def test_dashboard_summary_projects_mixed_contracts_without_read_or_render_failure(self) -> None:
        with patch.object(main, "load_records", return_value=copy.deepcopy(self.records)) as load_mock:
            response = main.get_dashboard_summary()

        load_mock.assert_called_once_with()
        self.assertEqual(response["basis"], "persisted_records")
        self.assertEqual(response["aggregation_unit"], "unique_asset")
        # Compact v2 and its persisted hybrid represent the same unique asset.
        self.assertGreaterEqual(response["tabs"]["full_scout"]["kpis"]["assets"], 4)
        self.assertGreaterEqual(response["tabs"]["fast_triage"]["kpis"]["assets"], 1)
        self.assertIsInstance(response["tabs"]["full_scout"]["priority_pipelines"], list)
        self.assertIsInstance(response["tabs"]["fast_triage"]["awaiting_full_scout"], list)
        json.dumps(response, ensure_ascii=False)


if __name__ == "__main__":
    unittest.main()
