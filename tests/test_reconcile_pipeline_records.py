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
