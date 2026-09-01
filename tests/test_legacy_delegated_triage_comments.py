import unittest
from pathlib import Path
from unittest.mock import patch

import main


ROOT = Path(__file__).resolve().parents[1]
DETAIL_JS = (ROOT / "src" / "detail.js").read_text(encoding="utf-8")


class LegacyDelegatedTriageCommentTests(unittest.TestCase):
    def test_legacy_name_without_id_or_email_cannot_manage_a_delegated_triage_comment(self):
        imported_comment = {
            "system_import": True,
            "origin_kind": "triage_final_comment",
            "author": "정주원",
        }
        account = {"id": "juwon-1", "name": "정주원", "email": "juwon@example.com"}

        with patch.object(main, "load_users", return_value=[account]):
            self.assertFalse(main.account_owns_delegated_triage_comment(imported_comment, account))

    def test_legacy_name_is_never_a_delegated_triage_comment_identity(self):
        imported_comment = {
            "system_import": True,
            "origin_kind": "triage_final_comment",
            "author": "정주원",
        }
        account = {"id": "juwon-1", "name": "정주원", "email": "juwon@example.com"}

        with patch.object(main, "load_users", return_value=[account, {"id": "juwon-2", "name": "정주원"}]):
            self.assertFalse(main.account_owns_delegated_triage_comment(imported_comment, account))

    def test_detail_view_requires_an_id_or_email_for_delegated_comment_ownership(self):
        start = DETAIL_JS.index("function currentUserOwnsDelegatedTriageComment")
        end = DETAIL_JS.index("function displayOperationalAuthor", start)
        body = DETAIL_JS[start:end]

        self.assertIn("sameEmail", body)
        self.assertNotIn("legacyNameOnly", body)


if __name__ == "__main__":
    unittest.main()
