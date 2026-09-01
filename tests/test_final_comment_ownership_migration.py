import unittest
from pathlib import Path
from unittest.mock import patch

import main


ROOT = Path(__file__).resolve().parents[1]
TRIAGE_JS = (ROOT / "src" / "triage-detail.js").read_text(encoding="utf-8")


class FinalCommentOwnershipMigrationTests(unittest.TestCase):
    def setUp(self):
        self.current_account = {"id": "current-account", "name": "정주원", "email": "new@example.com"}
        self.legacy_review = {
            "final_comment_author_id": "retired-account",
            "final_comment_author_name": "정주원",
        }

    def test_retired_id_without_email_cannot_be_claimed_by_name(self):
        with patch.object(main, "load_users", return_value=[self.current_account]):
            self.assertFalse(main.final_comment_owned_by_account(self.legacy_review, self.current_account))

    def test_active_prior_account_prevents_name_based_claim(self):
        prior_account = {"id": "retired-account", "name": "정주원", "email": "prior@example.com"}
        with patch.object(main, "load_users", return_value=[self.current_account, prior_account]):
            self.assertFalse(main.final_comment_owned_by_account(self.legacy_review, self.current_account))

    def test_retired_id_without_email_cannot_match_a_normal_comment_or_topic_note(self):
        account = {"id": "new-account", "name": "\uc815\uc8fc\uc6d0", "email": "new@example.com"}
        legacy_comment = {"author_user_id": "retired-account", "author": "\uc815\uc8fc\uc6d0"}
        legacy_note = {"author_id": "retired-account", "author_name": "\uc815\uc8fc\uc6d0"}
        with patch.object(main, "load_users", return_value=[account]):
            self.assertFalse(main.comment_owned_by_account(legacy_comment, account))
            self.assertFalse(main.topic_note_owned_by_account(legacy_note, account))

    def test_new_final_comments_store_email_and_detail_view_handles_migration(self):
        self.assertIn('human_review["final_comment_author_email"]', main.Path(main.__file__).read_text(encoding="utf-8"))
        self.assertIn("function currentUserOwnsFinalComment", TRIAGE_JS)
        self.assertNotIn("migratedLegacyOwner", TRIAGE_JS)
        source = main.Path(main.__file__).read_text(encoding="utf-8")
        self.assertIn('"author_email": normalized_identity_email(account.get("email"))', source)


if __name__ == "__main__":
    unittest.main()
