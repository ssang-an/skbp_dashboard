import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "backfill_legacy_author_emails", ROOT / "scripts" / "backfill_legacy_author_emails.py"
)
backfill = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(backfill)


class BackfillLegacyAuthorEmailsTests(unittest.TestCase):
    def test_uses_recorded_id_email_evidence_and_never_a_name(self):
        records = [{
            "meta": {
                "collaboration": {"comments": [{"author_user_id": "old-1", "author_email": "author@sk.com"}]},
                "topic_notes": [
                    {"author_id": "old-1", "author_name": "Same Name"},
                    {"author_id": "unknown", "author_name": "Same Name"},
                ],
            }
        }]
        changed = backfill.backfill_author_emails(records, [])
        notes = records[0]["meta"]["topic_notes"]
        self.assertEqual(changed["topic_notes"], 1)
        self.assertEqual(notes[0]["author_email"], "author@sk.com")
        self.assertNotIn("author_email", notes[1])

    def test_current_account_id_is_valid_evidence(self):
        records = [{"meta": {"topic_notes": [{"author_id": "current-1"}]}}]
        changed = backfill.backfill_author_emails(records, [{"id": "current-1", "email": "owner@sk.com"}])
        self.assertEqual(changed["topic_notes"], 1)
        self.assertEqual(records[0]["meta"]["topic_notes"][0]["author_email"], "owner@sk.com")


if __name__ == "__main__":
    unittest.main()
