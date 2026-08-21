from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "reconcile_pipeline_records.py"
SPEC = importlib.util.spec_from_file_location("reconcile_pipeline_records", SCRIPT_PATH)
assert SPEC and SPEC.loader
reconcile_script = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = reconcile_script
SPEC.loader.exec_module(reconcile_script)


def record(company: str, asset: str, score: int = 1) -> dict:
    return {
        "meta": {"updated_at": "2026-08-21T09:00:00+09:00"},
        "structured_table": {"company": company, "asset_name": asset},
        "scoring": {"total_score": score},
    }


class PipelineRecordReconciliationTests(unittest.TestCase):
    def test_unique_stash_records_are_safely_added(self):
        current = [record("Current Co", "CUR-1")]
        snapshots = [
            reconcile_script.Snapshot("stash@{1}", [record("Older Co", "OLD-1")]),
            reconcile_script.Snapshot("stash@{0}", [record("Newest Co", "NEW-1")]),
        ]

        merged, report = reconcile_script.reconcile(current, snapshots)

        self.assertTrue(report["is_safe_to_write"])
        self.assertEqual(len(merged), 3)
        self.assertEqual([item["record_id"] for item in report["added"]], ["Older Co_OLD-1", "Newest Co_NEW-1"])
        self.assertEqual(report["conflicts"], [])

    def test_different_same_id_is_reported_and_blocks_write(self):
        current = [record("Shared Co", "SH-1", score=1)]
        snapshot = reconcile_script.Snapshot("stash@{0}", [record("Shared Co", "SH-1", score=3)])

        merged, report = reconcile_script.reconcile(current, [snapshot])

        self.assertFalse(report["is_safe_to_write"])
        self.assertEqual(len(merged), 1)
        self.assertEqual(report["conflicts"][0]["record_id"], "Shared Co_SH-1")
        self.assertEqual(report["conflicts"][0]["existing_source"], "current")

    def test_identical_record_is_not_duplicated(self):
        current_record = record("Same Co", "S-1", score=2)
        merged, report = reconcile_script.reconcile(
            [current_record], [reconcile_script.Snapshot("stash@{0}", [json.loads(json.dumps(current_record))])]
        )

        self.assertTrue(report["is_safe_to_write"])
        self.assertEqual(len(merged), 1)
        self.assertEqual(len(report["identical"]), 1)

    def test_three_way_merge_keeps_non_overlapping_current_and_stash_edits(self):
        base = record("Shared Co", "SH-1", score=1)
        current = json.loads(json.dumps(base))
        current["meta"]["human_review"] = {"note": "company PC note"}
        stash = json.loads(json.dumps(base))
        stash["scoring"]["total_score"] = 3

        merged, report = reconcile_script.reconcile(
            [current], [reconcile_script.Snapshot("stash@{0}", [stash], base_records=[base])]
        )

        self.assertTrue(report["is_safe_to_write"])
        self.assertEqual(merged[0]["scoring"]["total_score"], 3)
        self.assertEqual(merged[0]["meta"]["human_review"]["note"], "company PC note")
        self.assertEqual(len(report["automatically_merged"]), 1)

    def test_three_way_merge_reports_same_field_collision(self):
        base = record("Shared Co", "SH-1", score=1)
        current = json.loads(json.dumps(base))
        current["scoring"]["total_score"] = 2
        stash = json.loads(json.dumps(base))
        stash["scoring"]["total_score"] = 3

        merged, report = reconcile_script.reconcile(
            [current], [reconcile_script.Snapshot("stash@{0}", [stash], base_records=[base])]
        )

        self.assertFalse(report["is_safe_to_write"])
        self.assertEqual(merged[0]["scoring"]["total_score"], 2)
        self.assertEqual(report["conflicts"][0]["field_paths"], ["scoring.total_score"])

    def test_approved_metadata_policy_unions_audit_history(self):
        base = record("Shared Co", "SH-1", score=1)
        current = json.loads(json.dumps(base))
        current["meta"]["edit_history"] = [{"id": "home", "changed_at": "2026-08-20T09:00:00+00:00"}]
        stash = json.loads(json.dumps(base))
        stash["meta"]["edit_history"] = [{"id": "company", "changed_at": "2026-08-21T09:00:00+00:00"}]

        merged, report = reconcile_script.reconcile(
            [current],
            [reconcile_script.Snapshot("stash@{0}", [stash], base_records=[base])],
            resolve_metadata_conflicts=True,
        )

        self.assertTrue(report["is_safe_to_write"])
        self.assertEqual([entry["id"] for entry in merged[0]["meta"]["edit_history"]], ["home", "company"])
        self.assertEqual(len(report["policy_resolved"]), 1)

    def test_approved_metadata_policy_keeps_current_primary_without_common_base(self):
        current = record("Shared Co", "SH-1", score=1)
        current["meta"]["attachments"] = [{"filename": "home.pdf"}]
        stash = record("Shared Co", "SH-1", score=3)
        stash["meta"]["attachments"] = [{"filename": "company.pdf"}]

        merged, report = reconcile_script.reconcile(
            [current],
            [reconcile_script.Snapshot("stash@{1}", [stash])],
            resolve_metadata_conflicts=True,
        )

        self.assertTrue(report["is_safe_to_write"])
        self.assertEqual(merged[0]["scoring"]["total_score"], 1)
        self.assertEqual(
            [attachment["filename"] for attachment in merged[0]["meta"]["attachments"]], ["home.pdf", "company.pdf"]
        )

    def test_three_way_merge_does_not_serialize_deleted_field_sentinel(self):
        base = {"removed_later": "legacy", "retained": "base"}
        current = {"retained": "current"}
        snapshot = {"removed_later": "legacy", "retained": "base"}

        merged, conflicts = reconcile_script.three_way_merge_value(base, current, snapshot)

        self.assertEqual(conflicts, [])
        self.assertEqual(merged, {"retained": "current"})
        self.assertEqual(reconcile_script.canonical_value_bytes(merged), b'{"retained":"current"}')

    def test_write_creates_backup_before_replacing_json(self):
        original_data_file = reconcile_script.main.DATA_FILE
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp = Path(temp_dir)
                data_file = temp / "pipeline-records.json"
                before = [record("Current Co", "CUR-1")]
                data_file.write_text(json.dumps(before), encoding="utf-8")
                reconcile_script.main.DATA_FILE = data_file

                after = before + [record("Stash Co", "ST-1")]
                backup = reconcile_script.backup_and_write(after, temp / "backups")

                self.assertEqual(json.loads(backup.read_text(encoding="utf-8")), before)
                self.assertEqual(json.loads(data_file.read_text(encoding="utf-8")), after)
        finally:
            reconcile_script.main.DATA_FILE = original_data_file


if __name__ == "__main__":
    unittest.main()
