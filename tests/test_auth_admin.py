import asyncio
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

import main


class FakeRequest:
    def __init__(self, token="", payload=None, ip="127.0.0.1"):
        self.cookies = {main.AUTH_COOKIE_NAME: token} if token else {}
        self._payload = payload or {}
        self.client = SimpleNamespace(host=ip)
        self.headers = {}

    async def json(self):
        return self._payload


class AuthAdminTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.users_file = Path(self.temp_dir.name) / "users.json"
        self.patcher = patch.object(main, "USERS_FILE", self.users_file)
        self.patcher.start()
        main.save_users([])

    def tearDown(self):
        self.patcher.stop()
        self.temp_dir.cleanup()

    def create_user(self, email, name="Test User"):
        salt, digest = main.password_hash("test1234")
        user = {
            "id": email.split("@")[0], "name": name, "email": email.lower(),
            "password_salt": salt, "password_hash": digest,
            "created_at": "2026-08-02T00:00:00+00:00", "last_login_at": "2026-08-02T00:00:00+00:00",
            "sessions": [], "activity_log": [],
        }
        token, _ = main.start_user_session(user)
        users = main.load_users()
        users.append(user)
        main.save_users(users)
        return user, token

    def test_admin_role_is_derived_only_from_designated_email(self):
        admin, _ = self.create_user("JOOWON.JUNG@SK.COM", "정주원")
        regular, _ = self.create_user("user@sk.com")
        self.assertTrue(main.public_user(admin)["is_admin"])
        self.assertFalse(main.public_user(regular)["is_admin"])

    def test_regular_user_cannot_read_admin_api(self):
        _, token = self.create_user("user@sk.com")
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.list_admin_users(FakeRequest(token)))
        self.assertEqual(error.exception.status_code, 403)

    def test_admin_can_view_activity_and_deactivate_account(self):
        _, admin_token = self.create_user(main.AUTH_ADMIN_EMAIL, "정주원")
        regular, regular_token = self.create_user("user@sk.com")
        asyncio.run(main.record_auth_activity(FakeRequest(regular_token, {"path": "/detail?id=asset-1"})))

        response = asyncio.run(main.list_admin_users(FakeRequest(admin_token)))
        target = next(user for user in response["users"] if user["email"] == "user@sk.com")
        self.assertTrue(any(item.get("path") == "/detail?id=asset-1" for item in target["activity_log"]))

        result = asyncio.run(main.update_admin_user(regular["id"], FakeRequest(admin_token, {"active": False})))
        self.assertFalse(result["user"]["active"])
        saved = next(user for user in main.load_users() if user["id"] == regular["id"])
        self.assertEqual(saved["sessions"], [])

    def test_admin_cannot_deactivate_self(self):
        admin, token = self.create_user(main.AUTH_ADMIN_EMAIL, "정주원")
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.update_admin_user(admin["id"], FakeRequest(token, {"active": False})))
        self.assertEqual(error.exception.status_code, 400)


    def test_manual_review_requires_authentication(self):
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.update_manual_review("asset-1", FakeRequest(payload={"kind": "status", "value": "PASS"})))
        self.assertEqual(error.exception.status_code, 401)

    def test_manual_review_audit_uses_authenticated_name_not_payload_name(self):
        _, token = self.create_user("reviewer@sk.com", name="Logged In Reviewer")
        record = {
            "meta": {},
            "json_summary": {"company": "Test Co", "asset_name": "Asset-1"},
            "structured_table": {
                "company": "Test Co",
                "asset_name": "Asset-1",
                "development_stage": "Preclinical Candidate",
            },
            "hard_filter": {"status": "PASS", "reason": "", "flags": []},
            "scoring": {"total_score": 15, "max_score": 21, "criteria": {}},
        }
        record_id = main.record_key(record)
        request = FakeRequest(
            token,
            {
                "kind": "status",
                "value": "REVIEW",
                "previous_value": "PASS",
                "actor_name": "Spoofed Name",
            },
        )
        with (
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
            patch.object(main, "run_markdown_exports", return_value={}),
        ):
            result = asyncio.run(main.update_manual_review(record_id, request))

        human_review = result["record"]["meta"]["human_review"]
        self.assertEqual(human_review["history"][-1]["actor_name"], "Logged In Reviewer")
        self.assertEqual(human_review["last_updated_by"], "Logged In Reviewer")


if __name__ == "__main__":
    unittest.main()
