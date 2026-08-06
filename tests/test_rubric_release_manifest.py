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
        self.assertIn(f"v{full['rubric_version']}", display_text)

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

    def test_scoring_criteria_api_exposes_release_identity(self) -> None:
        payload = main.get_scoring_criteria()
        self.assertEqual(payload["release_id"], self.manifest["release_id"])
        self.assertEqual(payload["released_at"], self.manifest["released_at"])
        self.assertEqual(payload["calculations"], self.manifest["calculations"])


if __name__ == "__main__":
    unittest.main()
