from __future__ import annotations

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import main


class FakeRequest:
    def __init__(self, payload: dict):
        self._payload = payload
        self.client = SimpleNamespace(host="127.0.0.1")
        self.headers = {}
        self.cookies = {}

    async def json(self):
        return self._payload


def full_scout_record() -> dict:
    return {
        "meta": {"review_type": "full_scout", "generated_at": "2026-08-22", "output_filename_base": "Acme_AX-101"},
        "structured_table": {"company": "Acme", "asset_name": "AX-101"},
        "json_summary": {"company": "Acme", "asset_name": "AX-101"},
    }


class ShortlistingTrackingStatusTests(unittest.TestCase):
    def apply(self, record: dict, action: str) -> dict:
        record_id = main.record_key(record)
        with (
            patch.object(main, "require_auth_admin"),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
        ):
            return asyncio.run(main.update_focus_management(record_id, FakeRequest({"action": action})))

    def test_favorite_cycle_keeps_stationary_assets_shortlisted(self) -> None:
        record = full_scout_record()

        priority = self.apply(record, "add")["record"]
        self.assertTrue(priority["meta"]["focus_management"]["is_tracked"])
        self.assertEqual(priority["meta"]["focus_management"]["tracking_status"], "priority")

        stationary = self.apply(priority, "stationary")["record"]
        self.assertTrue(stationary["meta"]["focus_management"]["is_tracked"])
        self.assertEqual(stationary["meta"]["focus_management"]["tracking_status"], "stationary")
        self.assertEqual(stationary["meta"]["edit_history"][-1]["field"], "focus_management.tracking_status")

        untracked = self.apply(stationary, "remove")["record"]
        self.assertFalse(untracked["meta"]["focus_management"]["is_tracked"])
        self.assertNotIn("tracking_status", untracked["meta"]["focus_management"])


if __name__ == "__main__":
    unittest.main()
