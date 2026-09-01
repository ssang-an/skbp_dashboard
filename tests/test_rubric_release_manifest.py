from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

import main
import record_storage


ROOT = Path(__file__).resolve().parents[1]


class RubricReleaseManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads(
            (ROOT / "config" / "rubric-release.json").read_text(encoding="utf-8")
        )

    def test_backend_versions_paths_and_calculation_come_from_manifest(self) -> None:
        triage = self.manifest["workflows"]["fast_triage"]
        full = self.manifest["workflows"]["full_scout"]
        marketability = self.manifest["calculations"]["marketability"]

        self.assertEqual(main.TRIAGE_CRITERIA_VERSION, triage["rubric_version"])
        self.assertEqual(main.TRIAGE_SCHEMA_VERSION, triage["schema_version"])
        self.assertEqual(main.SCORING_CRITERIA_VERSION, full["rubric_version"])
        self.assertEqual(main.FULL_SCOUT_SCHEMA_VERSION, full["schema_version"])
        self.assertEqual(main.SCORING_CRITERIA_TRIAGE_MD, ROOT / triage["rubric_file"])
        self.assertEqual(main.SCORING_CRITERIA_FULL_MD, ROOT / full["rubric_file"])
        self.assertEqual(main.SCORING_CRITERIA_DISPLAY_MD, ROOT / full["display_file"])
        self.assertEqual(main.MARKETABILITY_GLOBAL_MULTIPLIER, marketability["global_multiplier"])
        self.assertEqual(self.manifest["contracts"]["storage_profile"], record_storage.STORAGE_PROFILE)
        self.assertTrue(str(triage["display_version"]).strip())
        self.assertTrue(str(full["display_version"]).strip())

    def test_declared_rubric_documents_identify_the_release_versions(self) -> None:
        for workflow_id, workflow in self.manifest["workflows"].items():
            rubric_text = (ROOT / workflow["rubric_file"]).read_text(encoding="utf-8")
            self.assertIn(
                f"v{workflow['rubric_version']}",
                rubric_text,
                f"{workflow_id} rubric title must identify its manifest version",
            )
        full = self.manifest["workflows"]["full_scout"]
        display_text = (ROOT / full["display_file"]).read_text(encoding="utf-8")
        self.assertIn(f"v{full['display_version']}", display_text)

    def test_frontend_release_labels_match_manifest(self) -> None:
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        index_html = (ROOT / "index.html").read_text(encoding="utf-8")
        detail_html = (ROOT / "detail.html").read_text(encoding="utf-8")
        triage_version = re.escape(self.manifest["workflows"]["fast_triage"]["rubric_version"])
        full_version = re.escape(self.manifest["workflows"]["full_scout"]["rubric_version"])

        self.assertRegex(
            app_js,
            rf"const LATEST_TRIAGE_RUBRIC_VERSION = ['\"]{triage_version}['\"]",
        )
        self.assertRegex(
            app_js,
            rf"const LATEST_FULL_SCOUT_RUBRIC_VERSION = ['\"]{full_version}['\"]",
        )
        expected_heading = (
            "GPT 지침 2 — Full Scout · "
            f"v{self.manifest['workflows']['full_scout']['rubric_version']} 기준"
        )
        self.assertIn(expected_heading, index_html)
        self.assertIn(expected_heading, detail_html)

    def test_dashboard_judgment_guide_has_a_maintained_english_toggle(self) -> None:
        index_html = (ROOT / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        english_guide = (ROOT / "src" / "criteria-guide-i18n.js").read_text(encoding="utf-8")

        self.assertIn('id="criteriaLanguageToggle"', index_html)
        self.assertIn('data-criteria-language="ko"', index_html)
        self.assertIn('data-criteria-language="en"', index_html)
        self.assertIn("CRITERIA_GUIDE_LANGUAGE_STORAGE_KEY", app_js)
        self.assertIn("applyCriteriaGuideLanguage", app_js)
        self.assertIn("Direct asset-specific evidence relevant to the proposed MoA", english_guide)
        self.assertIn("평가 asset에서 제안된 MoA 관련 직접 근거가 확인됨", index_html)
        self.assertIn("Target Area Relevance</span></h3></div><p>Assesses whether the verified asset indication", english_guide)
        self.assertNotIn('<article class="target-parameter-card full-parameter-card"><h3>Target Relevance</h3>', english_guide)

    def test_status_gate_text_matches_current_rubric_on_all_visible_surfaces(self) -> None:
        index_html = (ROOT / "index.html").read_text(encoding="utf-8")
        triage_detail_html = (ROOT / "triage_detail.html").read_text(encoding="utf-8")
        detail_html = (ROOT / "detail.html").read_text(encoding="utf-8")
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")

        for surface in (index_html, triage_detail_html):
            self.assertIn("MoA 1점 이상", surface)
            self.assertIn("Data 2점 이상", surface)
            self.assertNotIn("MoA 또는 Data 중 하나 이상 2점 이상", surface)

        self.assertIn("trScore >= 3 && moaScore >= 1 && dataScore >= 2", app_js)

        for surface in (index_html, detail_html):
            self.assertIn("MoA Validity = 3", surface)
            self.assertIn("Data Maturity = 3", surface)
            self.assertIn("TAR / MoA / Data 중 하나가 0점", surface)

        self.assertIn("targetScore >= 3 && moaScore === 3 && dataScore === 3", app_js)
        self.assertIn("['Target Area Relevance', targetScore], ['MoA Validity', moaScore], ['Data Maturity', dataScore]", app_js)

    def test_marketability_release_rule_is_present_on_managed_surfaces(self) -> None:
        marketability = self.manifest["calculations"]["marketability"]
        full = self.manifest["workflows"]["full_scout"]
        multiplier_text = str(marketability["global_multiplier"])
        for relative_path in (
            full["rubric_file"],
            full["display_file"],
            "src/app.js",
            "index.html",
        ):
            surface = (ROOT / relative_path).read_text(encoding="utf-8")
            self.assertIn("Global Obtainable Peak Sales", surface, relative_path)
            self.assertIn(multiplier_text, surface, relative_path)

    def test_active_rubric_prompt_and_judgment_guides_share_core_rules(self) -> None:
        triage = self.manifest["workflows"]["fast_triage"]
        full = self.manifest["workflows"]["full_scout"]
        triage_rubric = (ROOT / triage["rubric_file"]).read_text(encoding="utf-8")
        full_rubric = (ROOT / full["rubric_file"]).read_text(encoding="utf-8")
        display = (ROOT / full["display_file"]).read_text(encoding="utf-8")
        app_js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
        index_html = (ROOT / "index.html").read_text(encoding="utf-8")
        triage_detail_html = (ROOT / "triage_detail.html").read_text(encoding="utf-8")
        detail_html = (ROOT / "detail.html").read_text(encoding="utf-8")

        tr_rule = "Target/MoA disease-biology fit and Theme/Cluster are not TR score bases"
        self.assertIn(tr_rule, app_js)
        self.assertNotIn("score-2 indication plus verified target/MoA directly linked", app_js)

        data_three_rule = "program progression"
        for surface in (triage_rubric, full_rubric, display, app_js, index_html, triage_detail_html, detail_html):
            self.assertIn(data_three_rule, surface)

        for surface in (full_rubric, display):
            self.assertIn("official preclinical, IND-enabling, or clinical", surface)
        for surface in (index_html, detail_html):
            self.assertIn("최소 1개 공식 전임상·IND-enabling·임상", surface)

    def test_full_scout_rubric_and_display_docs_are_complete_not_thin_deltas(self) -> None:
        """Regression guard: a version's active rubric/display doc must literally
        contain every criterion's scoring rule, not just reference an older
        version's file by name. `build_rubric_refresh_prompt()` in main.py reads
        only the single active `rubric_file` at runtime with no inheritance-chain
        resolution, so a doc that merely says "inherits from vN" leaves the
        rubric-refresh LLM call without that criterion's actual definition."""
        full = self.manifest["workflows"]["full_scout"]
        full_rubric = (ROOT / full["rubric_file"]).read_text(encoding="utf-8")
        display = (ROOT / full["display_file"]).read_text(encoding="utf-8")

        # One distinctive marker phrase per Full Scout criterion's actual scoring
        # rule (not just the criterion's name appearing in a heading or table of
        # contents).
        criterion_markers = {
            "Target Relevance": "우선 적응증",
            "MoA Validity": "Functional evidence",
            "Data Maturity": "program progression",
            "Competitive Landscape": "head-to-head",
            "Platform Attractiveness": "First Patient Dosed",
            "Expansion Potential": "additional indication",
            "Marketability": "Global Obtainable Peak Sales",
        }
        for criterion, marker in criterion_markers.items():
            self.assertIn(marker, full_rubric, f"{full['rubric_file']} is missing the {criterion} rule ({marker!r})")
            self.assertIn(marker, display, f"{full['display_file']} is missing the {criterion} rule ({marker!r})")

    def test_full_scout_criterion_order_is_shared_across_backend_and_display(self) -> None:
        """The three Fast Triage-shared criteria (TR, MoA, Data) lead, then
        Competitive Landscape, Platform Attractiveness, Expansion Potential, and
        Marketability. Checked across the backend constants and every surface
        that lists all seven criteria in one place, so a future edit to one
        surface cannot silently drift from the others."""
        shared_order = [
            "target_relevance",
            "moa_validity",
            "data_maturity",
            "competitive_landscape",
            "platform_attractiveness",
            "expansion_potential",
            "marketability",
        ]
        self.assertEqual(main.CRITERION_IDS, shared_order)
        self.assertEqual(list(record_storage.FULL_CRITERION_IDS), shared_order)
        self.assertEqual(list(main.RULE_PREFIXES.keys()), shared_order)

        display_names = [
            "Target Relevance",
            "MoA Validity",
            "Data Maturity",
            "Competitive Landscape",
            "Platform Attractiveness",
            "Expansion Potential",
            "Marketability",
        ]
        full = self.manifest["workflows"]["full_scout"]
        full_rubric = (ROOT / full["rubric_file"]).read_text(encoding="utf-8")
        display = (ROOT / full["display_file"]).read_text(encoding="utf-8")
        i18n = (ROOT / "src" / "criteria-guide-i18n.js").read_text(encoding="utf-8")

        # Scope each check to the one section that lists all seven criteria as a
        # structured sequence; incidental early mentions elsewhere in the prose
        # (an intro paragraph, a cross-reference note) are not the presentation
        # order being verified here.
        surfaces = {
            "rubric_file Summary Scoring Table": full_rubric[
                full_rubric.index("## 4. Summary Scoring Table") : full_rubric.index("## 5. Detailed Criterion Rules")
            ],
            "display_file Summary Scoring Table": display[
                display.index("## Summary Scoring Table") : display.index("## Parameter Guide")
            ],
            "criteria-guide-i18n.js Full Scout scoring table": i18n[
                i18n.index('<section class="criteria-scoring-section criteria-guide-section" data-criteria-tab="full">')
                : i18n.index('<section class="criteria-parameter-guide full-parameter-guide')
            ],
        }
        english_display_names = ["Target Area Relevance", *display_names[1:]]
        for label, surface in surfaces.items():
            names = english_display_names if label.startswith("criteria-guide-i18n.js") else display_names
            positions = [surface.index(name) for name in names]
            self.assertEqual(positions, sorted(positions), f"{label} lists the seven criteria out of order")

    def test_scoring_criteria_api_exposes_release_identity(self) -> None:
        payload = main.get_scoring_criteria()
        self.assertEqual(payload["release_id"], self.manifest["release_id"])
        self.assertEqual(payload["released_at"], self.manifest["released_at"])
        self.assertEqual(payload["calculations"], self.manifest["calculations"])


if __name__ == "__main__":
    unittest.main()
