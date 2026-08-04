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


if __name__ == "__main__":
    unittest.main()
